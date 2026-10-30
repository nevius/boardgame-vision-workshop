// @ts-check
// engine/cards.js: card-sized shapes (touching cards cut apart), a quarter turn, cards straightened lying.
import assert from 'node:assert/strict';
import { cardSized, turnQuarter, findColorFrame } from '../engine/cards.js';

const tools = await import('@techstark/opencv-js').catch(() => null);
const engine = tools ? await import('../engine/index.js') : null;

/** A quad w × h at (x, y). */
const quad = (x, y, w, h) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];

export function keepsCardsAndCutsTouchingOnes() {
  const cards = [quad(0, 0, 100, 60), quad(200, 0, 100, 60), quad(0, 100, 60, 100), quad(400, 0, 200, 60), quad(0, 300, 10, 10)];
  const kept = cardSized(cards);
  assert.equal(kept.length, 5, '3 cards + 2 halves of the double one; the speck is dropped');
  const halves = kept.filter((q) => q[0].x >= 400); // in reading order now, next to the first row's cards
  assert.deepEqual(halves.map((q) => Math.round(q[1].x - q[0].x)), [100, 100]);
}

export function cutsA2x2BlockIntoFourCards() {
  // Set cards are about 1.56 : 1, so a third of a 2 × 2 block looks like one card turned sideways (review of #127).
  for (const [w, h] of [[100, 64], [64, 100]]) {
    const cards = [quad(0, 0, w, h), quad(300, 0, w, h), quad(600, 0, w, h), quad(0, 300, 2 * w, 2 * h)];
    const kept = cardSized(cards);
    assert.equal(kept.length, 7, `${w} × ${h}: 3 cards + 4 parts of the 2 × 2 block`);
    for (const q of kept.slice(3)) {
      assert.equal(Math.round(q[1].x - q[0].x), w);
      assert.equal(Math.round(q[2].y - q[1].y), h);
    }
  }
}

export function keepsThreeInARowAsThree() {
  const cards = [quad(0, 0, 100, 64), quad(300, 0, 100, 64), quad(600, 0, 100, 64), quad(0, 300, 300, 64)];
  assert.equal(cardSized(cards).length, 6, '3 cards + 3 parts of the row');
}

// 3 cards touching along their long sides must not be cut as 2 × 2 (a quarter of 192 × 100 is 96 × 50,
// still inside the slack, but 3 parts of 64 × 100 fit better).
export function keepsThreeSideBySideAsThree() {
  const standing = [quad(0, 0, 64, 100), quad(300, 0, 64, 100), quad(600, 0, 64, 100), quad(0, 300, 192, 100)];
  const parts = cardSized(standing).slice(3);
  assert.equal(parts.length, 3, 'standing side by side');
  for (const p of parts) assert.ok(Math.abs(p[1].x - p[0].x - 64) < 1 && Math.abs(p[2].y - p[1].y - 100) < 1);
  const lying = [quad(0, 0, 100, 64), quad(300, 0, 100, 64), quad(600, 0, 100, 64), quad(0, 300, 100, 192)];
  assert.equal(cardSized(lying).length, 6, 'lying stacked');
}

// A near card that looks 17–30 % bigger than the middle card still fits as one card: it stays whole, not cut in
// two halves (half of 129 × 83 is 83 × 64, closer to the card size than the whole card; review of #127).
export function keepsABigNearCardWhole() {
  for (const s of [1.17, 1.2, 1.25, 1.29]) {
    const cards = [quad(0, 0, 100, 64), quad(300, 0, 100, 64), quad(600, 0, 100, 64), quad(0, 300, 100 * s, 64 * s)];
    const kept = cardSized(cards);
    assert.equal(kept.length, 4, `card ${s} × as big stays one card`);
    assert.ok(Math.abs(kept[3][1].x - kept[3][0].x - 100 * s) < 1e-9, `card ${s} × keeps its width`);
  }
}

export function turnsAQuarter() {
  // 2 × 1: a red pixel left, a blue one right → 1 × 2: red on top, blue below.
  const image = { width: 2, height: 1, data: new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255]) };
  const turned = turnQuarter(image);
  assert.equal(turned.width, 1);
  assert.equal(turned.height, 2);
  assert.deepEqual([...turned.data], [255, 0, 0, 255, 0, 0, 255, 255]);
}

export function findsACardByItsColouredFrame() {
  const width = 300, height = 300;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const frame = x >= 50 && x < 250 && y >= 50 && y < 250 && (x < 58 || x >= 242 || y < 58 || y >= 242);
    data.set(frame ? [220, 30, 30, 255] : [20, 20, 20, 255], (y * width + x) * 4);
  }
  const corners = findColorFrame({ width, height, data }, 'red');
  assert.ok(corners);
  const want = [[50, 50], [250, 50], [250, 250], [50, 250]];
  corners.forEach((p, i) => assert.ok(Math.hypot(p.x - want[i][0], p.y - want[i][1]) < 6, `corner ${i}`));
  assert.equal(findColorFrame({ width, height, data }, 'blue'), null);
}

// An upright card (taller than wide) is straightened lying down, turned a quarter: a red band at its top
// ends up at the right of the lying card. (engine/cards.js straightLying, used by games/set.js.)
export async function straightensUprightCardsLying() {
  if (!engine) return console.log('     skipped: run pnpm install first');
  const width = 400, height = 400;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const inCard = x >= 150 && x < 250 && y >= 100 && y < 250;
    const band = inCard && y < 120;
    data.set(band ? [220, 20, 20, 255] : inCard ? [250, 250, 250, 255] : [30, 30, 30, 255], (y * width + x) * 4);
  }
  const corners = [{ x: 150, y: 100 }, { x: 250, y: 100 }, { x: 250, y: 250 }, { x: 150, y: 250 }];
  const image = await engine.straightLying({ width, height, data }, corners, 300, 200);
  assert.equal(image.width, 300);
  assert.equal(image.height, 200);
  const red = (x, y) => image.data[(y * 300 + x) * 4] > 150 && image.data[(y * 300 + x) * 4 + 1] < 80;
  assert.ok(red(290, 100), 'the band is on the right');
  assert.ok(!red(10, 100) && !red(150, 10), 'not on the left or the top');
}

export function cutCardsKeepTheReadingOrder() {
  // A 2 × 2 block at the left and two single cards right of it (one per row): rows top to bottom (issue #124).
  const cards = [quad(0, 0, 200, 128), quad(300, 0, 100, 64), quad(300, 64, 100, 64)];
  const kept = cardSized(cards);
  assert.deepEqual(kept.map((q) => [Math.round(q[0].x), Math.round(q[0].y)]), [[0, 0], [100, 0], [300, 0], [0, 64], [100, 64], [300, 64]]);
}
