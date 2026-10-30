// @ts-check
// Sudoku on paper, half done on purpose: you finish it in the workshop.
// Print the sheet first: open print.html, print page 1 on A4 (top: the puzzle, bottom: empty, write your own).
// Open the page with #sudoku. Try it without a camera: "Sample photos" runs the pictures in replay/sudoku/.
// Run in a terminal (after pnpm install once):  node replay/run.js sudoku
//
// The rules of Sudoku
//   A 9 × 9 grid, split into nine 3 × 3 boxes. Some cells already hold a digit 1-9.
//   Fill every empty cell so that each row, each column and each 3 × 3 box holds every digit 1-9 exactly once.
//
// What is done:  finding the board (the black frame), straightening it, cutting it into 9 × 9 cells,
//                telling empty cells from written ones, drawing the cut grid.
// What is open:  TODO 1 in detect (which digit, with few-shot references) and TODO 2 in solve.
//
// The state (plain JSON) that detect() returns and solve() gets:
//   {
//     corners: [{ x, y }, ...] | null,  // the board's 4 corners in picture pixels: top-left, top-right,
//                                       // bottom-right, bottom-left; null when no board is seen
//     grid: [[5, 3, 0, ...], ...],      // 9 rows of 9 cells: 1-9 = the digit, 0 = empty, null = not read yet
//   }
//
// The move (plain JSON) that solve() returns and draw() gets:
//   { fills: [{ row, col, digit }] }   the digits for the empty cells (row 0 = top, col 0 = left), or null.

import { setInfo } from '../engine/actions.js';
import { boardPoint } from '../engine/geometry.js';
import { createAnchor } from '../engine/anchor.js';

/** @typedef {{ x: number, y: number }} Point */
/** @typedef {import('../engine/types.js').Frame} Frame */
/** @typedef {{ corners: Point[] | null, grid: (number | null)[][] }} SudokuState */
/** @typedef {{ fills: { row: number, col: number, digit: number }[] } | null} SudokuMove */

/** @type {import('../engine/types.js').GameConfig} */
export const config = {
  title: 'Sudoku',
};

// The print sheet: the black frame is 2.5 % of the board's side; the 9 × 9 cells fill the inside.
const SIZE = 540;              // the board is straightened to SIZE × SIZE pixels
const FRAME = 0.025;           // frame width, as a share of the side
const EMPTY_BELOW = 0.04;      // a cell with less ink than this share of its pixels is empty

// Live video: once the sheet is found, it is anchored (engine/anchor.js): the digits are read once, then only
// the sheet's position is followed, so the drawing does not flicker. The lock icon in the top bar reads again.
const anchor = createAnchor();

/**
 * @param {Frame} frame
 * @param {import('../engine/types.js').Engine} engine
 * @returns {Promise<SudokuState>}
 */
export async function detect(frame, engine) {
  return anchor.run(frame, () => readBoard(frame, engine));
}

/**
 * @param {Frame} frame
 * @param {import('../engine/types.js').Engine} engine
 * @returns {Promise<SudokuState>}
 */
async function readBoard(frame, engine) {
  const corners = await engine.findBoard(frame, { minArea: 0.05, darkFrame: true });
  if (!corners) return { corners: null, grid: [] };
  const board = await engine.straighten(frame, corners, SIZE, SIZE);
  const inside = engine.cropTiles(board, [{ x: SIZE * FRAME, y: SIZE * FRAME, width: SIZE * (1 - 2 * FRAME), height: SIZE * (1 - 2 * FRAME) }])[0];
  const paper = brightness(inside);
  // margin 0.15: cut 15 % off every side of a cell, so the grid lines do not count as ink.
  const cells = engine.cutTiles(inside, 9, 9, 0.15);
  const grid = cells.map((row) => row.map((cell) => {
    if (inkShare(cell, paper) < EMPTY_BELOW) return 0;
    return readDigit(cell, paper, engine);
  }));
  return { corners: corners.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })), grid };
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

