// @ts-check
// Benchmark numbers: model load times, ms per step (warp, embed, detect, solve), FPS, Speed mode and detect rate.
// The page shows them in the benchmark panel, each next to its target (TARGETS below) with a verdict:
// good, ok or slow. Nothing leaves the phone. No DOM here, so tests can run in node.

const KEEP = 20;  // average over the last 20 times of each step

/** @type {Record<string, number[]>} */
const steps = {};
/** @type {Record<string, number>} */
const loads = {};
/** @type {Record<string, string>} */
const backends = {};
/** @type {number[]} */
const frames = [];  // times (ms) of the last frames, for FPS
/** @type {number[]} */
const detects = []; // times (ms) of the last detect() runs, for the detect rate
const speed = { mode: '', analysis: '' }; // Speed setting (engine/speed.js) and the size detect() gets

// Records how long one step took, in ms. Steps: 'warp', 'embed', 'detect', 'solve' (any name works).
/** @param {string} step @param {number} ms */
export function recordStep(step, ms) {
  const list = (steps[step] ??= []);
  list.push(ms);
  if (list.length > KEEP) list.shift();
}

// Wraps a function (sync or async) so every call records its time under `step`.
/**
 * @template {(...args: any[]) => any} F
 * @param {string} step @param {F} fn @returns {F}
 */
export function timed(step, fn) {
  return /** @type {F} */ ((...args) => {
    const start = performance.now();
    const result = fn(...args);
    if (result && typeof result.then === 'function') {
      return result.finally(() => recordStep(step, performance.now() - start));
    }
    recordStep(step, performance.now() - start);
    return result;
  });
}

// Records a model load time (download + start) in ms, and which backend it runs on ('GPU', 'CPU').
/** @param {string} model @param {number} ms @param {string} [backend] */
export function recordLoad(model, ms, backend) {
  loads[model] = Math.round(ms);
  if (backend) backends[model] = backend;
}

// Call once per shown video frame; gives the FPS (photos do not count).
/** @param {number} [now] */
export function recordFrame(now = performance.now()) {
  frames.push(now);
  if (frames.length > KEEP + 1) frames.shift();
}

// Call once per detect() run on live video; gives the detect rate.
/** @param {number} [now] */
export function recordDetect(now = performance.now()) {
  detects.push(now);
  if (detects.length > 100) detects.shift();
}

// The Speed mode that runs ('default', 'saver', 'full') and the picture size detect() gets ('960×540').
/** @param {{ mode: string, analysis: string }} info */
export function recordSpeed(info) {
  Object.assign(speed, info);
}

// Frames per second from a list of frame times (ms). null with fewer than 2 frames.
/** @param {number[]} times */
export function fpsOf(times) {
  if (times.length < 2) return null;
  const span = times.at(-1) - times[0];
  return span > 0 ? Math.round(((times.length - 1) * 1000) / span * 10) / 10 : null;
}

// Runs per second over the last windowMs up to now (so it drops to 0 when runs stop).
/** @param {number[]} times @param {number} now @param {number} [windowMs] */
export function rateSince(times, now, windowMs = 5000) {
  const recent = times.filter((t) => now - t <= windowMs).length;
  return Math.round((recent / windowMs) * 1000 * 10) / 10;
}

/** @param {number[]} list */
function average(list) {
  return list.length ? Math.round(list.reduce((a, b) => a + b, 0) / list.length) : null;
}

/**
 * @typedef {object} BenchReport Everything the panel shows. Plain JSON.
 * @property {string} device    'ios', 'android' or 'desktop'
 * @property {string} browser   for example 'safari 26.4'
 * @property {boolean} webgpu   true when the browser has WebGPU
 * @property {string} backend   for example 'embedder GPU, hands CPU' ('' before any model ran)
 * @property {Record<string, number>} loadMs   model → load time in ms
 * @property {Record<string, number | null>} stepMs  step → average ms
 * @property {number | null} fps        video frames shown per second
 * @property {string} [mode]            Speed mode: 'default', 'saver' or 'full' ('' before the camera ran)
 * @property {number | null} [detectRate]  detect() runs per second on live video
 * @property {string} [analysis]        picture size detect() gets, e.g. '960×540'
 * @property {string} game
 * @property {string} userAgent
 */

// The numbers so far. `device` comes from engine/device.js readBrowser().
/**
 * @param {{ device: { os: string, browser: string, version: any }, webgpu: boolean, game: string, userAgent: string }} info
 * @returns {BenchReport}
 */
export function benchReport({ device, webgpu, game, userAgent }) {
  /** @type {Record<string, number | null>} */
  const stepMs = {};
  for (const step of ['warp', 'embed', 'detect', 'solve', ...Object.keys(steps)]) stepMs[step] = average(steps[step] ?? []);
  return {
    device: device.os,
    browser: [device.browser, device.version].filter((x) => x != null && x !== 'any').join(' '),
    webgpu,
    backend: Object.entries(backends).map(([model, b]) => `${model} ${b}`).join(', '),
    loadMs: { ...loads },
    stepMs,
    fps: fpsOf(frames),
    mode: speed.mode,
    detectRate: detects.length ? rateSince(detects, performance.now()) : null,
    analysis: speed.analysis,
    game,
    userAgent,
  };
}

// Clears the step times and FPS (load times stay: models load only once).
export function resetBench() {
  for (const key of Object.keys(steps)) delete steps[key];
  frames.length = 0;
  detects.length = 0;
}

// ---------- Targets: what we expect per value ----------

// Lower is better for times (ms); higher is better for frames per second.
// A value is "good" up to its target, "ok" up to twice the target (half for higher-is-better), else "slow".
// Where the numbers come from: the Speed modes in engine/speed.js (detect runs 5 per second in Auto, 2 in Saver,
// so it must finish inside that time) and headless runs in the sandbox (laptop CPU, no GPU). No phone numbers yet:
// change a target here when real phones show it is too strict or too loose.

