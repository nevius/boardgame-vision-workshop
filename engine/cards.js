// @ts-check
// Building block "cards": find many cards (or one framed card), keep the card-sized ones, straighten each one
// lying on its long side. From Set (many cards) and Ubongo (one card with a coloured frame).
//
//   const quads = cardSized(await engine.findCards(frame));            // cards that touch are cut apart
//   const image = await straightLying(frame, quads[0], 300, 200);      // always lying: 300 wide, 200 high
//   const card = findColorFrame(frame, 'red');                         // corners of a card with a red frame, or null
//
// Corners are 4 points { x, y } in picture pixels: top-left, top-right, bottom-right, bottom-left.
// Used by solutions/set.js and games/set.js (cardSized, straightLying) and games/ubongo.js (findColorFrame).
// Limits: cards should not overlap (touching is fine: up to 3 in a row or 2 × 2 are cut apart); cardSized needs most found shapes to be cards (it takes their middle size);
// straightLying does not know which short side is "up" (a card may come out upside down).

import { colorName } from './tiles.js';
import { straighten } from './warp.js';
import { readingOrder } from './geometry.js';

/** @typedef {{ x: number, y: number }} Point */
/** @typedef {import('./types.js').Frame} Frame */

/** @param {Point} a @param {Point} b @param {number} t */
const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
/** @param {number[]} values */
const median = (values) => [...values].sort((a, b) => a - b)[values.length >> 1] ?? 0;

// Cards further away look smaller: cardSized allows 30 % off the middle size.
const SIZE_SLACK = 0.3;

// Keeps the shapes that have the size of a card (most found shapes are cards, so their middle size is
// the card size). A shape of two or three cards that touch (or 2 × 2) is cut into single cards; others are dropped.
// A shape that fits as one card stays whole (near cards look bigger). Only when it does not, of all cuts that fit,
// the one whose parts are closest to the card size wins (2 × 2 and 3 in a row can both fit).
// When a shape was cut, the cards are put in reading order again (rows top to bottom, left to right), so the
// cut-apart cards do not stay together in the list.
/** @param {Point[][]} quads @returns {Point[][]} */
export function cardSized(quads) {
  const across = (q) => Math.hypot(q[1].x - q[0].x, q[1].y - q[0].y);
  const down = (q) => Math.hypot(q[2].x - q[1].x, q[2].y - q[1].y);
  const long = median(quads.map((q) => Math.max(across(q), down(q))));
  const short = median(quads.map((q) => Math.min(across(q), down(q))));
  const off = (a, b) => Math.abs(Math.max(a, b) / long - 1) + Math.abs(Math.min(a, b) / short - 1);
  const fits = (a, b) => Math.abs(Math.max(a, b) / long - 1) < SIZE_SLACK && Math.abs(Math.min(a, b) / short - 1) < SIZE_SLACK;
  let cut = false;
  const cards = quads.flatMap((q) => {
    if (fits(across(q), down(q))) return [q];
    let best = null;
    for (const [n, m] of [[2, 1], [1, 2], [2, 2], [3, 1], [1, 3]]) {
      const a = across(q) / n, b = down(q) / m;
      if (fits(a, b) && (!best || off(a, b) < best.off)) best = { n, m, off: off(a, b) };
    }
    if (!best) return [];
    const { n, m } = best;
    cut = true;
    const at = (u, v) => mix(mix(q[0], q[1], u), mix(q[3], q[2], u), v); // u, v from 0 to 1 inside the shape
    const parts = [];
    for (let r = 0; r < m; r++) {
      for (let c = 0; c < n; c++) parts.push([at(c / n, r / m), at((c + 1) / n, r / m), at((c + 1) / n, (r + 1) / m), at(c / n, (r + 1) / m)]);
    }
    return parts;
  });
  return cut ? readingOrder(cards, Math.sqrt(long * short) / 2) : cards; // row tolerance as in findCards
}

