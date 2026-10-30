// @ts-check
// Qwirkle (the tile game), half done on purpose: you finish it in the workshop.
// Open the page with #qwirkle. Try it without a camera: "Sample photos" runs the pictures in replay/qwirkle/.
// Run in a terminal (after pnpm install once):  node replay/run.js qwirkle
//
// The rules of Qwirkle (the parts we need)
//   Every tile has a colour and a shape, six of each:
//     color: red, orange, yellow, green, blue, purple
//     shape: circle, square, diamond, clover, star, cross (a four-pointed star)
//   Tiles lie in a grid. Every row and every column of touching tiles (a "line") must be all the same
//   colour (each shape at most once) or all the same shape (each colour at most once). So a line has at most 6 tiles.
//   On your turn you put one or more tiles from your hand into ONE line, touching tiles that are already there.
//   Points: every line your tiles are part of scores its full length (lines of one tile score nothing).
//   A full line of 6 tiles is a "Qwirkle": 6 extra points.
//
// There is no board to straighten: the tiles lie on the table, so the grid comes from the tiles themselves.
// What is done:  finding the tiles, the grid (row and column of each tile), the colour, drawing.
// What is open:  TODO 1 in detect (shape, with few-shot references), TODO 2 (which tiles are your hand)
//                and TODO 3 in solve (points and the best move).
//
// The state (plain JSON) that detect() returns and solve() gets:
//   {
//     grid: { x, y, step, angle } | null,   // centre of cell row 0, col 0 in picture pixels; distance between
//                                           // cell centres in pixels; how much the grid is turned (radians)
//     tiles: [                              // tiles on the table
//       {
//         row: 0, col: 0,                   // place in the grid; row 0 is the top row, col 0 the left column
//         corners: [{ x, y }, ...],         // 4 corners in picture pixels: top-left, top-right, bottom-right, bottom-left
//         color: 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | null,
//         shape: 'circle' | 'square' | 'diamond' | 'clover' | 'star' | 'cross' | null,
//       },
//     ],
//     hand: [ { color, shape, corners } ],  // the tiles you may play (TODO 2), empty for now
//   }
//   null means "not read yet / not sure".
//
// The move (plain JSON) that solve() returns and draw() gets:
//   { tiles: [{ row, col, color, shape }], score }   where to put which tiles, and the points; or null.

/** @typedef {{ x: number, y: number }} Point */
/** @typedef {{ x: number, y: number, step: number, angle: number }} Grid */
/** @typedef {{ row: number, col: number, corners: Point[], color: string, shape: string }} Tile */
/** @typedef {{ color: string, shape: string, corners: Point[] }} HandTile */
/** @typedef {import('../engine/types.js').Frame} Frame */
/** @typedef {{ grid: Grid | null, tiles: Tile[], hand: HandTile[] }} QwirkleState */
/** @typedef {{ tiles: { row: number, col: number, color: string, shape: string }[], score: number } | null} QwirkleMove */

/** @type {import('../engine/types.js').GameConfig} */
import { setInfo } from '../engine/actions.js';
import { detailsOn, tapPoint, drawCallout } from '../engine/details.js';
import { pointInPolygon } from '../engine/geometry.js';
export const config = {
  title: 'Qwirkle',
};

const TILE_SIZE = 96; // every tile is straightened to this many pixels, square

/**
 * @param {Frame} frame
 * @param {import('../engine/types.js').Engine} engine
 * @returns {Promise<QwirkleState>}
 */
export async function detect(frame, engine) {
  const quads = splitTouching(await engine.findCards(frame));
  const grid = gridFromTiles(quads);
  const tiles = [];
  for (const corners of quads) {
    const image = await engine.straighten(frame, corners, TILE_SIZE, TILE_SIZE);
    const { row, col } = cellOf(grid, middle(corners));
    tiles.push({
      row,
      col,
      corners: corners.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })),
      color: readColor(image, engine),
      shape: await readShape(image, engine),
    });
  }
  return { grid, tiles, hand: [] }; // TODO 2: fill hand
}

// ---------- Done: the grid ----------

// Tiles that touch each other are often found as one long shape (two or three tiles in a row).
// Such a shape is cut into single tiles: a 1 × 2 shape becomes two tiles, and so on.
/** @param {Point[][]} quads */
export function splitTouching(quads) {
  if (quads.length === 0) return [];
  const size = median(quads.map((q) => Math.min(side(q[0], q[1]), side(q[1], q[2]))));
  return quads.flatMap((q) => {
    const across = Math.max(1, Math.round(side(q[0], q[1]) / size));
    const down = Math.max(1, Math.round(side(q[1], q[2]) / size));
    const at = (u, v) => mix(mix(q[0], q[1], u), mix(q[3], q[2], u), v); // a point inside the shape, u, v from 0 to 1
    const parts = [];
    for (let r = 0; r < down; r++) {
      for (let c = 0; c < across; c++) {
        parts.push([at(c / across, r / down), at((c + 1) / across, r / down),
          at((c + 1) / across, (r + 1) / down), at(c / across, (r + 1) / down)]);
      }
    }
    return parts;
  });
}

