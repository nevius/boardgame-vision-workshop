// @ts-check
// Speed setting (Auto / Saver / Full) and the small rules that keep the live camera light on weak phones.
// app.js uses them in its camera loop. Pure functions, no DOM, so tests/speed.test.js runs them in node.
//
// What the loop does with them, on every video frame:
//   1. rateLimiter: detect() runs at most `rate` times per second; the video plays smoothly in between.
//   2. changeDetector: a tiny grey thumbnail of the picture; nothing changed → keep the last answer.
//   3. analysisSize: detect() gets a smaller copy of the picture (long side `long` px); the overlay canvas has
//      the same size, so what a game draws lands on the right spot. A game may ask for more (config below).
//   4. autoSwitch: in Auto, a slow phone switches to Saver by itself.
//   5. detectNow: the last word on "detect() on this frame?" (hand check, still picture, searching).

/** @typedef {'auto' | 'saver' | 'full'} SpeedChoice  what the player picks in the ⋯ sheet */
/** @typedef {'default' | 'saver' | 'full'} SpeedMode  what runs: Auto runs 'default' until it switches to 'saver' */

/**
 * @typedef {object} ModeSettings
 * @property {{ width: number, height: number }} camera  what the page asks the camera for
 * @property {number} rate   detect() runs per second at most (Infinity = back to back)
 * @property {number} long   long side of the picture detect() gets, in px (Infinity = full size)
 * @property {boolean} skip  true: skip detect() while the picture does not change
 * @property {number} hands  hand checks per second (engine/hands.js)
 */

/** @type {Record<SpeedMode, ModeSettings>} */
export const MODES = {
  default: { camera: { width: 1920, height: 1080 }, rate: 5, long: 960, skip: true, hands: 10 },
  saver: { camera: { width: 1280, height: 720 }, rate: 2, long: 720, skip: true, hands: 5 },
  full: { camera: { width: 1920, height: 1080 }, rate: Infinity, long: Infinity, skip: false, hands: 10 },
};

export const CHOICES = /** @type {SpeedChoice[]} */ (['auto', 'saver', 'full']);
export const IDLE_MS = 2 * 60 * 1000; // no change for this long: the camera stops ("Tap to continue")

// The settings that run for a choice. autoSaver: Auto has already switched to Saver on this device.
// A game may ask for more: config.analysisSize (long side in px) and config.maxRate (detect() per second).
/**
 * @param {SpeedChoice} choice @param {boolean} autoSaver
 * @param {{ analysisSize?: number, maxRate?: number }} [config]
 * @returns {ModeSettings & { mode: SpeedMode }}
 */
export function speedSettings(choice, autoSaver, config = {}) {
  /** @type {SpeedMode} */
  const mode = choice === 'full' ? 'full' : choice === 'saver' || autoSaver ? 'saver' : 'default';
  const base = MODES[mode];
  return {
    ...base,
    mode,
    long: config.analysisSize ? Math.max(base.long, config.analysisSize) : base.long,
    rate: config.maxRate ? Math.max(base.rate, config.maxRate) : base.rate,
  };
}

// The size of the picture detect() gets: the long side at most `long` px, same shape. Never bigger than
// the video. scale = analysis px per video px (1 = full size).
/** @param {number} width @param {number} height @param {number} long */
export function analysisSize(width, height, long) {
  const scale = Math.min(1, long / Math.max(width, height, 1));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), scale };
}

// A point from one picture size to another (for example tapped corners after the analysis size changed,
// or a point detect() found in the small picture → the full video picture).
/**
 * @param {{ x: number, y: number }} point
 * @param {{ width: number, height: number }} from @param {{ width: number, height: number }} to
 */
export function mapPoint(point, from, to) {
  return { x: (point.x * to.width) / from.width, y: (point.y * to.height) / from.height };
}

// At most `perSecond` calls of ready() say true per second. ready(now) also counts the run.
/** @param {number} perSecond */
export function rateLimiter(perSecond) {
  const gap = perSecond === Infinity ? 0 : 1000 / perSecond;
  let last = -Infinity;
  return {
    /** @param {number} now ms */
    ready(now) {
      if (now - last < gap) return false;
      // Stay on the beat (a late frame does not push the next one back), but never bunch up after a pause.
      last = now - last < 2 * gap ? last + gap : now;
      return true;
    },
  };
}

