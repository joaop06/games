import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { randomUUID } from "crypto";
import { In } from "typeorm";
import { getRepository } from "../../lib/db.js";
import { Match } from "../../entities/Match.js";
import { Move } from "../../entities/Move.js";
import { Friendship } from "../../entities/Friendship.js";
import { User } from "../../entities/User.js";
import { Notification } from "../../entities/Notification.js";
import { UserGameStats } from "../../entities/UserGameStats.js";
import { FriendGameRecord } from "../../entities/FriendGameRecord.js";
import { requireAuth } from "../../lib/auth.js";
import { sendToUser, broadcastMatch } from "../../ws/handler.js";
import {
  createTicTacToeMatchSchema,
  listMatchesQuerySchema,
  leaderboardQuerySchema,
} from "../../lib/validation.js";
import {
  boardFromMoves,
  getWinner,
  isDraw,
  currentTurn,
  isValidPosition,
  type Board,
} from "../../lib/tic-tac-toe.js";

export const TIC_TAC_TOE_GAME_TYPE = "tic_tac_toe";
const GAME_TYPE = TIC_TAC_TOE_GAME_TYPE;

export async function areFriends(userIdA: string, userIdB: string): Promise<boolean> {
  const [idA, idB] = [userIdA, userIdB].sort();
  const friendship = await getRepository(Friendship).findOne({
    where: { userAId: idA, userBId: idB },
  });
  return !!friendship;
}

export type BuildMatchStateArg = {
  id: string;
  status: string;
  winnerId: string | null;
  playerXId: string;
  playerOId: string | null;
  playerX?: { id: string; username: string };
  playerO?: { id: string; username: string } | null;
  moves: { position: number; playerId: string }[];
};

export function buildMatchState(match: BuildMatchStateArg) {
  if (!match.playerOId) {
    return {
      id: match.id,
      gameType: GAME_TYPE,
      status: match.status,
      winnerId: match.winnerId,
      playerX: match.playerX ? { id: match.playerX.id, username: match.playerX.username } : undefined,
      playerO: null,
      board: [null, null, null, null, null, null, null, null, null] as Board,
      currentTurn: "X" as const,
      moves: [],
    };
  }
  const board = boardFromMoves(
    match.moves.map((m) => ({ position: m.position, playerId: m.playerId })),
    match.playerXId,
    match.playerOId
  );
  return {
    id: match.id,
    gameType: GAME_TYPE,
    status: match.status,
    winnerId: match.winnerId,
    playerX: match.playerX ? { id: match.playerX.id, username: match.playerX.username } : undefined,
    playerO: match.playerO ? { id: match.playerO.id, username: match.playerO.username } : null,
    board,
    currentTurn: currentTurn(board),
    moves: match.moves.map((m) => ({ position: m.position, playerId: m.playerId })),
  };
}

