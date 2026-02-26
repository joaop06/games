/**
 * Tic-tac-toe game logic: board state, win/draw detection.
 * Board is an array of 9 cells: index 0-8, values "X" | "O" | null.
 */

export type Cell = "X" | "O" | null;
export type Board = [Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell];

const LINES: [number, number, number][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function emptyBoard(): Board {
  return [null, null, null, null, null, null, null, null, null];
}

/**
 * Build board from moves: even index (0,2,4...) = X, odd = O.
 * moves must be sorted by createdAt or by order.
 */
export function boardFromMoves(
  moves: { position: number; playerId: string }[],
  playerXId: string,
  playerOId: string
): Board {
  const board = emptyBoard();
  for (const m of moves) {
    const mark = m.playerId === playerXId ? "X" : m.playerId === playerOId ? "O" : null;
    if (mark !== null && board[m.position] === null) {
      board[m.position] = mark;
    }
  }
  return board;
}

export function getWinner(board: Board): "X" | "O" | null {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[b] === board[c]) {
      return board[a];
    }
  }
  return null;
}

export function isDraw(board: Board): boolean {
  return board.every((c) => c !== null) && getWinner(board) === null;
}

export function currentTurn(board: Board): "X" | "O" {
  let x = 0,
    o = 0;
  for (const c of board) {
    if (c === "X") x++;
    else if (c === "O") o++;
  }
  return x <= o ? "X" : "O";
}

export function isValidPosition(position: number): position is 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 {
  return Number.isInteger(position) && position >= 0 && position <= 8;
}