/** @typedef {{ target: number, unit: 'ms' | 'fps', higher?: boolean, important?: boolean, why: string }} Target */

/** @type {Record<string, Target>} */
export const TARGETS = {
  'load opencv': { target: 4000, unit: 'ms', important: true, why: 'about 10 MB of WASM, once per visit; 4 s on Wi-Fi' },
  'load embedder': { target: 3000, unit: 'ms', important: true, why: 'small model (4 MB); sandbox loads it in about 1 s' },
  'load hands': { target: 3000, unit: 'ms', important: true, why: 'small model (8 MB); sandbox loads it in about 1.5 s' },
  'detect default': { target: 200, unit: 'ms', important: true, why: 'Auto runs detect 5 times per second' },
  'detect saver': { target: 500, unit: 'ms', important: true, why: 'Saver runs detect 2 times per second' },
  'detect full': { target: 200, unit: 'ms', important: true, why: 'Full uses the big picture; same 5 per second as Auto' },
  'detect photo': { target: 1000, unit: 'ms', important: true, why: 'photos run once in full size; sandbox 400 ms (Set, 4000 px)' },
  fps: { target: 24, unit: 'fps', higher: true, important: true, why: 'below 24 frames per second the video looks jerky' },
  embed: { target: 30, unit: 'ms', why: 'per tile; 20 tiles must fit in one detect run' },
  hands: { target: 50, unit: 'ms', important: true, why: 'hand check runs 10 times per second; keep half the time free' },
  warp: { target: 50, unit: 'ms', why: 'one straightening of the board; sandbox about 10 ms' },
  solve: { target: 100, unit: 'ms', why: 'the answer should feel instant' },
};

// Target for a game's own step (recordStep) when the game names none in config.benchTargets.
export const STEP_TARGET = 200;

/** @typedef {'good' | 'ok' | 'slow'} Verdict */

// Verdict for one value against its target. null when nothing was measured yet.
/** @param {number | null | undefined} value @param {number} target @param {boolean} [higher] @returns {Verdict | null} */
export function verdict(value, target, higher = false) {
  if (value == null) return null;
  if (higher) return value >= target ? 'good' : value >= target / 2 ? 'ok' : 'slow';
  return value <= target ? 'good' : value <= target * 2 ? 'ok' : 'slow';
}

/**
 * @typedef {object} BenchRow One line of the panel: "detect 180 / 200 ms good".
 * @property {string} name
 * @property {number | null} value
 * @property {number} target
 * @property {'ms' | 'fps'} unit
 * @property {Verdict | null} verdict
 * @property {boolean} important  counts for the overall line
 */

// The panel's lines: every measured value next to its target. gameTargets = the game's config.benchTargets
// (step name → ms), for its own steps or to change a default (e.g. a slow game allows 'detect default': 400).
/** @param {BenchReport} r @param {Record<string, number>} [gameTargets] @returns {BenchRow[]} */
export function benchRows(r, gameTargets = {}) {
  /** @type {BenchRow[]} */
  const rows = [];
  /** @param {string} name @param {string} key @param {number | null} value */
  const add = (name, key, value) => {
    const t = TARGETS[key] ?? { target: STEP_TARGET, unit: 'ms', why: 'game step' };
    const target = gameTargets[key] ?? gameTargets[name] ?? t.target;
    rows.push({ name, value, target, unit: t.unit, verdict: verdict(value, target, t.higher), important: !!t.important });
  };
  for (const [model, v] of Object.entries(r.loadMs)) add(`load ${model}`, `load ${model}`, v);
  for (const [step, v] of Object.entries(r.stepMs)) {
    if (step === 'detect') add('detect', `detect ${r.mode || 'photo'}`, v);
    else if (v != null || TARGETS[step]) add(step, step, v);
  }
  add('fps', 'fps', r.fps);
  return rows;
}

// The worst verdict of the important measured values ('good' when a game step is the only slow one).
// null before anything important was measured.
/** @param {BenchRow[]} rows @returns {Verdict | null} */
export function overall(rows) {
  const seen = rows.filter((row) => row.important && row.verdict).map((row) => row.verdict);
  if (!seen.length) return null;
  return seen.includes('slow') ? 'slow' : seen.includes('ok') ? 'ok' : 'good';
}

// "Your phone: good for set (Speed default, WebGPU)".
/** @param {BenchReport} r @param {BenchRow[]} rows */
export function overallLine(r, rows) {
  const v = overall(rows);
  const where = `Speed ${r.mode || '– (photos)'}, ${r.webgpu ? 'WebGPU' : 'WASM'}`;
  return v ? `Your phone: ${v} for ${r.game} (${where})` : `Your phone: – for ${r.game}, run a photo or the camera first (${where})`;
}

// "detect   180 / 200 ms  good": one value as text.
/** @param {BenchRow} row */
export function rowText(row) {
  return `${row.value ?? '–'} / ${row.target} ${row.unit}`;
}

// The whole panel as plain text, for the "Copy" button (paste into a chat).
/** @param {BenchReport} r @param {BenchRow[]} rows */
export function benchText(r, rows) {
  return [
    overallLine(r, rows),
    `Device: ${[r.device, r.browser].filter(Boolean).join(', ')}; backend: ${r.backend || '–'}`,
    ...rows.map((row) => `${row.name}: ${rowText(row)} ${row.verdict ?? ''}`.trimEnd()),
    `Detect rate: ${r.detectRate ?? '–'} per second on ${r.analysis || '–'}`,
  ].join('\n');
}
