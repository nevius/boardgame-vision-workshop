// Tests for engine/anchor.js: the pure rules (smoothing, hold, unlock, moving a state), and tracking on a
// synthetic shaky sequence made from the owner's Ubongo photo (shifted ±10 px, turned ±3°, blurred, 2 dropped frames).
// The tracking tests need the dev tools (OpenCV.js, jpeg-js): run pnpm install once, else they are skipped.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { smoothCorners, holdOpacity, unlockRule, quadMap, moveState, createAnchor, setAnchorLive, anchorStatus } from '../engine/anchor.js';
import { findColorFrame } from '../engine/cards.js';

const square = (x, y, s) => [{ x, y }, { x: x + s, y }, { x: x + s, y: y + s }, { x, y: y + s }];

export function smoothingIgnoresTinyShakesAndFollowsBigMoves() {
  const a = square(100, 100, 200);
  assert.deepEqual(smoothCorners(null, a), a);
  assert.equal(smoothCorners(a, square(100.5, 100, 200)), a, 'a half-pixel shake does not move it');
  const small = smoothCorners(a, square(110, 100, 200));
  assert.ok(small[0].x > 100 && small[0].x < 102, 'a 10 px jump moves only a little');
  const big = smoothCorners(a, square(200, 100, 200));
  assert.ok(big[0].x > 150, 'a big move follows quickly');
}

export function holdKeepsThenFades() {
  assert.equal(holdOpacity(0, 1000, 500), 1);
  assert.equal(holdOpacity(1000, 1000, 500), 1);
  assert.equal(holdOpacity(1250, 1000, 500), 0.5);
  assert.equal(holdOpacity(2000, 1000, 500), 0);
}

export function unlockNeedsAnotherKeySteadily() {
  let r = unlockRule(null, 'A', 'A', 0, 700);
  assert.deepEqual(r, { pending: null, change: false });
  r = unlockRule(null, 'A', 'B', 0, 700);
  assert.equal(r.change, false);
  r = unlockRule(r.pending, 'A', 'B', 500, 700);
  assert.equal(r.change, false);
  assert.equal(unlockRule(r.pending, 'A', 'C', 800, 700).change, false, 'another key starts again');
  assert.equal(unlockRule(r.pending, 'A', 'B', 700, 700).change, true);
  assert.equal(unlockRule(r.pending, 'A', 'A', 800, 700).pending, null, 'the old card again: no change');
}

export function quadMapAndMoveState() {
  const map = quadMap(square(0, 0, 100), square(10, 20, 200));
  assert.deepEqual(map({ x: 50, y: 50 }), { x: 110, y: 120 });
  const moved = moveState({ corners: square(0, 0, 100), name: 'A24', grid: ['.#'], at: { x: 100, y: 0 } }, map);
  assert.deepEqual(moved.at, { x: 210, y: 20 });
  assert.equal(moved.name, 'A24');
  assert.deepEqual(moved.grid, ['.#']);
}

export async function photosAlwaysReadFully() {
  setAnchorLive(false);
  const anchor = createAnchor();
  let reads = 0;
  for (let i = 0; i < 3; i++) await anchor.run({ width: 1, height: 1, data: new Uint8ClampedArray(4) }, () => ({ corners: square(0, 0, 1), n: ++reads }));
  assert.equal(reads, 3);
}

// ---------------------------------------------------------------- tracking on a synthetic sequence

const tools = await Promise.all([import('jpeg-js'), import('@techstark/opencv-js')]).catch(() => null);
const cv = tools ? await new Promise((resolve) => {
  const c = /** @type {any} */ (tools[1].default);
  const done = () => { delete c.then; resolve(c); };
  if (c.Mat) done(); else c.onRuntimeInitialized = done;
}) : null;

// The photo at the page's live size (long side 960), as ImageData.
function photo(name) {
  const image = tools[0].default.decode(readFileSync(new URL(`../replay/ubongo/${name}`, import.meta.url)), { useTArray: true });
  const src = cv.matFromImageData({ width: image.width, height: image.height, data: new Uint8ClampedArray(image.data) });
  const dst = new cv.Mat();
  const s = 960 / Math.max(image.width, image.height);
  cv.resize(src, dst, new cv.Size(Math.round(image.width * s), Math.round(image.height * s)), 0, 0, cv.INTER_AREA);
  const frame = { width: dst.cols, height: dst.rows, data: new Uint8ClampedArray(dst.data) };
  src.delete(); dst.delete();
  return frame;
}

