import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  fpsOf, rateSince, benchReport, recordStep, recordLoad, timed, resetBench,
  verdict, benchRows, overall, overallLine, benchText, TARGETS, STEP_TARGET,
} from '../engine/bench.js';

const device = { os: 'ios', browser: 'safari', version: '26.4' };

export function fpsFromFrameTimes() {
  assert.equal(fpsOf([]), null);
  assert.equal(fpsOf([0]), null);
  assert.equal(fpsOf([0, 100, 200, 300]), 10);
}

export async function reportAveragesSteps() {
  resetBench();
  recordStep('detect', 10);
  recordStep('detect', 20);
  recordLoad('embedder', 1234.4, 'GPU');
  await timed('solve', async () => 1)();
  const r = benchReport({ device, webgpu: true, game: 'set', userAgent: 'UA' });
  assert.equal(r.stepMs.detect, 15);
  assert.equal(r.stepMs.warp, null);
  assert.equal(typeof r.stepMs.solve, 'number');
  assert.equal(r.loadMs.embedder, 1234);
  assert.equal(r.backend, 'embedder GPU');
  assert.equal(r.browser, 'safari 26.4');
}

export function verdictLowerIsBetterAtBoundaries() {
  assert.equal(verdict(200, 200), 'good');
  assert.equal(verdict(201, 200), 'ok');
  assert.equal(verdict(400, 200), 'ok');
  assert.equal(verdict(401, 200), 'slow');
  assert.equal(verdict(null, 200), null);
}

export function verdictHigherIsBetterAtBoundaries() {
  assert.equal(verdict(24, 24, true), 'good');
  assert.equal(verdict(23.9, 24, true), 'ok');
  assert.equal(verdict(12, 24, true), 'ok');
  assert.equal(verdict(11.9, 24, true), 'slow');
}

/** @param {Partial<import('../engine/bench.js').BenchReport>} over */
const report = (over) => ({
  device: 'ios', browser: 'safari 26.4', webgpu: true, backend: '', loadMs: {}, game: 'set', userAgent: 'UA',
  stepMs: { warp: null, embed: null, detect: null, solve: null }, fps: null, mode: 'default', ...over,
});

export function detectTargetFollowsSpeedMode() {
  const saver = benchRows(report({ mode: 'saver', stepMs: { detect: 300 } })).find((row) => row.name === 'detect');
  assert.equal(saver?.target, TARGETS['detect saver'].target);
  assert.equal(saver?.verdict, 'good');
  const auto = benchRows(report({ stepMs: { detect: 300 } })).find((row) => row.name === 'detect');
  assert.equal(auto?.verdict, 'ok');
  const photo = benchRows(report({ mode: '', stepMs: { detect: 300 } })).find((row) => row.name === 'detect');
  assert.equal(photo?.target, TARGETS['detect photo'].target);
}

export function overallPicksWorstImportantValue() {
  const r = report({ loadMs: { opencv: 1000 }, stepMs: { detect: 100, 'my step': 9999, solve: 9999 }, fps: 15 });
  const rows = benchRows(r);
  assert.equal(rows.find((row) => row.name === 'my step')?.verdict, 'slow'); // shown, but not important
  assert.equal(overall(rows), 'ok');                                          // fps 15 of 24 is the worst one
  assert.match(overallLine(r, rows), /^Your phone: ok for set \(Speed default, WebGPU\)/);
  assert.equal(overall(benchRows(report({ fps: 5 }))), 'slow');
  assert.equal(overall(benchRows(report({}))), null);
  assert.match(overallLine(report({ webgpu: false }), []), /– for set.*WASM/);
}

export function gameOverridesStepTarget() {
  const r = report({ stepMs: { 'ubongo pieces': 450 } });
  assert.equal(benchRows(r).find((row) => row.name === 'ubongo pieces')?.target, STEP_TARGET);
  const row = benchRows(r, { 'ubongo pieces': 500 }).find((x) => x.name === 'ubongo pieces');
  assert.equal(row?.target, 500);
  assert.equal(row?.verdict, 'good');
}

export function copyTextShowsMeasuredSlashTarget() {
  const r = report({ stepMs: { detect: 180 } });
  assert.match(benchText(r, benchRows(r)), /detect: 180 \/ 200 ms good/);
}

export function detectRateDropsWhenDetectStops() {
  const times = [0, 200, 400, 600, 800, 1000];
  assert.equal(rateSince(times, 1000, 1000), 6);
  assert.equal(rateSince(times, 10000), 0);
}

// The page never talks to GitHub: no issue links, no fetch to github, nothing about sharing.
export function benchmarkNeverTalksToGitHub() {
  for (const file of ['engine/bench.js', 'ui/BenchPanel.js', 'app.js']) {
    assert.doesNotMatch(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), /github|issues\/new|share/i, file);
  }
  for (const dir of ['engine', 'ui']) {
    for (const f of readdirSync(new URL(`../${dir}/`, import.meta.url)).filter((x) => x.endsWith('.js'))) {
      const code = readFileSync(new URL(`../${dir}/${f}`, import.meta.url), 'utf8');
      assert.doesNotMatch(code, /fetch\([^)]*github|https:\/\/github\.com/i, `${dir}/${f}`);
    }
  }
}