// The card straightened lying on its long side (width × height, width the longer), also when it stands upright
// in the picture: then it is straightened standing (height wide) and turned a quarter.
// (straighten always puts the picture's top-left corner first, so turning the corners does not work.)
/** @param {Frame} frame @param {Point[]} c @param {number} width @param {number} height @returns {Promise<Frame>} */
export async function straightLying(frame, c, width, height) {
  const top = Math.hypot(c[1].x - c[0].x, c[1].y - c[0].y);
  const side = Math.hypot(c[2].x - c[1].x, c[2].y - c[1].y);
  if (top >= side) return straighten(frame, c, width, height);
  return turnQuarter(await straighten(frame, c, height, width));
}

// The image turned a quarter clockwise (width and height swap).
/** @param {Frame} image @returns {Frame} */
export function turnQuarter(image) {
  const { width, height, data } = image;
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const from = (y * width + x) * 4;
      const to = (x * height + (height - 1 - y)) * 4;
      for (let c = 0; c < 4; c++) out[to + c] = data[from + c];
    }
  }
  return { width: height, height: width, data: out };
}

// One card with a coloured frame (Ubongo 3D cards have a red frame around a black card). Pure, no OpenCV.
// Looks at every step-th pixel; the frame = thin patches of that colour (a frame, not a red piece) that
// together cover at least 5 % of the picture. Corners = the frame's outermost points.
// Returns null when there is no such frame (then use engine.findBoard).
/** @param {Frame} frame @param {string} color @returns {Point[] | null} */
export function findColorFrame(frame, color) {
  const step = Math.max(1, Math.round(Math.max(frame.width, frame.height) / 300));
  const w = Math.floor(frame.width / step);
  const h = Math.floor(frame.height / step);
  const d = frame.data;
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = ((y * step) * frame.width + x * step) * 4;
    const name = colorName({ r: d[i], g: d[i + 1], b: d[i + 2] });
    // Light red reads as pink; dull colours (a brown table) do not count.
    const strong = Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 60;
    if (strong && (name === color || (color === 'red' && name === 'pink'))) mask[y * w + x] = 1;
  }
  // Patches: samples of the colour up to 2 samples apart belong together (the frame has dark lines in it).
  const seen = new Uint8Array(w * h);
  /** @type {{ points: Point[], box: number[] }[]} */
  const patches = [];
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || seen[start]) continue;
    const points = [];
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const k = /** @type {number} */ (stack.pop());
      const x = k % w;
      const y = (k - x) / w;
      points.push({ x, y });
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        const n = ny * w + nx;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && mask[n] && !seen[n]) { seen[n] = 1; stack.push(n); }
      }
    }
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs) + 1, Math.max(...ys) + 1];
    // A piece of frame is thin: it fills at most half of its box. A red piece fills more.
    if (points.length >= 20 && points.length <= 0.5 * (box[2] - box[0]) * (box[3] - box[1])) patches.push({ points, box });
  }
  if (!patches.length) return null;
  // The frame can break into pieces (a gap in the print, a reflection): start with the biggest one and add
  // every other thin patch whose box comes near it (4 % of the picture).
  const size = (b) => (b[2] - b[0]) * (b[3] - b[1]);
  patches.sort((a, b) => size(b.box) - size(a.box));
  const best = { points: [...patches[0].points], box: [...patches[0].box] };
  const rest = patches.slice(1);
  const near = Math.round(Math.max(w, h) * 0.04);
  for (let added = true; added;) {
    added = false;
    for (let k = rest.length - 1; k >= 0; k--) {
      const b = rest[k].box;
      if (b[0] > best.box[2] + near || b[2] < best.box[0] - near || b[1] > best.box[3] + near || b[3] < best.box[1] - near) continue;
      best.points.push(...rest[k].points);
      best.box = [Math.min(best.box[0], b[0]), Math.min(best.box[1], b[1]), Math.max(best.box[2], b[2]), Math.max(best.box[3], b[3])];
      rest.splice(k, 1);
      added = true;
    }
  }
  if (size(best.box) < 0.05 * w * h) return null;
  const pick = (score) => best.points.reduce((a, b) => (score(b) > score(a) ? b : a));
  return [pick((p) => -p.x - p.y), pick((p) => p.x - p.y), pick((p) => p.x + p.y), pick((p) => p.y - p.x)]
    .map((p) => ({ x: (p.x + 0.5) * step, y: (p.y + 0.5) * step }));
}