async function ticTacToeRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", requireAuth);

  fastify.post<{ Body: unknown }>(
    "/api/games/tic-tac-toe/matches",
    async (request: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) => {
      if (!request.userId) return reply.status(401).send({ error: "Unauthorized" });
      const parsed = createTicTacToeMatchSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        const flattened = parsed.error.flatten();
        const firstFieldError =
          Object.values(flattened.fieldErrors).flat().find(Boolean) ?? flattened.formErrors[0];
        const errorMessage =
          typeof firstFieldError === "string" ? firstFieldError : "Validation failed";
        return reply.status(400).send({ error: errorMessage, details: flattened });
      }
      const { opponentUserId } = parsed.data;
      if (!opponentUserId) {
        return reply.status(400).send({
          error: "opponentUserId required. Use the matchmaking queue to find a match, or provide opponentUserId to challenge a friend.",
        });
      }
      let playerOId: string | null = null;
      let status = "waiting";
      {
        if (opponentUserId === request.userId) {
          return reply.status(400).send({ error: "Cannot play against yourself" });
        }
        const friends = await areFriends(request.userId, opponentUserId);
        if (!friends) {
          return reply.status(403).send({ error: "Can only challenge friends" });
        }
        const matchRepo = getRepository(Match);
        const opponentInMatch = await matchRepo.findOne({
          where: [
            {
              gameType: GAME_TYPE,
              status: In(["waiting", "in_progress"]),
              playerXId: opponentUserId,
            },
            {
              gameType: GAME_TYPE,
              status: In(["waiting", "in_progress"]),
              playerOId: opponentUserId,
            },
          ],
        });
        if (opponentInMatch) {
          const invitedToThisMatch =
            opponentInMatch.status === "waiting" &&
            (await getRepository(Notification).findOne({
              where: {
                matchId: opponentInMatch.id,
                type: "game_invite",
                userId: request.userId,
              },
            }));
          if (invitedToThisMatch) {
            await getRepository(Match).update(
              { id: opponentInMatch.id },
              { playerOId: request.userId, status: "in_progress" }
            );
            const updated = await matchRepo.findOne({
              where: { id: opponentInMatch.id },
              relations: { playerX: true, playerO: true, moves: true },
            });
            if (!updated) throw new Error("Match not found");
            await getRepository(Notification).delete({
              matchId: opponentInMatch.id,
              type: "game_invite",
            });
            const state = buildMatchState({
              ...updated,
              moves: (updated.moves ?? []).map((m: Move) => ({ position: m.position, playerId: m.playerId })),
            } as BuildMatchStateArg);
            broadcastMatch(opponentInMatch.id, { type: "match_state", ...state });
            return reply.status(201).send({ match: state });
          }
          const opponent = await getRepository(User).findOne({
            where: { id: opponentUserId },
            select: { username: true },
          });
          sendToUser(request.userId, {
            type: "game_invite_opponent_busy",
            opponentUsername: opponent?.username ?? "Oponente",
          });
          return reply.status(200).send({ opponentBusy: true });
        }
        status = "waiting";
      }
      const matchRepo = getRepository(Match);
      const match = matchRepo.create({
        id: randomUUID(),
        gameType: GAME_TYPE,
        playerXId: request.userId,
        playerOId,
        status,
      });
      await matchRepo.save(match);
      const matchWithRelations = await matchRepo.findOne({
        where: { id: match.id },
        relations: { playerX: true, playerO: true, moves: true },
      });
      if (!matchWithRelations) throw new Error("Match not found");
      if (opponentUserId) {
        const notif = getRepository(Notification).create({
          id: randomUUID(),
          userId: opponentUserId,
          type: "game_invite",
          matchId: match.id,
        });
        await getRepository(Notification).save(notif);
        sendToUser(opponentUserId, {
          type: "game_invite",
          matchId: match.id,
          fromUser: matchWithRelations.playerX
            ? { id: matchWithRelations.playerX.id, username: matchWithRelations.playerX.username }
            : undefined,
          gameType: "tic_tac_toe",
        });
      }
      const state = buildMatchState({
        ...matchWithRelations,
        moves: (matchWithRelations.moves ?? []).map((m: Move) => ({ position: m.position, playerId: m.playerId })),
      } as BuildMatchStateArg);
      return reply.status(201).send({ match: state });
    }
  );

  fastify.get<{ Querystring: unknown }>(
    "/api/games/tic-tac-toe/matches",
    async (request: FastifyRequest<{ Querystring: unknown }>, reply: FastifyReply) => {
      if (!request.userId) return reply.status(401).send({ error: "Unauthorized" });
      const parsed = listMatchesQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        const flattened = parsed.error.flatten();
        const firstFieldError =
          Object.values(flattened.fieldErrors).flat().find(Boolean) ?? flattened.formErrors[0];
        const errorMessage =
          typeof firstFieldError === "string" ? firstFieldError : "Validation failed";
        return reply.status(400).send({ error: errorMessage, details: flattened });
      }
      const { status: statusFilter, limit } = parsed.data;
      const matchRepo = getRepository(Match);
      const qb = matchRepo
        .createQueryBuilder("m")
        .leftJoinAndSelect("m.playerX", "playerX")
        .leftJoinAndSelect("m.playerO", "playerO")
        .where("(m.player_x_id = :userId OR m.player_o_id = :userId)", { userId: request.userId })
        .orderBy("m.created_at", "DESC")
        .take(limit);
      if (statusFilter) qb.andWhere("m.status = :status", { status: statusFilter });
      const matches = await qb.getMany();
      const list = matches.map((m) => ({
        id: m.id,
        status: m.status,
        winnerId: m.winnerId,
        playerX: m.playerX ? { id: m.playerX.id, username: m.playerX.username } : undefined,
        playerO: m.playerO ? { id: m.playerO.id, username: m.playerO.username } : null,
        createdAt: m.createdAt,
        finishedAt: m.finishedAt,
      }));
      return reply.send({ matches: list });
    }
  );

  fastify.get<{ Params: { id: string } }>(
    "/api/games/tic-tac-toe/matches/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      if (!request.userId) return reply.status(401).send({ error: "Unauthorized" });
      const match = await getRepository(Match).findOne({
        where: { id: request.params.id, gameType: GAME_TYPE },
        relations: { playerX: true, playerO: true, moves: true },
      });
      if (!match) return reply.status(404).send({ error: "Match not found" });
      const isPlayer = match.playerXId === request.userId || match.playerOId === request.userId;
      if (!isPlayer) return reply.status(403).send({ error: "Not a player in this match" });
      const state = buildMatchState({
        ...match,
        moves: (match.moves ?? []).map((m: Move) => ({ position: m.position, playerId: m.playerId })),
      } as BuildMatchStateArg);
      return reply.send({ match: state });
    }
  );

  fastify.post<{ Params: { id: string } }>(
    "/api/games/tic-tac-toe/matches/:id/join",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      if (!request.userId) return reply.status(401).send({ error: "Unauthorized" });
      const match = await getRepository(Match).findOne({
        where: { id: request.params.id, gameType: GAME_TYPE },
        relations: { playerX: true, playerO: true, moves: true },
      });
      if (!match) return reply.status(404).send({ error: "Match not found" });
      if (match.status !== "waiting") {
        return reply.status(409).send({ error: "Match is not waiting for a player" });
      }
      if (match.playerXId === request.userId) {
        return reply.status(409).send({ error: "You are already in this match" });
      }
      await getRepository(Match).update(
        { id: match.id },
        { playerOId: request.userId, status: "in_progress" }
      );
      const updated = await getRepository(Match).findOne({
        where: { id: match.id },
        relations: { playerX: true, playerO: true, moves: true },
      });
      if (!updated) throw new Error("Match not found");
      await getRepository(Notification).delete({ matchId: match.id, type: "game_invite" });
      const state = buildMatchState({
        ...updated,
        moves: (updated.moves ?? []).map((m: Move) => ({ position: m.position, playerId: m.playerId })),
      } as BuildMatchStateArg);
      broadcastMatch(match.id, { type: "match_state", ...state });
      return reply.send({ match: state });
    }
  );

  fastify.get(
    "/api/games/tic-tac-toe/stats",
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.userId) return reply.status(401).send({ error: "Unauthorized" });
      const stats = await getRepository(UserGameStats).findOne({
        where: { userId: request.userId!, gameType: GAME_TYPE },
      });
      const result = stats
        ? { wins: stats.wins, losses: stats.losses, draws: stats.draws }
        : { wins: 0, losses: 0, draws: 0 };
      return reply.send({ stats: result });
    }
  );

  fastify.get<{ Params: { friendId: string } }>(
    "/api/games/tic-tac-toe/stats/vs-friend/:friendId",
    async (request: FastifyRequest<{ Params: { friendId: string } }>, reply: FastifyReply) => {
      if (!request.userId) return reply.status(401).send({ error: "Unauthorized" });
      const friendId = request.params.friendId;
      const friends = await areFriends(request.userId, friendId);
      if (!friends) return reply.status(403).send({ error: "User is not your friend" });
      const [userAId, userBId] = [request.userId, friendId].sort();
      const record = await getRepository(FriendGameRecord).findOne({
        where: { userAId, userBId, gameType: GAME_TYPE },
      });
      const isA = request.userId === userAId;
      const result = record
        ? {
            wins: isA ? record.winsA : record.winsB,
            losses: isA ? record.winsB : record.winsA,
            draws: record.draws,
          }
        : { wins: 0, losses: 0, draws: 0 };
      return reply.send({ stats: result });
    }
  );

  fastify.get<{ Querystring: unknown }>(
    "/api/games/tic-tac-toe/leaderboard",
    async (request: FastifyRequest<{ Querystring: unknown }>, reply: FastifyReply) => {
      const parsed = leaderboardQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        const flattened = parsed.error.flatten();
        const firstFieldError =
          Object.values(flattened.fieldErrors).flat().find(Boolean) ?? flattened.formErrors[0];
        const errorMessage =
          typeof firstFieldError === "string" ? firstFieldError : "Validation failed";
        return reply.status(400).send({ error: errorMessage, details: flattened });
      }
      const { limit } = parsed.data;
      const rows = await getRepository(UserGameStats).find({
        where: { gameType: GAME_TYPE },
        order: { wins: "DESC", losses: "ASC", draws: "DESC" },
        take: limit,
        relations: { user: true },
      });
      const leaderboard = rows.map((r, i) => ({
        rank: i + 1,
        userId: r.userId,
        username: r.user?.username ?? "",
        wins: r.wins,
        losses: r.losses,
        draws: r.draws,
      }));
      return reply.send({ leaderboard });
    }
  );
}

export default ticTacToeRoutes;
