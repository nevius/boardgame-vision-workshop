// @ts-check
// engine/pictures.js: small pictures on a card → patches, groups, cut-outs, and names by reference cut-outs.
import assert from 'node:assert/strict';
import { findPatches, groupNear, boxReadingOrder, cutOut, toRef, fromRef, likeness, rankByRefs, bestCombination, SIZE } from '../engine/pictures.js';
import { colorName } from '../engine/tiles.js';

// A black card 400 × 400 with coloured squares of `side` pixels at the given places.
function drawCard(squares, side = 20) {
  const width = 400, height = 400;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let k = 0; k < width * height; k++) data.set([10, 10, 10, 255], k * 4);
  for (const { x, y, rgb, w = side, h = side } of squares) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) data.set([...rgb, 255], (j * width + i) * 4);
  }
  return { width, height, data };
}
const RED = [220, 30, 30];
const BLUE = [30, 60, 220];

export function findsPicturesOfPictureSize() {
  const card = drawCard([{ x: 50, y: 50, rgb: RED }, { x: 100, y: 50, rgb: BLUE }, { x: 50, y: 200, rgb: RED, w: 200, h: 8 }, { x: 300, y: 300, rgb: RED, w: 4, h: 4 }]);
  const patches = findPatches(card, { colorOf: colorName });
  assert.deepEqual(patches.map((p) => p.color), ['red', 'blue'], 'a long line and a speck are no pictures');
  assert.deepEqual(patches[0].box, [50, 50, 70, 70]);
}

export function groupsNearPatchesInReadingOrder() {
  const items = [[300, 10], [10, 10], [40, 10], [330, 10], [10, 300]].map(([x, y]) => ({ box: [x, y, x + 20, y + 20] }));
  const groups = groupNear(items, 3);
  assert.deepEqual(groups.map((g) => g.items.length), [2, 2, 1]);
  assert.deepEqual(groups.map((g) => g.box[0]), [10, 300, 10], 'top row left to right, then the next row');
  assert.deepEqual(boxReadingOrder([{ box: [50, 0, 60, 10] }, { box: [0, 2, 10, 12] }]).map((g) => g.box[0]), [0, 50]);
}

export function cutOutsMatchTheirOwnShape() {
  // An L of red, and a bar of red.
  const card = drawCard([{ x: 50, y: 50, rgb: RED, w: 10, h: 30 }, { x: 60, y: 70, rgb: RED, w: 10, h: 10 }, { x: 200, y: 50, rgb: RED, w: 10, h: 30 }]);
  const red = (r, g, b) => colorName({ r, g, b }) === 'red';
  const l = cutOut(card, [50, 50, 70, 80], red);
  const bar = cutOut(card, [200, 50, 210, 80], red);
  assert.ok(l && bar);
  assert.equal(l.cover.length, SIZE * SIZE);
  assert.equal(cutOut(card, [300, 300, 320, 320], red), null, 'nothing there');
  const refs = [{ piece: 'L', ...toRef(l) }, { piece: 'bar', ...toRef(bar) }];
  assert.ok(likeness(l, fromRef(refs[0])) > 0.9, 'a cut-out is like its own reference');
  assert.deepEqual(rankByRefs(l, ['bar', 'L', 'none'], refs).map((o) => o.name), ['L', 'bar', 'none']);
  assert.equal(rankByRefs(l, ['none'], refs)[0].score, 0, 'no references: score 0');
}

export function bestCombinationKeepsTheRules() {
  const reads = [
    { options: [{ name: 'a', score: 0.9 }, { name: 'b', score: 0.5 }] },
    { options: [{ name: 'a', score: 0.8 }, { name: 'c', score: 0.3 }] },
  ];
  assert.deepEqual(bestCombination(reads, () => true), [0, 0], 'no rule: the best of each');
  const unique = (names) => new Set(names).size === names.length;
  assert.deepEqual(bestCombination(reads, unique), [1, 0], 'a + a is not allowed; b + a (1.3) beats a + c (1.2)');
  assert.equal(bestCombination(reads, () => false), null);
}
