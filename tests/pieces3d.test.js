// @ts-check
// engine/pieces3d.js: coloured pieces on a table → blobs → names from a catalogue (matched in 3D).
import assert from 'node:assert/strict';
import { findBlobs, nameBlobs, pieceCatalogue, tableCamera, otsu } from '../engine/pieces3d.js';
import { colorName } from '../engine/tiles.js';

const CELL = 40;
const pieces = {
  bar: { color: 'red', cubes: [[0, 0, 0], [0, 0, 1], [0, 0, 2]] },
  corner: { color: 'red', cubes: [[0, 0, 0], [0, 0, 1], [0, 1, 0]] },
  blue: { color: 'blue', cubes: [[0, 0, 0], [0, 0, 1]] },
};

// A grey table 600 × 600, a card (light) top left, a flat red bar of 3 squares lying across, lower right.
function drawTable() {
  const width = 600, height = 600;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const card = x < 200 && y < 200;
    const bar = x >= 300 && x < 300 + 3 * CELL && y >= 400 && y < 400 + CELL;
    data.set(bar ? [210, 30, 30, 255] : card ? [230, 230, 230, 255] : [90, 90, 90, 255], (y * width + x) * 4);
  }
  return { width, height, data };
}
const card = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }];

export function catalogueHasEveryTurnSeenFromAbove() {
  const catalogue = pieceCatalogue(pieces);
  assert.deepEqual(catalogue.map((p) => p.name), ['bar', 'corner', 'blue']);
  assert.equal(catalogue[0].turns.length, 3, 'a bar of 3: lying across, lying down, standing');
  const cam = tableCamera({ width: 600, height: 600 }, CELL);
  assert.deepEqual(cam.middle, { x: 300, y: 300 });
  assert.ok(cam.height > 5, 'the camera is well above the pieces');
}

export function findsAndNamesAPieceOnTheTable() {
  const frame = drawTable();
  const blobs = findBlobs(frame, card, CELL, { colors: new Set(['red', 'blue']), colorOf: colorName });
  assert.equal(blobs.length, 1, 'the bar (the light card does not count)');
  assert.equal(blobs[0].color, 'red');
  const [named] = nameBlobs(blobs, pieceCatalogue(pieces), tableCamera(frame, CELL));
  assert.equal(named.name, 'bar', JSON.stringify(named));
  assert.ok(named.options.every((o) => o.name !== 'blue'), 'only pieces of the blob colour');
}

export function otsuSplitsLightFromDark() {
  assert.equal(otsu([10, 12, 11, 200, 201]), (12 + 200) / 2);
  assert.equal(otsu([100, 101, 110]), null, 'too close together: no split');
}
