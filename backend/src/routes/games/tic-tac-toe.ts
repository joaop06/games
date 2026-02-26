import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../../lib/db.js";
import { requireAuth } from "../../lib/auth.js";
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

async function areFriends(userIdA: string, userIdB: string): Promise<boolean> {
  const [idA, idB] = [userIdA, userIdB].sort();
  const friendship = await prisma.friendship.findUnique({
    where: { userAId_userBId: { userAId: idA, userBId: idB } },
  });
  return !!friendship;
}

export function buildMatchState(match: {
  id: string;
  status: string;
  winnerId: string | null;
  playerXId: string;
  playerOId: string | null;
  playerX?: { id: string; username: string };
  playerO?: { id: string; username: string } | null;
  moves: { position: number; playerId: string }[];
}) {
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
      const parsed = createTicTacToeMatchSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }
      const { opponentUserId } = parsed.data;
      let playerOId: string | null = null;
      let status = "waiting";
      if (opponentUserId) {
        if (opponentUserId === request.userId) {
          return reply.status(400).send({ error: "Cannot play against yourself" });
        }
        const friends = await areFriends(request.userId, opponentUserId);
        if (!friends) {
          return reply.status(403).send({ error: "Can only challenge friends" });
        }
        playerOId = opponentUserId;
        status = "in_progress";
      }
      const match = await prisma.match.create({
        data: {
          gameType: GAME_TYPE,
          playerXId: request.userId,
          playerOId,
          status,
        },
        include: {
          playerX: { select: { id: true, username: true } },
          playerO: playerOId ? { select: { id: true, username: true } } : false,
          moves: true,
        },
      });
      const state = buildMatchState({
        ...match,
        playerX: match.playerX,
        playerO: match.playerO ?? null,
      });
      return reply.status(201).send({ match: state });
    }
  );

  fastify.get<{ Querystring: unknown }>(
    "/api/games/tic-tac-toe/matches",
    async (request: FastifyRequest<{ Querystring: unknown }>, reply: FastifyReply) => {
      if (!request.userId) return reply.status(401).send({ error: "Unauthorized" });
      const parsed = listMatchesQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }
      const { status: statusFilter, limit } = parsed.data;
      const where = {
        OR: [{ playerXId: request.userId }, { playerOId: request.userId }],
        ...(statusFilter && { status: statusFilter }),
      };
      const matches = await prisma.match.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          playerX: { select: { id: true, username: true } },
          playerO: { select: { id: true, username: true } },
        },
      });
      const list = matches.map((m) => ({
        id: m.id,
        status: m.status,
        winnerId: m.winnerId,
        playerX: m.playerX,
        playerO: m.playerO,
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
      const match = await prisma.match.findUnique({
        where: { id: request.params.id, gameType: GAME_TYPE },
        include: {
          playerX: { select: { id: true, username: true } },
          playerO: { select: { id: true, username: true } },
          moves: true,
        },
      });
      if (!match) return reply.status(404).send({ error: "Match not found" });
      const isPlayer = match.playerXId === request.userId || match.playerOId === request.userId;
      if (!isPlayer) return reply.status(403).send({ error: "Not a player in this match" });
      const state = buildMatchState(match);
      return reply.send({ match: state });
    }
  );

  fastify.post<{ Params: { id: string } }>(
    "/api/games/tic-tac-toe/matches/:id/join",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      if (!request.userId) return reply.status(401).send({ error: "Unauthorized" });
      const match = await prisma.match.findUnique({
        where: { id: request.params.id, gameType: GAME_TYPE },
        include: {
          playerX: { select: { id: true, username: true } },
          playerO: { select: { id: true, username: true } },
          moves: true,
        },
      });
      if (!match) return reply.status(404).send({ error: "Match not found" });
      if (match.status !== "waiting") {
        return reply.status(409).send({ error: "Match is not waiting for a player" });
      }
      if (match.playerXId === request.userId) {
        return reply.status(409).send({ error: "You are already in this match" });
      }
      const updated = await prisma.match.update({
        where: { id: match.id },
        data: { playerOId: request.userId, status: "in_progress" },
        include: {
          playerX: { select: { id: true, username: true } },
          playerO: { select: { id: true, username: true } },
          moves: true,
        },
      });
      const state = buildMatchState(updated);
      return reply.send({ match: state });
    }
  );

  fastify.get(
    "/api/games/tic-tac-toe/stats",
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.userId) return reply.status(401).send({ error: "Unauthorized" });
      const stats = await prisma.userGameStats.findUnique({
        where: { userId_gameType: { userId: request.userId, gameType: GAME_TYPE } },
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
      const record = await prisma.friendGameRecord.findUnique({
        where: {
          userAId_userBId_gameType: { userAId, userBId, gameType: GAME_TYPE },
        },
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
      const parsed = leaderboardQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }
      const { limit } = parsed.data;
      const rows = await prisma.userGameStats.findMany({
        where: { gameType: GAME_TYPE },
        orderBy: [{ wins: "desc" }, { losses: "asc" }, { draws: "desc" }],
        take: limit,
        include: {
          user: { select: { id: true, username: true } },
        },
      });
      const leaderboard = rows.map((r, i) => ({
        rank: i + 1,
        userId: r.userId,
        username: r.user.username,
        wins: r.wins,
        losses: r.losses,
        draws: r.draws,
      }));
      return reply.send({ leaderboard });
    }
  );
}

export default ticTacToeRoutes;
