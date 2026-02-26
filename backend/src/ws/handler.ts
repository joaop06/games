import type { FastifyInstance } from "fastify";
import { WebSocket } from "ws";
import { randomUUID } from "crypto";
import { AppDataSource, getRepository } from "../lib/db.js";
import { Match } from "../entities/Match.js";
import { Move } from "../entities/Move.js";
import { UserGameStats } from "../entities/UserGameStats.js";
import { FriendGameRecord } from "../entities/FriendGameRecord.js";
import { verifyWsToken } from "../lib/auth.js";
import {
  getWinner,
  isDraw,
  isValidPosition,
  boardFromMoves,
  currentTurn,
  type Board,
} from "../lib/tic-tac-toe.js";
import {
  buildMatchState,
  type BuildMatchStateArg,
  TIC_TAC_TOE_GAME_TYPE,
  areFriends,
} from "../routes/games/tic-tac-toe.js";

type Connection = { ws: WebSocket; userId: string };
const matchConnections = new Map<string, Set<Connection>>();
const userConnections = new Map<string, Set<WebSocket>>();

type QueueEntry = { userId: string; joinedAt: number };
const matchmakingQueue = new Map<string, QueueEntry[]>();

function removeFromQueue(gameType: string, userId: string) {
  const q = matchmakingQueue.get(gameType);
  if (!q) return;
  const idx = q.findIndex((e) => e.userId === userId);
  if (idx !== -1) q.splice(idx, 1);
  if (q.length === 0) matchmakingQueue.delete(gameType);
}

async function tryMatchTicTacToe() {
  const gameType = TIC_TAC_TOE_GAME_TYPE;
  const q = matchmakingQueue.get(gameType);
  if (!q || q.length < 2) return;

  let playerXId: string;
  let playerOId: string;
  let idxA = 0;
  let idxB = 1;
  let foundNonFriend = false;
  for (let i = 0; i < q.length && !foundNonFriend; i++) {
    for (let j = i + 1; j < q.length && !foundNonFriend; j++) {
      const uA = q[i].userId;
      const uB = q[j].userId;
      if (!(await areFriends(uA, uB))) {
        playerXId = uA;
        playerOId = uB;
        idxA = i;
        idxB = j;
        foundNonFriend = true;
      }
    }
  }
  if (!foundNonFriend) {
    playerXId = q[0].userId;
    playerOId = q[1].userId;
    idxA = 0;
    idxB = 1;
  }

  q.splice(idxB, 1);
  q.splice(idxA, 1);
  if (q.length === 0) matchmakingQueue.delete(gameType);

  const matchRepo = getRepository(Match);
  const match = matchRepo.create({
    id: randomUUID(),
    gameType: TIC_TAC_TOE_GAME_TYPE,
    playerXId: playerXId!,
    playerOId: playerOId!,
    status: "in_progress",
  });
  await matchRepo.save(match);
  const matchWithRelations = await matchRepo.findOne({
    where: { id: match.id },
    relations: { playerX: true, playerO: true, moves: true },
  });
  if (!matchWithRelations) throw new Error("Match not found");
  const state = buildMatchState({
    ...matchWithRelations,
    moves: (matchWithRelations.moves ?? []).map((m: Move) => ({ position: m.position, playerId: m.playerId })),
  } as BuildMatchStateArg);
  sendToUser(playerXId!, {
    type: "match_ready",
    matchId: match.id,
    gameType: TIC_TAC_TOE_GAME_TYPE,
    match: state,
  });
  sendToUser(playerOId!, {
    type: "match_ready",
    matchId: match.id,
    gameType: TIC_TAC_TOE_GAME_TYPE,
    match: state,
  });
}

function send(ws: WebSocket, payload: object) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function addUserConnection(userId: string, ws: WebSocket) {
  let conns = userConnections.get(userId);
  if (!conns) {
    conns = new Set();
    userConnections.set(userId, conns);
  }
  conns.add(ws);
}

function removeUserConnection(userId: string, ws: WebSocket) {
  const conns = userConnections.get(userId);
  if (!conns) return;
  conns.delete(ws);
  if (conns.size === 0) userConnections.delete(userId);
}

export function sendToUser(userId: string, payload: object) {
  const conns = userConnections.get(userId);
  if (!conns) return;
  for (const ws of conns) {
    send(ws, payload);
  }
}

export function broadcastMatch(matchId: string, payload: object) {
  const conns = matchConnections.get(matchId);
  if (!conns) return;
  for (const { ws } of conns) {
    send(ws, payload);
  }
}