// TODO 1 (digit): return 1-9 for a cell that has ink in it.
// Few-shot: you do not write rules for each digit. You show the computer a few example cells of each digit
// ("references"), and it picks the digit whose examples look most like this cell.
// Hint, with your printed sheet:
//   1. Open tiles.html, pick "a board (grid)", Rows 9, Cols 9, Margin 0.15, point the camera at the sheet (the black
//      frame is cut away for you), tap a cell and name its digit ("1" … "9"). Do 2-3 cells per digit.
//   2. Export the JSON and save it as games/sudoku.refs.json.
//   3. Here: load it once (keep it in a variable outside this function):
//        refs ??= await engine.fetchReferences(new URL('./sudoku.refs.json', import.meta.url));
//      then  const found = await engine.classify(cell, refs);  → { label, score } or null.
//      Return Number(found.label), or null when found.score is low (below about 0.6: not sure).
//      (detect is async, so you may make this function async and write  await readDigit(...)  above.)
// Without a camera (node, the replay pictures): engine.pixelEmbedding(cell) + engine.matchTile(embedding, refs)
// work the same way, with references you make from cells of the replay pictures (replay/sudoku/*.truth.json
// says which digit is where).
// Tip: a digit written a bit to the side looks different to the computer. Cut the cell down to the box
// around its ink pixels (isInk) before you compare.
/** @param {Frame} cell @param {number} paper @param {import('../engine/types.js').Engine} engine */
function readDigit(cell, paper, engine) {
  return null;
}

// TODO 2 (solve): fill the empty cells and return { fills: [{ row, col, digit }] }, or null if you cannot.
// Hint ("backtracking", the usual way, about 20 lines):
//   - Copy the grid. Return null if any cell is still null (a digit not read).
//   - canPut(grid, row, col, digit): false if the digit is already in that row, that column, or that 3 × 3
//     box (the box starts at row - row % 3, col - col % 3).
//   - fill(grid): find the first empty cell (0). None left → true (solved). Otherwise try digit 1 … 9:
//     if canPut, write it and call fill(grid) again; if that gives true, return true; else set the cell
//     back to 0 and try the next digit. No digit works → false.
//   - If fill(copy) is true, list every cell that was 0 in state.grid with its digit from the copy.
// Keep it pure: no engine, no picture, only the state.
/**
 * @param {SudokuState} state
 * @returns {SudokuMove}
 */
export function solve(state) {
  return null;
}

// Draws the cut grid on the picture (cyan), each read digit small in its cell ('?' = not read yet) and
// the solution digits big (yellow). You do not need to change this, but you may.
/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {SudokuState} state
 * @param {SudokuMove} move
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
  setInfo('Sudoku');
  const at = (row, col) => cellPoint(state.corners, row, col);
  ctx.strokeStyle = '#22d3ee';
  for (let i = 0; i <= 9; i++) {
    ctx.lineWidth = Math.max(1, ctx.canvas.width / (i % 3 === 0 ? 300 : 900));
    line(ctx, at(i - 0.5, -0.5), at(i - 0.5, 8.5));
    line(ctx, at(-0.5, i - 0.5), at(8.5, i - 0.5));
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${size * 0.8}px system-ui, sans-serif`;
  state.grid.forEach((row, r) => row.forEach((digit, c) => {
    if (digit === 0) return;
    const p = at(r - 0.3, c - 0.3);
    ctx.fillStyle = digit === null ? '#f87171' : '#22d3ee';
    ctx.fillText(digit === null ? '?' : String(digit), p.x, p.y);
  }));
  ctx.font = `bold ${size * 1.2}px system-ui, sans-serif`;
  ctx.fillStyle = '#facc15';
  for (const { row, col, digit } of move?.fills ?? []) {
    const p = at(row, col);
    ctx.fillText(String(digit), p.x, p.y);
  }
  ctx.restore();
}

// The middle of cell (row, col) in picture pixels. Halves work too: row - 0.5 is the cell's top edge.
/** @param {Point[]} corners @param {number} row @param {number} col */
function cellPoint(corners, row, col) {
  const across = (i) => FRAME + ((1 - 2 * FRAME) * (i + 0.5)) / 9;
  return boardPoint(corners, across(col), across(row));
}

/** @param {CanvasRenderingContext2D} ctx @param {Point} a @param {Point} b */
function line(ctx, a, b) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}