export const THUMB = { width: 64, height: 48 };

// A tiny grey picture for the change check. data: RGBA bytes of a picture already scaled to width × height.
/** @param {{ data: Uint8ClampedArray | number[] }} rgba @returns {Uint8Array} */
export function greyThumb({ data }) {
  const grey = new Uint8Array(data.length / 4);
  for (let i = 0; i < grey.length; i++) grey[i] = (data[4 * i] * 77 + data[4 * i + 1] * 150 + data[4 * i + 2] * 29) >> 8;
  return grey;
}

// Did the picture change? Compares each new thumbnail with the one of the last change, so a slow drift
// adds up too. A change counts when more than `share` of the pixels moved by more than `level` (0–255).
// After a change detect() keeps running for settleMs, so games that vote over frames (game.steady) settle.
/** @param {{ level?: number, share?: number, settleMs?: number }} [options] */
export function changeDetector({ level = 24, share = 0.005, settleMs = 1500 } = {}) {
  /** @type {Uint8Array | null} */
  let base = null;
  let changedAt = -Infinity;
  return {
    // true: run detect(). grey: greyThumb() of the picture now.
    /** @param {Uint8Array} grey @param {number} now ms */
    update(grey, now) {
      if (!base || base.length !== grey.length || moved(base, grey, level) > share * grey.length) {
        base = grey;
        changedAt = now;
        return true;
      }
      return now - changedAt < settleMs;
    },
    // ms since the picture last changed (for the "Tap to continue" stop).
    /** @param {number} now */
    still(now) { return base ? now - changedAt : 0; },
    reset() { base = null; },
  };
}

/** @param {Uint8Array} a @param {Uint8Array} b @param {number} level */
function moved(a, b, level) {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > level) n++;
  return n;
}

// Auto's rule: switch to Saver when detect() is slow or the screen stutters. detectMs: the last detect times;
// screenFps: video frames shown per second (null = not known yet). Needs a few numbers first.
/**
 * @param {{ detectMs: number[], screenFps: number | null }} numbers
 * @param {{ maxMs?: number, minFps?: number, samples?: number }} [limits]
 */
export function autoSwitch({ detectMs, screenFps }, { maxMs = 150, minFps = 15, samples = 10 } = {}) {
  if (detectMs.length < samples) return false;
  const recent = detectMs.slice(-samples);
  const average = recent.reduce((a, b) => a + b, 0) / recent.length;
  return average > maxMs || (screenFps != null && screenFps < minFps);
}

// Does detect() run on this video frame (after the rate limit)? Issue #139: while the page is searching (nothing
// found since unlock, unfreeze, a game switch or "Search again"), it runs on every frame, even with the hand check
// on and the picture still: the first frames of a camera are often dark or blurry, and one try is not enough.
// Once something was found, the hand check (detect only after a move) and the still-picture skip apply again.
/**
 * @param {{ searching: boolean, detectNext: boolean, hands: boolean, skip: boolean, moving: boolean, hasResult: boolean }} now
 */
export function detectNow({ searching, detectNext, hands, skip, moving, hasResult }) {
  if (searching || detectNext) return true;
  if (hands) return false;
  return !(skip && !moving && hasResult);
}

// The saved choice from localStorage (any storage with getItem/setItem). Private mode or no storage → defaults.
const KEY = 'board-vision.speed';
const AUTO_KEY = 'board-vision.autoSaver';
/** @param {Pick<Storage, 'getItem'> | undefined} storage @returns {{ choice: SpeedChoice, autoSaver: boolean }} */
export function loadSpeed(storage) {
  try {
    const saved = /** @type {SpeedChoice} */ (storage?.getItem(KEY));
    return { choice: CHOICES.includes(saved) ? saved : 'auto', autoSaver: storage?.getItem(AUTO_KEY) === '1' };
  } catch {
    return { choice: 'auto', autoSaver: false };
  }
}
/** @param {Pick<Storage, 'setItem'> | undefined} storage @param {{ choice: SpeedChoice, autoSaver: boolean }} speed */
export function saveSpeed(storage, { choice, autoSaver }) {
  try {
    storage?.setItem(KEY, choice);
    storage?.setItem(AUTO_KEY, autoSaver ? '1' : '0');
  } catch { /* private mode: not remembered */ }
}
