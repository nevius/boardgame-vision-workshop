// @ts-check
// engine/color.js: paper colour, white balance and hue.
import assert from 'node:assert/strict';
import { paperColor, paperTint, usualPaper, paperGains, hue } from '../engine/color.js';

/** A w × h picture filled with one colour, a dark ink square in the middle. */
function card(rgb, w = 60, h = 40) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ink = x > 25 && x < 35 && y > 15 && y < 25;
    data.set(ink ? [40, 20, 60, 255] : [...rgb, 255], (y * w + x) * 4);
  }
  return { width: w, height: h, data };
}

export function paperIsTheBrightPart() {
  const paper = paperColor(card([240, 230, 200]));
  assert.ok(paper);
  assert.deepEqual(paper.map(Math.round), [240, 230, 200], 'the ink does not count');
  assert.equal(paperColor(card([30, 30, 30])), null, 'dark: no paper');
  assert.equal(paperColor(card([200, 40, 40])), null, 'strongly coloured: no paper');
}

export function tintIgnoresWarmLight() {
  assert.ok(paperTint([255, 230, 200], [240, 240, 240]) < 0.02, 'warm light on white paper');
  assert.ok(paperTint([200, 150, 210], [240, 240, 240]) > 0.02, 'a purple card back');
  assert.deepEqual(usualPaper([[1, 1, 1], null, [3, 3, 3], [2, 2, 2]]), [2, 2, 2]);
  assert.equal(usualPaper([null]), null);
}

export function gainsMakeThePaperGrey() {
  const [r, g, b] = paperGains(card([240, 220, 200]));
  assert.ok(r < 1 && b > 1, `${r} ${g} ${b}`);
  assert.ok(Math.abs(240 * r - 200 * b) < 2, 'red and blue end up the same');
  assert.deepEqual(paperGains(card([30, 30, 30])), [1, 1, 1], 'no light pixels: no change');
}

export function hueOnTheColourWheel() {
  assert.equal(hue(255, 0, 0), 0);
  assert.equal(hue(0, 255, 0), 120);
  assert.equal(hue(0, 0, 255), 240);
  assert.equal(hue(128, 128, 128), 0);
}