// The grid from the tile positions: how far apart neighbouring tiles are (step), how much the tiles are
// turned (angle), and where cell row 0, col 0 is (x, y). Returns null without tiles.
/** @param {Point[][]} quads @returns {Grid | null} */
export function gridFromTiles(quads) {
  if (quads.length === 0) return null;
  const centers = quads.map(middle);
  // Turn of each tile from its top edge, folded into -45° … 45° (a square looks the same turned by 90°).
  const angle = median(quads.map((q) => {
    const a = Math.atan2(q[1].y - q[0].y, q[1].x - q[0].x);
    return a - Math.round(a / (Math.PI / 2)) * (Math.PI / 2);
  }));
  // Step: distance to the nearest other tile (most tiles have a neighbour). One tile: its own size.
  const nearest = centers.map((p, i) => Math.min(...centers.filter((_, j) => j !== i).map((q) => side(p, q))));
  const step = centers.length > 1 ? median(nearest) : side(quads[0][0], quads[0][1]);
  // Rough cells counted from the first tile, then moved so the smallest row and column are 0.
  let grid = { x: centers[0].x, y: centers[0].y, step, angle };
  const cells = centers.map((p) => cellOf(grid, p));
  const minRow = Math.min(...cells.map((c) => c.row));
  const minCol = Math.min(...cells.map((c) => c.col));
  // Fine-tune: cell (0, 0) is where all tiles agree on, on average.
  let x = 0;
  let y = 0;
  centers.forEach((p, i) => {
    const offset = cellOffset(grid, cells[i].row - minRow, cells[i].col - minCol);
    x += p.x - offset.x;
    y += p.y - offset.y;
  });
  return { x: x / centers.length, y: y / centers.length, step, angle };
}

// Picture point → { row, col } of the nearest cell.
/** @param {Grid} grid @param {Point} p */
export function cellOf(grid, p) {
  const dx = p.x - grid.x;
  const dy = p.y - grid.y;
  const cos = Math.cos(grid.angle);
  const sin = Math.sin(grid.angle);
  return {
    row: Math.round((-dx * sin + dy * cos) / grid.step) + 0, // + 0 turns -0 into 0
    col: Math.round((dx * cos + dy * sin) / grid.step) + 0,
  };
}

// { row, col } → the centre of that cell in picture pixels.
/** @param {Grid} grid @param {number} row @param {number} col */
export function cellCenter(grid, row, col) {
  const offset = cellOffset(grid, row, col);
  return { x: grid.x + offset.x, y: grid.y + offset.y };
}

// { row, col } → the 4 corners of that cell (top-left, top-right, bottom-right, bottom-left), for drawing.
/** @param {Grid} grid @param {number} row @param {number} col */
export function cellCorners(grid, row, col) {
  return [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].map(([c, r]) => cellCenter(grid, row + r, col + c));
}

/** @param {Grid} grid @param {number} row @param {number} col */
function cellOffset(grid, row, col) {
  const cos = Math.cos(grid.angle);
  const sin = Math.sin(grid.angle);
  return { x: (col * cos - row * sin) * grid.step, y: (col * sin + row * cos) * grid.step };
}

