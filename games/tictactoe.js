// @ts-check
// Tic-Tac-Toe on paper (print page 2 of print.html): reads the X and O, suggests the best move.
// Learning track 1, lesson: workshop/learn/tictactoe.md. Check your work: pnpm learn tictactoe --watch
// Done: find the board, straighten it, cut 3 × 3 cells, empty or not. Open: TODO 1 (X or O), TODO 2 (best move).
// State (plain JSON): { corners: 4 points or null, cells: 3 rows of 'X' | 'O' | '' (empty) | null (not read) }.
// Move: { row, col, player } or null (game over or not read yet).

import { setInfo } from '../engine/actions.js';
import { boardPoint } from '../engine/geometry.js';
import { createAnchor } from '../engine/anchor.js';

/** @typedef {{ x: number, y: number }} Point */
/** @typedef {import('../engine/types.js').Frame} Frame */
/** @typedef {{ corners: Point[] | null, cells: (string | null)[][] }} TicTacToeState */
/** @typedef {{ row: number, col: number, player: string } | null} TicTacToeMove */

/** @type {import('../engine/types.js').GameConfig} */
export const config = {
  title: 'Tic-Tac-Toe',
};

// The print sheet: the black frame is 2.5 % of the board's side; the 3 × 3 cells fill the inside.
const SIZE = 360;              // the board is straightened to SIZE × SIZE pixels
const FRAME = 0.025;           // frame width, as a share of the side
const EMPTY_BELOW = 0.03;      // a cell with less ink than this share of its pixels is empty

// Live video: the sheet's position stays locked; the marks are read again on every detect (reread).
const anchor = createAnchor();

/**
 * @param {Frame} frame
 * @param {import('../engine/types.js').Engine} engine
 * @returns {Promise<TicTacToeState>}
 */
export async function detect(frame, engine) {
  return anchor.run(frame, () => readBoard(frame, engine), { reread: true });
}

/**
 * @param {Frame} frame
 * @param {import('../engine/types.js').Engine} engine
 * @returns {Promise<TicTacToeState>}
 */
async function readBoard(frame, engine) {
  const corners = await engine.findBoard(frame, { minArea: 0.05, darkFrame: true });
  if (!corners) return { corners: null, cells: [] };
  const board = await engine.straighten(frame, corners, SIZE, SIZE);
  const inside = engine.cropTiles(board, [{ x: SIZE * FRAME, y: SIZE * FRAME, width: SIZE * (1 - 2 * FRAME), height: SIZE * (1 - 2 * FRAME) }])[0];
  const paper = brightness(inside);
  const margin = 0.1; // cut 10 % off every cell side, so grid lines are not ink
  const cells = engine.cutTiles(inside, 3, 3, margin).map((row) => row.map((cell) => {
    if (inkShare(cell, paper) < EMPTY_BELOW) return '';
    return readMark(cell, paper);
  }));
  return { corners: corners.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })), cells };
}

// Average brightness (0 = black, 255 = white) of an image. On the board that is about the paper.
/** @param {Frame} image */
function brightness(image) {
  let sum = 0;
  for (let i = 0; i < image.data.length; i += 4) sum += image.data[i] + image.data[i + 1] + image.data[i + 2];
  return sum / (image.data.length / 4) / 3;
}

// True when the pixel at (x, y) is ink: clearly darker than the paper.
/** @param {Frame} image @param {number} x @param {number} y @param {number} paper */
export function isInk(image, x, y, paper) {
  const i = (y * image.width + x) * 4;
  return (image.data[i] + image.data[i + 1] + image.data[i + 2]) / 3 < paper * 0.6;
}

// Share of ink pixels in an image (0 … 1).
/** @param {Frame} image @param {number} paper */
function inkShare(image, paper) {
  let ink = 0;
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) if (isInk(image, x, y, paper)) ink++;
  return ink / (image.width * image.height);
}

// TODO 1: return 'X' or 'O' for a cell with ink in it (null if unsure). Lesson: workshop/learn/tictactoe.md#todo-1
/** @param {Frame} cell @param {number} paper */
function readMark(cell, paper) {
  return null;
}

// TODO 2: return the best move for the player to move, or null. Lesson: workshop/learn/tictactoe.md#todo-2
/**
 * @param {TicTacToeState} state
 * @returns {TicTacToeMove}
 */
export function solve(state) {
  return null;
}

// Draws the cut grid (cyan), each read mark small ('?' = not read) and the suggested move big (yellow).
/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {TicTacToeState} state
 * @param {TicTacToeMove} move
 */
export function draw(ctx, state, move) {
  const size = Math.max(14, ctx.canvas.width / 32);
  ctx.save();
  ctx.font = `${size * 1.4}px system-ui, sans-serif`;
  ctx.fillStyle = '#ffffff';
  if (!state.corners) {
    setInfo('No sheet found: the whole black frame must be in the picture'); // the corner chip, not on the picture
    ctx.restore();
    return;
  }
  setInfo(move ? `${move.player} to play` : 'No move (game over, or not read yet)');
  const at = (row, col) => cellPoint(state.corners, row, col);
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = Math.max(2, ctx.canvas.width / 300);
  for (let i = 0; i <= 3; i++) {
    line(ctx, at(i - 0.5, -0.5), at(i - 0.5, 2.5));
    line(ctx, at(-0.5, i - 0.5), at(2.5, i - 0.5));
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  state.cells.forEach((row, r) => row.forEach((mark, c) => {
    if (mark === '') return;
    const p = at(r - 0.3, c - 0.3);
    ctx.fillStyle = mark === null ? '#f87171' : '#22d3ee';
    ctx.fillText(mark ?? '?', p.x, p.y);
  }));
  if (move) {
    const p = at(move.row, move.col);
    ctx.font = `bold ${size * 3}px system-ui, sans-serif`;
    ctx.fillStyle = '#facc15';
    ctx.fillText(move.player, p.x, p.y);
  }
  ctx.restore();
}

// Middle of cell (row, col) in picture pixels; row - 0.5 is the cell's top edge.
/** @param {Point[]} corners @param {number} row @param {number} col */
function cellPoint(corners, row, col) {
  const across = (i) => FRAME + ((1 - 2 * FRAME) * (i + 0.5)) / 3;
  return boardPoint(corners, across(col), across(row));
}

/** @param {CanvasRenderingContext2D} ctx @param {Point} a @param {Point} b */
function line(ctx, a, b) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}