function removeConnection(matchId: string, ws: WebSocket) {
  const conns = matchConnections.get(matchId);
  if (!conns) return;
  for (const c of conns) {
    if (c.ws === ws) {
      conns.delete(c);
      if (conns.size === 0) matchConnections.delete(matchId);
      break;
    }
  }
}

async function updateStatsForFinishedMatch(
  playerXId: string,
  playerOId: string,
  winnerId: string | null
) {
  const [userAId, userBId] = [playerXId, playerOId].sort();
  const isDrawResult = winnerId === null;
  const winner = winnerId;
  await AppDataSource.transaction(async (manager) => {
    const statsRepo = manager.getRepository(UserGameStats);
    const recordRepo = manager.getRepository(FriendGameRecord);
    for (const [userId, isPlayerX] of [
      [playerXId, true],
      [playerOId, false],
    ] as const) {
      let row = await statsRepo.findOne({
        where: { userId, gameType: TIC_TAC_TOE_GAME_TYPE },
      });
      const addWin = winner === userId ? 1 : 0;
      const addLoss = winner === (isPlayerX ? playerOId : playerXId) ? 1 : 0;
      const addDraw = isDrawResult ? 1 : 0;
      if (row) {
        row.wins += addWin;
        row.losses += addLoss;
        row.draws += addDraw;
        await statsRepo.save(row);
      } else {
        row = statsRepo.create({
          userId,
          gameType: TIC_TAC_TOE_GAME_TYPE,
          wins: addWin,
          losses: addLoss,
          draws: addDraw,
          updatedAt: new Date(),
        });
        await statsRepo.save(row);
      }
    }
    let record = await recordRepo.findOne({
      where: { userAId, userBId, gameType: TIC_TAC_TOE_GAME_TYPE },
    });
    const addWinsA = winner === userAId ? 1 : 0;
    const addWinsB = winner === userBId ? 1 : 0;
    const addDraws = isDrawResult ? 1 : 0;
    if (record) {
      record.winsA += addWinsA;
      record.winsB += addWinsB;
      record.draws += addDraws;
      await recordRepo.save(record);
    } else {
      record = recordRepo.create({
        userAId,
        userBId,
        gameType: TIC_TAC_TOE_GAME_TYPE,
        winsA: addWinsA,
        winsB: addWinsB,
        draws: addDraws,
        updatedAt: new Date(),
      });
      await recordRepo.save(record);
    }
  });
}

