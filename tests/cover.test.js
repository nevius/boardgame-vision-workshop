// @ts-check
// engine/cover.js: the polycube solver (1 or more layers) and the "first working choice" helper.
import assert from 'node:assert/strict';
import { coverGrid, orientations, normalize, firstWorking } from '../engine/cover.js';

const bar2 = { name: 'bar', cubes: [[0, 0, 0], [0, 0, 1]] };
const corner = { name: 'corner', cubes: [[0, 0, 0], [0, 0, 1], [0, 1, 0]] };

export function turnsOfASolid() {
  assert.equal(orientations([[0, 0, 0]]).length, 1, 'one cube: one way');
  assert.equal(orientations(bar2.cubes).length, 3, 'a bar of 2 lies along one of 3 axes');
  assert.equal(orientations(corner.cubes).length, 12, 'a flat corner of 3: 12 turns');
  assert.deepEqual(normalize([[2, 5, 1], [2, 5, 0]]), [[0, 0, 0], [0, 0, 1]]);
}

export function coversOneLayer() {
  const placements = coverGrid(['##', '#.', '##'], [corner, { ...bar2, name: 'b' }], 1);
  assert.ok(placements);
  const cells = placements.flatMap((p) => p.cells.map((c) => c.join(','))).sort();
  assert.deepEqual(cells, ['0,0,0', '0,0,1', '0,1,0', '0,2,0', '0,2,1']);
}

export function coversTwoLayers() {
  // A 2 × 1 shape, two layers high: two bars of 2 (standing or lying).
  const placements = coverGrid(['##'], [bar2, { ...bar2, name: 'other' }], 2);
  assert.ok(placements);
  assert.equal(placements.length, 2);
  assert.equal(new Set(placements.flatMap((p) => p.cells.map((c) => c.join())) ).size, 4, 'no overlap');
}

export function saysNoWhenThePiecesDoNotFit() {
  assert.equal(coverGrid(['###'], [bar2], 1), null, 'cube count differs');
  assert.equal(coverGrid(['#.#'], [bar2], 1), null, 'right count, but the shape is split');
  assert.equal(coverGrid([], [bar2], 1), null);
}

export function firstWorkingTriesTheOtherOptions() {
  const options = [['a', 'b'], ['a', 'c']];
  assert.deepEqual(firstWorking(options, (names) => names.includes('c') && names.includes('b')), ['b', 'c']);
  assert.deepEqual(firstWorking(options, (names) => names.length === 2), ['a', 'c'], 'no name twice: a + a is skipped');
  assert.equal(firstWorking(options, () => false), null);
}

export function firstWorkingStopsAtTheTimeCap() {
  let calls = 0;
  const slow = () => { calls++; const t = performance.now(); while (performance.now() - t < 5); return false; };
  assert.equal(firstWorking([['a', 'b'], ['c', 'd']], slow, 500, 1), null);
  assert.equal(calls, 1, 'one slow try uses the 1 ms: no second try');
}