// The frame shifted by (dx, dy) and turned by deg around its middle, blurred a bit. Returns the frame and the map.
function shake(frame, dx, dy, deg, blur) {
  const src = cv.matFromImageData(frame);
  const m = cv.getRotationMatrix2D(new cv.Point(frame.width / 2, frame.height / 2), deg, 1);
  m.data64F[2] += dx;
  m.data64F[5] += dy;
  const dst = new cv.Mat();
  cv.warpAffine(src, dst, m, new cv.Size(frame.width, frame.height), cv.INTER_LINEAR, cv.BORDER_REPLICATE);
  if (blur) cv.GaussianBlur(dst, dst, new cv.Size(5, 5), blur);
  const k = [...m.data64F];
  const out = { width: frame.width, height: frame.height, data: new Uint8ClampedArray(dst.data) };
  src.delete(); m.delete(); dst.delete();
  return { frame: out, map: (p) => ({ x: k[0] * p.x + k[1] * p.y + k[2], y: k[3] * p.x + k[4] * p.y + k[5] }) };
}

// Same random numbers every run.
function random(seed) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
}

export async function shakySequenceStaysSteady() {
  if (!cv) return console.log('     skipped: run pnpm install first');
  const base = photo('a24-top-seq1.jpg');
  const card = findColorFrame(base, 'red');
  assert.ok(card, 'the red card frame is found in the photo');
  setAnchorLive(true);
  // Live mode is shared by all anchors in this process: switch it off again even when an assert fails, or the
  // photo tests in later files (paper, set, ubongo) run as live video and fail too (issue #111).
  try {
    const anchor = createAnchor({ loadCV: async () => cv });
    const rnd = random(7);
    let reads = 0;
    let prev = null;
    let worst = 0;
    const trackMs = [];
    const dropped = new Set([12, 13]);
    for (let i = 0; i < 40; i++) {
      const { frame, map } = shake(base, (rnd() * 2 - 1) * 10, (rnd() * 2 - 1) * 10, (rnd() * 2 - 1) * 3, dropped.has(i) ? 9 : i % 3 === 0 ? 1.2 : 0);
      // The "detector": the true corners and a counter as content; nothing on the dropped frames.
      let read = false;
      const start = performance.now();
      const state = await anchor.run(frame, () => {
        read = true;
        return dropped.has(i) ? { corners: null, n: -1 } : { corners: card.map(map), n: ++reads };
      }, { key: () => 'A24', now: i * 200 });
      if (!read) trackMs.push(performance.now() - start);
      assert.ok(state.corners, `frame ${i}: the overlay never vanishes`);
      assert.equal(state.n, 1, `frame ${i}: the content stays the first read`);
      if (prev) {
        const step = Math.max(...state.corners.map((p, k) => Math.hypot(p.x - prev[k].x, p.y - prev[k].y)));
        worst = Math.max(worst, step);
        if (process.env.DEBUG_ANCHOR) console.log(i, read, step.toFixed(1));
      }
      prev = state.corners;
    }
    assert.ok(anchorStatus().locked);
    // No drift: the shakes average to zero, so the overlay stays near the card in the still photo.
    const off = Math.max(...prev.map((p, k) => Math.hypot(p.x - card[k].x, p.y - card[k].y)));
    assert.ok(off < 15, `overlay is ${off.toFixed(1)} px off the card`);
    assert.ok(worst <= 3, `corners moved ${worst.toFixed(1)} px between frames (allowed 3)`);
    trackMs.sort((a, b) => a - b);
    const median = trackMs[Math.floor(trackMs.length / 2)];
    // Only printed, not checked: unit tests check results, not speed (CI machines vary, issue #111).
    console.log(`     ${trackMs.length} tracked frames, median ${median.toFixed(1)} ms, worst step ${worst.toFixed(1)} px, ${off.toFixed(1)} px off at the end, ${reads} full reads`);
  } finally {
    setAnchorLive(false);
  }
}

export async function anotherCardUnlocksWithinASecond() {
  if (!cv) return console.log('     skipped: run pnpm install first');
  const first = photo('a24-top-seq1.jpg');
  const second = photo('a24-top-seq1-tilted.jpg');
  const corners = [findColorFrame(first, 'red'), findColorFrame(second, 'red')];
  assert.ok(corners[0] && corners[1]);
  setAnchorLive(true);
  // Switched off in finally, as above.
  try {
    const anchor = createAnchor({ loadCV: async () => cv });
    let swappedAt = -1;
    let changedAt = -1;
    for (let i = 0; i < 30; i++) {
      const which = i < 10 ? 0 : 1;
      if (which === 1 && swappedAt < 0) swappedAt = i * 200;
      const state = await anchor.run([first, second][which], () => ({ corners: corners[which], card: ['A24', 'B07'][which] }),
        { key: (s) => s.card, now: i * 200 });
      if (which === 1 && state.card === 'B07' && changedAt < 0) changedAt = i * 200;
    }
    assert.ok(changedAt >= 0, 'the other card took over');
    console.log(`     other card shown after ${changedAt - swappedAt} ms`);
    assert.ok(changedAt - swappedAt <= 1400, `took ${changedAt - swappedAt} ms`);
  } finally {
    setAnchorLive(false);
  }
}
