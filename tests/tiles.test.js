import assert from 'node:assert/strict';
import { cutTiles, cropTiles, dominantColor, averageColor, colorName, pixelEmbedding } from '../engine/tiles.js';
import { cosine, matchTile, referencesToJSON, referencesFromJSON } from '../engine/fewshot.js';
import { fakeBoard, splitReferences } from './fake-tiles.js';

// A width × height image filled with one colour.
function solid(width, height, [r, g, b]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) data.set([r, g, b, 255], i);
  return { width, height, data };
}

export function cutsTheBoardIntoAGrid() {
  const { image } = fakeBoard({ rows: 4, cols: 6, cell: 64 });
  const tiles = cutTiles(image, 4, 6);
  assert.equal(tiles.length, 4);
  assert.equal(tiles[0].length, 6);
  assert.equal(tiles[3][5].width, 64);
  assert.equal(tiles[3][5].height, 64);
  const small = cutTiles(image, { rows: 4, cols: 6, margin: 0.1 });
  assert.ok(Math.abs(small[0][0].width - 51) <= 1); // 80 % of 64, rounded
  // The tile is a real copy of the right pixels.
  const tile = tiles[1][2];
  const i = ((64 + 10) * image.width + 2 * 64 + 10) * 4; // pixel (10, 10) inside tile [1][2]
  assert.equal(tile.data[(10 * 64 + 10) * 4], image.data[i]);
}

export function cropsBoxesAndStaysInside() {
  const image = solid(100, 50, [10, 20, 30]);
  const [a, b] = cropTiles(image, [{ x: 10, y: 10, width: 20, height: 5 }, { x: 90, y: 40, width: 50, height: 50 }]);
  assert.equal(a.width, 20);
  assert.equal(a.height, 5);
  assert.equal(b.width, 10);
  assert.equal(b.height, 10);
}

export function namesColours() {
  assert.equal(colorName({ r: 220, g: 30, b: 30 }), 'red');
  assert.equal(colorName({ r: 30, g: 180, b: 40 }), 'green');
  assert.equal(colorName({ r: 30, g: 60, b: 210 }), 'blue');
  assert.equal(colorName({ r: 240, g: 220, b: 30 }), 'yellow');
  assert.equal(colorName({ r: 245, g: 245, b: 240 }), 'white');
  assert.equal(colorName({ r: 10, g: 10, b: 10 }), 'black');
  assert.equal(colorName({ r: 128, g: 128, b: 128 }), 'gray');
}

export function findsTheDominantColour() {
  const { image, labels } = fakeBoard();
  const tiles = cutTiles(image, 4, 6, 0.1);
  const dot = labels.flat().indexOf('dot');
  const tile = tiles[Math.floor(dot / 6)][dot % 6];
  assert.equal(dominantColor(tile).name, 'white');                     // mostly paper
  assert.equal(dominantColor(tile, { ignore: ['white'] }).name, 'red'); // the symbol
  assert.equal(averageColor(solid(4, 4, [200, 40, 40])).name, 'red');
}

export function knnPicksTheClosestLabel() {
  const refs = [
    { label: 'a', embedding: [1, 0] }, { label: 'a', embedding: [0.9, 0.1] },
    { label: 'b', embedding: [0, 1] }, { label: 'b', embedding: [0.1, 0.9] },
  ];
  assert.equal(cosine([1, 0], [2, 0]), 1);
  assert.equal(matchTile([0.8, 0.2], refs).label, 'a');
  assert.equal(matchTile([0.2, 0.8], refs).label, 'b');
  assert.ok(matchTile([0.2, 0.8], refs).score > 0.9);
  assert.equal(matchTile([1, 0], []), null);
}

// "Done when": with 3 references per class, the other tiles of the same image get the right label.
// Uses pixelEmbedding (no model in Node). tiles.html → "Self-test" runs the same with MediaPipe.
export function threeReferencesPerClassLabelTheRest() {
  const { image, labels } = fakeBoard();
  const tiles = cutTiles(image, 4, 6, 0.08);
  const { references, rest } = splitReferences(labels, 3);
  const refs = references.map(({ label, row, col }) => ({ label, embedding: pixelEmbedding(tiles[row][col]) }));
  assert.equal(refs.length, 9);
  assert.ok(rest.length >= 12);
  for (const { label, row, col } of rest) {
    assert.equal(matchTile(pixelEmbedding(tiles[row][col]), refs).label, label, `tile ${row},${col}`);
  }
}

export function referencesRoundTripAsJSON() {
  const refs = [{ label: 'queen', embedding: [0.123456, -0.5], thumb: 'data:image/png;base64,xx' }, { label: 'pawn', embedding: [1, 0] }];
  const back = referencesFromJSON(referencesToJSON(refs));
  assert.deepEqual(back, [{ label: 'queen', embedding: [0.1235, -0.5], thumb: 'data:image/png;base64,xx' }, { label: 'pawn', embedding: [1, 0] }]);
  assert.throws(() => referencesFromJSON('{"nope": 1}'), /references/);
  assert.throws(() => referencesFromJSON('{"references": [{"label": 3}]}'), /label/);
}
