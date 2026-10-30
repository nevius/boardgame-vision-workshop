// @ts-check
// engine/pick.js: a tap on the picture → the area of the card under it, or a button.
import assert from 'node:assert/strict';
import { areaCorners, areaAt, inBox } from '../engine/pick.js';

// A card 200 × 100 pixels, lying straight with its top-left corner at (100, 50).
const card = [{ x: 100, y: 50 }, { x: 300, y: 50 }, { x: 300, y: 150 }, { x: 100, y: 150 }];

export function areaCornersFollowTheCard() {
  const c = areaCorners(card, { left: 0.5, top: 0, width: 0.5, height: 0.5 });
  assert.deepEqual(c.map((p) => [Math.round(p.x), Math.round(p.y)]), [[200, 50], [300, 50], [300, 100], [200, 100]]);
}

export function tapFindsTheArea() {
  const areas = [{ left: 0, top: 0, width: 0.5, height: 1 }, { left: 0.5, top: 0, width: 0.5, height: 1 }];
  assert.equal(areaAt(card, areas, { x: 150, y: 100 }), 0);
  assert.equal(areaAt(card, areas, { x: 250, y: 100 }), 1);
  assert.equal(areaAt(card, areas, { x: 50, y: 100 }), -1, 'off the card');
}

export function tapFindsTheButton() {
  const button = { x: 0, y: 0, width: 44, height: 44 };
  assert.ok(inBox({ x: 10, y: 43 }, button));
  assert.ok(!inBox({ x: 44, y: 10 }, button), 'the right edge belongs to the next button');
}
