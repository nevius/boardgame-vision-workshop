// @ts-check
// Set (the card game): finds the cards on the table, reads each card, shows every set.
// Learning track 2, lesson: workshop/learn/set.md. Check your work: pnpm learn set --watch
// Done: find the cards, straighten each one, white balance, draw. Open: TODO 1–4 read a card (colour, symbols, shape, fill),
// TODO 5–6 find the sets, TODO 7 steady labels on live video.
// State (plain JSON): { cards: [{ corners, color, number, shape, fill }] } in reading order; null = not read.
// Move: { sets: [[i, j, k], …] } (positions in state.cards), or null when there is no set.

import { setInfo } from '../engine/actions.js';
import { detailsOn, tapPoint, drawCallout } from '../engine/details.js';
import { pointInPolygon } from '../engine/geometry.js';
import { createAnchor, cardsBox } from '../engine/anchor.js';

/** @typedef {{ x: number, y: number }} Point */
/** @typedef {import('../engine/types.js').Frame} Frame */
/** @typedef {{ color: string | null, number: number | null, shape: string | null, fill: string | null }} Features */
/** @typedef {Features & { corners: Point[] }} Card */
/** @typedef {{ cards: Card[] }} SetState */
/** @typedef {{ sets: number[][] } | null} SetMove */
/** @typedef {{ x0: number, x1: number, y0: number, y1: number }} Box  a symbol's box, inclusive pixel bounds */

/** @type {import('../engine/types.js').GameConfig} */
export const config = {
  title: 'Set',
};

const CARD_WIDTH = 300;        // each card is straightened lying on its long side: symbols stand side by side
const CARD_HEIGHT = 200;
const EDGE = 15;               // pixels at the card's edge that never count (rounded corners, table)
const FEATURES = ['color', 'number', 'shape', 'fill']; // for TODO 5 and 7

// Live video: the cards' position stays locked; the cards are read again on every detect (reread).
const anchor = createAnchor();

/**
 * @param {Frame} frame
 * @param {import('../engine/types.js').Engine} engine
 * @returns {Promise<SetState>}
 */
export async function detect(frame, engine) {
  return anchor.run(frame, () => readCards(frame, engine), { reread: true, cornersOf: cardsBox });
}

/**
 * @param {Frame} frame
 * @param {import('../engine/types.js').Engine} engine
 * @returns {Promise<SetState>}
 */
async function readCards(frame, engine) {
  const cards = [];
  for (const corners of await engine.findCards(frame)) {
    const image = whiteBalance(await engine.straightLying(frame, corners, CARD_WIDTH, CARD_HEIGHT), engine);
    if (cards.length === 0) engine.showStep('card', image);
    cards.push({ corners: corners.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })), ...readCard(image, engine) });
  }
  return { cards };
}

/** @param {Frame} image @param {import('../engine/types.js').Engine} engine @returns {Features} */
function readCard(image, engine) {
  const boxes = findSymbols(image);
  const ok = boxes.length >= 1 && boxes.length <= 3;
  return {
    color: readColor(image, engine),
    number: ok ? boxes.length : null,
    shape: ok ? readShape(image, boxes[0]) : null,
    fill: ok ? readFill(image, boxes[0]) : null,
  };
}

// Done: white balance. Divides every pixel by the card's paper colour, so the paper becomes white under any light.
/** @param {Frame} image @param {import('../engine/types.js').Engine} engine @returns {Frame} */
function whiteBalance(image, engine) {
  const paper = engine.paperColor(image, EDGE);
  if (!paper) return image;
  const data = new Uint8ClampedArray(image.data.length);
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) data[i + c] = (image.data[i + c] * 255) / paper[c];
    data[i + 3] = 255;
  }
  return { width: image.width, height: image.height, data };
}

// True when the pixel at (x, y) is ink: dark, or coloured (a big gap between its largest and smallest of r, g, b).
/** @param {Frame} image @param {number} x @param {number} y */
export function isInk(image, x, y) {
  const i = (y * image.width + x) * 4;
  const d = image.data;
  const low = Math.min(d[i], d[i + 1], d[i + 2]);
  return low < 170 || Math.max(d[i], d[i + 1], d[i + 2]) - low > 60;
}

// TODO 1: return 'red', 'green' or 'purple' (null if unsure). Lesson: workshop/learn/set.md#todo-1
/** @param {Frame} image @param {import('../engine/types.js').Engine} engine @returns {string | null} */
function readColor(image, engine) {
  return null;
}

// TODO 2: return one box per symbol, left to right. Lesson: workshop/learn/set.md#todo-2
/** @param {Frame} image @returns {Box[]} */
export function findSymbols(image) {
  return [];
}

// TODO 3: return 'diamond', 'oval' or 'squiggle' for the symbol in box. Lesson: workshop/learn/set.md#todo-3
/** @param {Frame} image @param {Box} box @returns {string | null} */
function readShape(image, box) {
  return null;
}

// TODO 4: return 'solid', 'striped' or 'empty' for the symbol in box. Lesson: workshop/learn/set.md#todo-4
/** @param {Frame} image @param {Box} box @returns {string | null} */
function readFill(image, box) {
  return null;
}

// TODO 5: true when the three cards are a set. Lesson: workshop/learn/set.md#todo-5
/** @param {Features} a @param {Features} b @param {Features} c @returns {boolean} */
export function isSet(a, b, c) {
  return false;
}

// TODO 6: return every set as { sets: [[i, j, k], …] }, or null. Lesson: workshop/learn/set.md#todo-6
/**
 * @param {SetState} state
 * @returns {SetMove}
 */
export function solve(state) {
  return null;
}

// TODO 7: keep each card's features steady over the last frames. Lesson: workshop/learn/set.md#todo-7
/** @param {SetState} state @returns {SetState} */
export function steady(state) {
  return state;
}

// Outlines every card (white) and the cards of the first set (yellow). Labels: on a tap, or all in the Steps view.
/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {SetState} state
 * @param {SetMove} move
 */
export function draw(ctx, state, move) {
  const size = Math.max(14, ctx.canvas.width / 32);
  const set = move?.sets[0] ?? [];
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.font = `${size}px system-ui, sans-serif`;
  state.cards.forEach((card, i) => {
    const inSet = set.includes(i);
    ctx.strokeStyle = inSet ? '#facc15' : '#ffffff';
    ctx.lineWidth = Math.max(2, ctx.canvas.width / (inSet ? 120 : 300));
    ctx.beginPath();
    card.corners.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.stroke();
    if (!detailsOn()) return;
    const label = cardLabel(card);
    const { x, y } = card.corners[3];
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(x, y + 4, ctx.measureText(label).width + 8, size + 8);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, x + 4, y + size + 6);
  });
  const tap = tapPoint();
  const tapped = tap && state.cards.find((card) => pointInPolygon(tap, card.corners));
  if (tap && tapped) drawCallout(ctx, tap, cardLabel(tapped));
  const n = move?.sets.length ?? 0;
  setInfo(state.cards.length === 0 ? 'No cards found' : n ? `${n} set${n === 1 ? '' : 's'}` : `${state.cards.length} cards, no set yet`);
  ctx.restore();
}

/** @param {Card} card */
function cardLabel(card) {
  return [card.number, card.color, card.fill, card.shape].map((v) => v ?? '?').join(' ');
}
