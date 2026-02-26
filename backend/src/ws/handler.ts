import type { FastifyInstance } from "fastify";
import { WebSocket } from "ws";
import { prisma } from "../lib/db.js";
import { verifyWsToken } from "../lib/auth.js";
import {
  getWinner,
  isDraw,
  isValidPosition,
  boardFromMoves,
  currentTurn,
  type Board,
} from "../lib/tic-tac-toe.js";
import { buildMatchState, TIC_TAC_TOE_GAME_TYPE } from "../routes/games/tic-tac-toe.js";

type Connection = { ws: WebSocket; userId: string };
const matchConnections = new Map<string, Set<Connection>>();

function send(ws: WebSocket, payload: object) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastMatch(matchId: string, payload: object) {
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
  await prisma.$transaction([
    prisma.userGameStats.upsert({
      where: { userId_gameType: { userId: playerXId, gameType: TIC_TAC_TOE_GAME_TYPE } },
      create: {
        userId: playerXId,
        gameType: TIC_TAC_TOE_GAME_TYPE,
        wins: winner === playerXId ? 1 : 0,
        losses: winner === playerOId ? 1 : 0,
        draws: isDrawResult ? 1 : 0,
      },
      update: {
        wins: { increment: winner === playerXId ? 1 : 0 },
        losses: { increment: winner === playerOId ? 1 : 0 },
        draws: { increment: isDrawResult ? 1 : 0 },
      },
    }),
    prisma.userGameStats.upsert({
      where: { userId_gameType: { userId: playerOId, gameType: TIC_TAC_TOE_GAME_TYPE } },
      create: {
        userId: playerOId,
        gameType: TIC_TAC_TOE_GAME_TYPE,
        wins: winner === playerOId ? 1 : 0,
        losses: winner === playerXId ? 1 : 0,
        draws: isDrawResult ? 1 : 0,
      },
      update: {
        wins: { increment: winner === playerOId ? 1 : 0 },
        losses: { increment: winner === playerXId ? 1 : 0 },
        draws: { increment: isDrawResult ? 1 : 0 },
      },
    }),
    prisma.friendGameRecord.upsert({
      where: {
        userAId_userBId_gameType: { userAId, userBId, gameType: TIC_TAC_TOE_GAME_TYPE },
      },
      create: {
        userAId,
        userBId,
        gameType: TIC_TAC_TOE_GAME_TYPE,
        winsA: winner === userAId ? 1 : 0,
        winsB: winner === userBId ? 1 : 0,
        draws: isDrawResult ? 1 : 0,
      },
      update: {
        winsA: { increment: winner === userAId ? 1 : 0 },
        winsB: { increment: winner === userBId ? 1 : 0 },
        draws: { increment: isDrawResult ? 1 : 0 },
      },
    }),
  ]);
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
    let currentMatchId: string | null = null;

    socket.on("message", async (raw: Buffer) => {
      let data: { type?: string; matchId?: string; position?: number };
      try {
        data = JSON.parse(raw.toString());
      } catch {
        send(socket, { type: "error", code: "invalid_json", message: "Invalid JSON" });
        return;
      }
      if (data.type === "join_match") {
        const matchId = data.matchId;
        if (!matchId || typeof matchId !== "string") {
          send(socket, { type: "error", code: "invalid_payload", message: "matchId required" });
          return;
        }
        const match = await prisma.match.findUnique({
          where: { id: matchId, gameType: TIC_TAC_TOE_GAME_TYPE },
          include: {
            playerX: { select: { id: true, username: true } },
            playerO: { select: { id: true, username: true } },
            moves: true,
          },
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
        const state = buildMatchState(match);
        send(socket, { type: "match_state", ...state });
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
        const match = await prisma.match.findUnique({
          where: { id: matchId, gameType: TIC_TAC_TOE_GAME_TYPE },
          include: { moves: true, playerX: { select: { id: true, username: true } }, playerO: { select: { id: true, username: true } } },
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
          match.moves.map((m) => ({ position: m.position, playerId: m.playerId })),
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
        const move = await prisma.move.create({
          data: { matchId, playerId: userId, position },
        });
        const newMoves = [...match.moves, { position: move.position, playerId: move.playerId }];
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
          await prisma.match.update({
            where: { id: matchId },
            data: { status: "finished", winnerId, finishedAt: new Date() },
          });
          await updateStatsForFinishedMatch(match.playerXId, match.playerOId, winnerId);
        }
        const updatedMatch = await prisma.match.findUnique({
          where: { id: matchId },
          include: {
            moves: true,
            playerX: { select: { id: true, username: true } },
            playerO: { select: { id: true, username: true } },
          },
        });
        if (updatedMatch) {
          const state = buildMatchState(updatedMatch);
          broadcastMatch(matchId, { type: "match_state", ...state });
        }
        return;
      }

      send(socket, { type: "error", code: "unknown_type", message: "Unknown message type" });
    });

    socket.on("close", () => {
      if (currentMatchId) removeConnection(currentMatchId, socket);
    });
  });
}
