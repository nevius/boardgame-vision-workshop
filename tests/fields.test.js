// @ts-check
// engine/fields.js: light squares on a dark card → grids, one per band (field).
import assert from 'node:assert/strict';
import { findFields, readGrid, countCells } from '../engine/fields.js';

const SQUARE = 40;
const LINE = 3;

// A dark card 400 × 600 with two shapes of light squares (thin dark lines between squares).
function drawCard() {
  const width = 400, height = 600;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let k = 0; k < width * height; k++) data.set([25, 25, 30, 255], k * 4);
  const shape = (grid, left, top) => grid.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch !== '#') return;
    for (let y = top + r * SQUARE + LINE; y < top + (r + 1) * SQUARE; y++) {
      for (let x = left + c * SQUARE + LINE; x < left + (c + 1) * SQUARE; x++) data.set([235, 235, 230, 255], (y * width + x) * 4);
    }
  }));
  shape(['.#..', '####', '##..'], 120, 100);
  shape(['###', '###', '#..'], 140, 380);
  return { width, height, data };
}

export function readsBothFields() {
  const fields = findFields(drawCard(), 0.1, 2);
  assert.deepEqual(fields.map((f) => f.grid), [['.#..', '####', '##..'], ['###', '###', '#..']]);
  const top = /** @type {NonNullable<typeof fields[0]['area']>} */ (fields[0].area);
  assert.ok(Math.abs(top.left - 120 / 400) < 0.03 && Math.abs(top.top - 100 / 600) < 0.03, JSON.stringify(top));
}

export function oneBandWhenAskedForOne() {
  const fields = findFields(drawCard(), 0.1, 1);
  assert.equal(fields.length, 1);
  assert.deepEqual(readGrid(drawCard(), 0.1, 0, 300).grid, ['.#..', '####', '##..'], 'rows 0–300 only: the top field');
}

// Glare away from the shape (more than half a square) is not part of it (issue #158).
export function leavesOutGlareBesideTheShape() {
  const card = drawCard();
  for (let y = 120; y < 200; y += 3) for (let x = 20; x < 80; x += 2) card.data.set([235, 235, 230, 255], (y * card.width + x) * 4);
  for (let y = 120; y < 200; y++) for (let x = 20; x < 80; x++) if (y % 6 < 4) card.data.set([235, 235, 230, 255], (y * card.width + x) * 4);
  assert.deepEqual(findFields(card, 0.1, 2)[0].grid, ['.#..', '####', '##..']);
}

export function countsSquaresByTheDipsBetweenThem() {
  const line = Array.from({ length: 100 }, (_, i) => (i % 25 < 3 ? 0 : 10)); // dips every 25: 4 squares
  assert.equal(countCells(line, 0, 100, 25), 4);
  assert.equal(countCells(line, 0, 100, 50), 2, 'dips for squares far from the expected size are left out');
  assert.equal(countCells(new Array(100).fill(10), 0, 100, 50), 2, 'no dips: size / fallback');
  assert.deepEqual(findFields({ width: 50, height: 50, data: new Uint8ClampedArray(50 * 50 * 4) }, 0.1), [], 'a black card has no fields');
}