/** @param {Point[]} q */
function middle(q) {
  return { x: q.reduce((s, p) => s + p.x, 0) / q.length, y: q.reduce((s, p) => s + p.y, 0) / q.length };
}
/** @param {Point} a @param {Point} b */
function side(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
/** @param {Point} a @param {Point} b @param {number} t */
function mix(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
/** @param {number[]} list */
function median(list) {
  const sorted = [...list].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

// ---------- Done: the colour ----------

// The colour of the symbol. The black tile and gray shadows are skipped; the most common colour wins.
// A little border is cut away first, so the table at the rounded corners does not count.
/** @param {Frame} image */
function readColor(image, engine) {
  const inner = engine.cropTiles(image, [{ x: 10, y: 10, width: TILE_SIZE - 20, height: TILE_SIZE - 20 }])[0];
  const main = engine.dominantColor(inner, { ignore: ['white', 'gray', 'black'] });
  if (!main) return null;
  if (main.name === 'pink') return 'red';
  if (main.name === 'cyan') return 'blue';
  return ['red', 'orange', 'yellow', 'green', 'blue', 'purple'].includes(main.name) ? main.name : null;
}

// True when the pixel at (x, y) is "ink" (the coloured symbol), false for the black tile.
// Coloured pixels have a big gap between their largest and smallest of r, g, b.
/** @param {Frame} image */
export function isInk(image, x, y) {
  const i = (y * image.width + x) * 4;
  const d = image.data;
  return Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 60;
}

// TODO 1 (shape): return 'circle', 'square', 'diamond', 'clover', 'star' or 'cross'.
// Few-shot: you do not write rules for each shape. You show the computer a few example tiles of each
// shape ("references"), and it picks the shape whose examples look most like this tile.
// Hint, with real tiles:
//   1. Open tiles.html, point the camera at your tiles, tap a tile and name its shape. Do 2-3 per shape.
//   2. Export the JSON and save it as games/qwirkle.refs.json.
//   3. Here: load it once (keep it in a variable outside this function):
//        refs ??= await engine.fetchReferences(new URL('./qwirkle.refs.json', import.meta.url));
//      then  const found = await engine.classify(image, refs);  → { label, score } or null.
//      Return found.label, or null when found.score is low (below about 0.6: not sure).
// Tip: the colour gets in the way (a red circle looks less like a blue circle). Make a copy of the image
// where isInk() pixels are white and all others black, and use that copy for the references and here.
// Without a camera (node, the replay pictures): engine.pixelEmbedding(image) + engine.matchTile(embedding, refs)
// work the same way, with references you make from the replay pictures (see replay/qwirkle/*.truth.json).
/** @param {Frame} image */
async function readShape(image, engine) {
  return null;
}

// TODO 2 (hand): which tiles are yours to play? Return them in state.hand and leave only the board in
// state.tiles. Pick one way:
// - Lay your hand in a row below the board, with an empty row between (like the replay pictures).
//   Tiles that touch (row/column neighbours) form a group; the lowest group (largest row) is the hand.
// - Or a second photo of just your hand: keep the board from the first photo in a variable outside detect().
// - Or tap: config.hands = false and an on-screen picker. (More work; the first way is enough.)

// TODO 3 (solve): find the move with the most points and return { tiles: [{ row, col, color, shape }], score }.
// Hint, step by step:
//   1. Put the board into a Map: key `${row},${col}` → tile. Empty board: the first tile goes to row 0, col 0.
//   2. A line through a cell: walk left and right (or up and down) while there are tiles.
//      A line is fine when it has at most 6 tiles, no tile twice, and all one colour or all one shape.
//   3. Points of a move: add the length of every line (2 tiles or more) that a new tile is part of, each line
//      once, plus 6 for each line of 6. Moves where any line is not fine are not allowed.
//   4. Try every empty cell next to a tile with every tile of your hand. Then add more hand tiles at the
//      ends of the same line, as long as everything stays fine. Keep the move with the most points.
// Keep it pure: no engine, no picture, only the state. solutions/ has a finished version for the owner.
/**
 * @param {QwirkleState} state
 * @returns {QwirkleMove}
 */
export function solve(state) {
  return null;
}

// Draws clean outlines of the tiles and the suggested move in yellow. A tap on a tile shows its name; the grid
// lines and all labels show only in the Steps view (engine/details.js). You do not need to change this, but you may.
/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {QwirkleState} state
 * @param {QwirkleMove} move
 */
export function draw(ctx, state, move) {
  const size = Math.max(14, ctx.canvas.width / 40);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.font = `${size}px system-ui, sans-serif`;
  /** @param {Point[]} points */
  const outline = (points) => {
    ctx.beginPath();
    points.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.stroke();
  };
  const { grid, tiles } = state;
  if (grid && tiles.length > 0) {
    // The grid: every cell from one row/column before the first tile to one after the last.
    const rows = tiles.map((t) => t.row);
    const cols = tiles.map((t) => t.col);
    const details = detailsOn(); // Steps view open: grid lines and every label
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1;
    for (let r = Math.min(...rows) - 1; details && r <= Math.max(...rows) + 1; r++) {
      for (let c = Math.min(...cols) - 1; c <= Math.max(...cols) + 1; c++) outline(cellCorners(grid, r, c));
    }
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, ctx.canvas.width / 300);
    tiles.forEach((t) => outline(cellCorners(grid, t.row, t.col)));
    const small = Math.max(10, grid.step / 7); // labels fit inside a tile
    ctx.font = `${small}px system-ui, sans-serif`;
    for (const t of details ? tiles : []) {
      const label = `${t.row},${t.col} ${t.color ?? '?'} ${t.shape ?? '?'}`;
      const { x, y } = cellCorners(grid, t.row, t.col)[3];
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(x, y - small - 4, ctx.measureText(label).width + 6, small + 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, x + 3, y - 4);
    }
    ctx.font = `${size}px system-ui, sans-serif`;
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = Math.max(3, ctx.canvas.width / 120);
    for (const t of move?.tiles ?? []) {
      outline(cellCorners(grid, t.row, t.col));
      const { x, y } = cellCenter(grid, t.row, t.col);
      ctx.fillStyle = '#facc15';
      ctx.fillText(`${t.color} ${t.shape}`, x - grid.step / 2 + 4, y);
    }
    // A tap on a tile: its name in a small callout.
    const tap = tapPoint();
    const tapped = tap && tiles.find((t) => pointInPolygon(tap, cellCorners(grid, t.row, t.col)));
    if (tap && tapped) drawCallout(ctx, tap, `${tapped.color ?? '?'} ${tapped.shape ?? '?'}`);
  }
  for (const t of state.hand) {
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = Math.max(2, ctx.canvas.width / 300);
    outline(t.corners);
  }
  // The line for the corner chip (engine/actions.js), not on the picture.
  setInfo(tiles.length === 0 ? 'No tiles found' : move ? `Best move: ${move.score} points` : `${tiles.length} tiles, no move yet`);
  ctx.restore();
}
