// Runs the board and card search on the pictures in replay/test/ and compares with the corners in <picture>.json.
// Needs the dev tools (OpenCV.js, image decoders): run pnpm install once. Without them these tests are skipped.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { findBoard, findCards, straighten, hasDarkFrame } from '../engine/warp.js';
import { isPhoto, expectedName } from '../engine/replay.js';
import { distance } from '../engine/geometry.js';

const folder = new URL('../replay/test/', import.meta.url);

const tools = await Promise.all([import('pngjs'), import('jpeg-js'), import('@techstark/opencv-js')])
  .catch(() => null);
const PNG = tools?.[0].PNG;
const jpeg = tools?.[1].default;
const skipped = () => {
  if (!tools) console.log('     skipped: run pnpm install first (OpenCV.js and image decoders are dev tools)');
  return !tools;
};

function load(name) {
  const bytes = readFileSync(new URL(name, folder));
  const image = name.endsWith('.png') ? PNG.sync.read(bytes) : jpeg.decode(bytes, { useTArray: true });
  return { width: image.width, height: image.height, data: new Uint8ClampedArray(image.data) };
}

// Every found corner within 2 % of the picture's diagonal of the true corner.
function assertClose(found, expected, frame, label) {
  const tolerance = 0.02 * Math.hypot(frame.width, frame.height);
  assert.ok(found, `${label}: nothing found`);
  found.forEach((p, i) => {
    const off = distance(p, expected[i]);
    assert.ok(off <= tolerance, `${label}: corner ${i + 1} is ${off.toFixed(1)} px off (allowed ${tolerance.toFixed(1)})`);
  });
}

export async function findsBoardsAndCardsInReplayPictures() {
  if (skipped()) return;
  const photos = readdirSync(folder).filter(isPhoto);
  assert.ok(photos.length >= 3, 'replay/test/ needs pictures');
  for (const photo of photos) {
    const frame = load(photo);
    const expected = JSON.parse(readFileSync(new URL(expectedName(photo), folder), 'utf8'));
    if ('board' in expected) {
      const corners = await findBoard(frame);
      if (expected.board === null) assert.equal(corners, null, `${photo}: found a board where there is none`);
      else assertClose(corners, expected.board, frame, photo);
    } else {
      const cards = await findCards(frame);
      assert.equal(cards.length, expected.cards.length, `${photo}: card count`);
      cards.forEach((card, i) => assertClose(card, expected.cards[i], frame, `${photo} card ${i + 1}`));
    }
  }
}

export async function straightensToTheAskedSize() {
  if (skipped()) return;
  const frame = load('board-angle.png');
  const expected = JSON.parse(readFileSync(new URL('board-angle.json', folder), 'utf8'));
  const board = await straighten(frame, expected.board, 400, 400);
  assert.equal(board.width, 400);
  assert.equal(board.height, 400);
  assert.equal(board.data.length, 400 * 400 * 4);
  // The 8×8 board: first square light, second square dark (each square is 400 × 0.1125 = 45 px, border 20 px).
  const brightness = (x, y) => board.data[(y * 400 + x) * 4];
  assert.ok(brightness(42, 42) > 180 && brightness(87, 42) < 90, 'squares not where expected');
}

// A straight 200 × 200 board: black frame of the given share of the side, white paper inside, one grid line
// every 1/9 (like the Sudoku sheet). frame 0 = plain paper.
function framedBoard(frame) {
  const data = new Uint8ClampedArray(200 * 200 * 4);
  for (let y = 0; y < 200; y++) {
    for (let x = 0; x < 200; x++) {
      const u = (x + 0.5) / 200, v = (y + 0.5) / 200;
      const edge = Math.min(u, v, 1 - u, 1 - v);
      const cell = (t) => Math.abs(((t - frame) / (1 - 2 * frame)) * 9 % 1) < 0.03;
      const ink = edge < frame || (edge >= frame && (cell(u) || cell(v)));
      data.fill(ink ? 25 : 235, (y * 200 + x) * 4, (y * 200 + x) * 4 + 3);
      data[(y * 200 + x) * 4 + 3] = 255;
    }
  }
  return { width: 200, height: 200, data };
}

export function darkFrameCheckTakesThinFrames() {
  for (const frame of [0.02, 0.025, 0.03]) assert.ok(hasDarkFrame(framedBoard(frame)), `frame ${frame * 100} %`);
  assert.equal(hasDarkFrame(framedBoard(0)), false, 'plain paper is not a framed board');
}