export async function registerWebSocket(server: FastifyInstance) {
  server.get("/ws", { websocket: true }, (socket, request) => {
    const url = new URL(request.url ?? "", "http://localhost");
    const token = url.searchParams.get("token");
    const payload = token ? verifyWsToken(token) : null;
    if (!payload) {
      socket.close(4401, "Unauthorized");
      return;
    }
    const userId = payload.userId;
    addUserConnection(userId, socket);
    let currentMatchId: string | null = null;

    socket.on("message", async (raw: Buffer) => {
      let data: { type?: string; matchId?: string; position?: number; gameType?: string };
      try {
        data = JSON.parse(raw.toString());
      } catch {
        send(socket, { type: "error", code: "invalid_json", message: "Invalid JSON" });
        return;
      }

      try {
        if (data.type === "join_queue") {
        const gameType = data.gameType ?? TIC_TAC_TOE_GAME_TYPE;
        if (gameType !== TIC_TAC_TOE_GAME_TYPE) {
          send(socket, { type: "error", code: "invalid_payload", message: "Unsupported game type" });
          return;
        }
        await getRepository(Match).update(
          {
            gameType: TIC_TAC_TOE_GAME_TYPE,
            status: "waiting",
            playerXId: userId,
          },
          { status: "abandoned" }
        );
        removeFromQueue(gameType, userId);
        let q = matchmakingQueue.get(gameType);
        if (!q) {
          q = [];
          matchmakingQueue.set(gameType, q);
        }
        q.push({ userId, joinedAt: Date.now() });
        await tryMatchTicTacToe();
        return;
        }

        if (data.type === "leave_queue") {
        const gameType = data.gameType ?? TIC_TAC_TOE_GAME_TYPE;
        removeFromQueue(gameType, userId);
        return;
        }

        if (data.type === "join_match") {
        const matchId = data.matchId;
        if (!matchId || typeof matchId !== "string") {
          send(socket, { type: "error", code: "invalid_payload", message: "matchId required" });
          return;
        }
        const match = await getRepository(Match).findOne({
          where: { id: matchId, gameType: TIC_TAC_TOE_GAME_TYPE },
          relations: { playerX: true, playerO: true, moves: true },
        });
        if (!match) {
          send(socket, { type: "error", code: "not_found", message: "Match not found" });
          return;
        }
        const isPlayer = match.playerXId === userId || match.playerOId === userId;
        if (!isPlayer) {
          send(socket, { type: "error", code: "forbidden", message: "Not a player in this match" });
          return;
        }
        if (currentMatchId) removeConnection(currentMatchId, socket);
        currentMatchId = matchId;
        let conns = matchConnections.get(matchId);
        if (!conns) {
          conns = new Set();
          matchConnections.set(matchId, conns);
        }
        conns.add({ ws: socket, userId });
        const state = buildMatchState({
          ...match,
          moves: (match.moves ?? []).map((m: Move) => ({ position: m.position, playerId: m.playerId })),
        } as BuildMatchStateArg);
        send(socket, { type: "match_state", ...state });
        return;
        }

        if (data.type === "leave_match") {
        if (currentMatchId) {
          removeConnection(currentMatchId, socket);
          currentMatchId = null;
        }
        return;
        }

        if (data.type === "move") {
        const matchId = data.matchId ?? currentMatchId;
        const position = data.position;
        if (!matchId) {
          send(socket, { type: "error", code: "invalid_payload", message: "matchId required" });
          return;
        }
        if (typeof position !== "number" || !isValidPosition(position)) {
          send(socket, { type: "error", code: "invalid_payload", message: "position must be 0-8" });
          return;
        }
        const match = await getRepository(Match).findOne({
          where: { id: matchId, gameType: TIC_TAC_TOE_GAME_TYPE },
          relations: { moves: true, playerX: true, playerO: true },
        });
        if (!match) {
          send(socket, { type: "error", code: "not_found", message: "Match not found" });
          return;
        }
        if (match.status !== "in_progress") {
          send(socket, { type: "error", code: "invalid_state", message: "Match is not in progress" });
          return;
        }
        if (!match.playerOId) {
          send(socket, { type: "error", code: "invalid_state", message: "Waiting for second player" });
          return;
        }
        const board = boardFromMoves(
          (match.moves ?? []).map((m: Move) => ({ position: m.position, playerId: m.playerId })),
          match.playerXId,
          match.playerOId
        );
        if (board[position] !== null) {
          send(socket, { type: "error", code: "invalid_move", message: "Position already taken" });
          return;
        }
        const turn = currentTurn(board);
        const isX = turn === "X";
        const currentPlayerId = isX ? match.playerXId : match.playerOId;
        if (currentPlayerId !== userId) {
          send(socket, { type: "error", code: "not_your_turn", message: "Not your turn" });
          return;
        }
        const moveRepo = getRepository(Move);
        const move = moveRepo.create({
          id: randomUUID(),
          matchId,
          playerId: userId,
          position,
        });
        await moveRepo.save(move);
        const newMoves: { position: number; playerId: string }[] = [
          ...(match.moves ?? []).map((m: Move) => ({ position: m.position, playerId: m.playerId })),
          { position: move.position, playerId: move.playerId },
        ];
        const newBoard = boardFromMoves(
          newMoves.map((m) => ({ position: m.position, playerId: m.playerId })),
          match.playerXId,
          match.playerOId
        );
        const winner = getWinner(newBoard);
        const draw = isDraw(newBoard);
        const finished = !!winner || draw;
        let winnerId: string | null = null;
        if (winner) winnerId = winner === "X" ? match.playerXId : match.playerOId;
        if (finished) {
          await getRepository(Match).update(
            { id: matchId },
            { status: "finished", winnerId, finishedAt: new Date() }
          );
          await updateStatsForFinishedMatch(match.playerXId, match.playerOId, winnerId);
        }
        const updatedMatch = await getRepository(Match).findOne({
          where: { id: matchId },
          relations: { moves: true, playerX: true, playerO: true },
        });
        if (updatedMatch) {
          const state = buildMatchState({
            ...updatedMatch,
            moves: (updatedMatch.moves ?? []).map((m: Move) => ({ position: m.position, playerId: m.playerId })),
          } as BuildMatchStateArg);
          broadcastMatch(matchId, { type: "match_state", ...state });
        }
        return;
        }

        send(socket, { type: "error", code: "unknown_type", message: "Unknown message type" });
      } catch (err) {
        console.error(err);
        send(socket, { type: "error", code: "server_error", message: "Algo deu errado. Tenta de novo." });
      }
    });

    socket.on("close", () => {
      removeUserConnection(userId, socket);
      if (currentMatchId) removeConnection(currentMatchId, socket);
      removeFromQueue(TIC_TAC_TOE_GAME_TYPE, userId);
    });
  });
}
