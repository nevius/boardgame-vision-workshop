import assert from 'node:assert/strict';
import {
  rateLimiter, changeDetector, greyThumb, autoSwitch, analysisSize, mapPoint, speedSettings, loadSpeed, saveSpeed,
} from '../engine/speed.js';

export function rateLimiterLetsFiveRunsPerSecondThrough() {
  const limit = rateLimiter(5);
  let runs = 0;
  for (let t = 0; t < 1000; t += 1000 / 60) if (limit.ready(t)) runs++; // a 60 Hz screen for one second
  assert.equal(runs, 5);
}

export function rateLimiterDoesNotBunchUpAfterAPause() {
  const limit = rateLimiter(2);
  assert.equal(limit.ready(0), true);
  assert.equal(limit.ready(100), false);
  assert.equal(limit.ready(5000), true);  // after a pause: one run,
  assert.equal(limit.ready(5016), false); // not a burst to catch up
  assert.equal(limit.ready(5500), true);
}

export function rateLimiterWithoutCapRunsEveryTime() {
  const limit = rateLimiter(Infinity);
  assert.equal(limit.ready(0), true);
  assert.equal(limit.ready(0), true);
}

const grey = (/** @type {number} */ value, n = 64 * 48) => new Uint8Array(n).fill(value);

export function changeDetectorSkipsAStillPicture() {
  const change = changeDetector({ settleMs: 1000 });
  assert.equal(change.update(grey(100), 0), true);     // first picture: run
  assert.equal(change.update(grey(102), 500), true);   // still settling
  assert.equal(change.update(grey(101), 1500), false); // still: skip
  assert.equal(change.still(1500), 1500);
}

export function changeDetectorSeesACardPutDown() {
  const change = changeDetector({ settleMs: 0 });
  change.update(grey(100), 0);
  const card = grey(100);
  card.fill(220, 0, 40); // 40 of 3072 pixels (1.3 %) turn bright
  assert.equal(change.update(card, 100), true);
  assert.equal(change.update(card, 200), false);
}

export function changeDetectorIgnoresNoiseButAddsUpDrift() {
  const change = changeDetector({ settleMs: 0 });
  change.update(grey(100), 0);
  assert.equal(change.update(grey(110), 100), false); // small: noise or light flicker
  assert.equal(change.update(grey(130), 200), true);  // 30 levels away from the last change: counts
}

export function greyThumbWeighsGreenMost() {
  const rgba = { data: new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255]) };
  const [r, g, b] = greyThumb(rgba);
  assert.ok(g > r && r > b);
}

export function autoSwitchesWhenDetectIsSlow() {
  assert.equal(autoSwitch({ detectMs: Array(10).fill(200), screenFps: 30 }), true);
  assert.equal(autoSwitch({ detectMs: Array(10).fill(80), screenFps: 30 }), false);
  assert.equal(autoSwitch({ detectMs: Array(3).fill(500), screenFps: 30 }), false, 'needs a few numbers first');
}

export function autoSwitchesWhenTheScreenStutters() {
  assert.equal(autoSwitch({ detectMs: Array(10).fill(50), screenFps: 9 }), true);
  assert.equal(autoSwitch({ detectMs: Array(10).fill(50), screenFps: null }), false);
}

export function analysisSizeKeepsTheShape() {
  assert.deepEqual(analysisSize(1920, 1080, 960), { width: 960, height: 540, scale: 0.5 });
  assert.deepEqual(analysisSize(1080, 1920, 720), { width: 405, height: 720, scale: 0.375 });
  assert.deepEqual(analysisSize(640, 480, 960), { width: 640, height: 480, scale: 1 }, 'never bigger');
  assert.equal(analysisSize(1920, 1080, Infinity).scale, 1);
}

export function pointsMapBetweenTheSmallAndTheFullPicture() {
  const small = analysisSize(1920, 1080, 960);
  const full = { width: 1920, height: 1080 };
  assert.deepEqual(mapPoint({ x: 480, y: 270 }, small, full), { x: 960, y: 540 });
  assert.deepEqual(mapPoint({ x: 960, y: 540 }, full, small), { x: 480, y: 270 });
  const saver = analysisSize(1280, 720, 720);
  assert.deepEqual(mapPoint({ x: 960, y: 540 }, small, saver), { x: 720, y: 405 });
}

export function speedSettingsFollowTheChoice() {
  assert.equal(speedSettings('auto', false).mode, 'default');
  assert.equal(speedSettings('auto', true).mode, 'saver');
  assert.equal(speedSettings('saver', false).rate, 2);
  assert.equal(speedSettings('full', true).long, Infinity);
  const game = speedSettings('saver', false, { analysisSize: 1200, maxRate: 4 });
  assert.equal(game.long, 1200);
  assert.equal(game.rate, 4);
}

export function speedIsRememberedAndSurvivesNoStorage() {
  /** @type {Record<string, string>} */
  const store = {};
  const storage = { getItem: (/** @type {string} */ k) => store[k] ?? null, setItem: (/** @type {string} */ k, /** @type {string} */ v) => { store[k] = v; } };
  assert.deepEqual(loadSpeed(storage), { choice: 'auto', autoSaver: false });
  saveSpeed(storage, { choice: 'full', autoSaver: true });
  assert.deepEqual(loadSpeed(storage), { choice: 'full', autoSaver: true });
  const broken = { getItem: () => { throw new Error('private'); }, setItem: () => { throw new Error('private'); } };
  assert.deepEqual(loadSpeed(broken), { choice: 'auto', autoSaver: false });
  saveSpeed(broken, { choice: 'saver', autoSaver: false });
}
