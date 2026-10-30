// @ts-check
// The rules of the More sheet, as small pure functions (tested in tests/sheet-rules.test.js).
// The sheet snaps to four heights (issue #163): 'closed' (only the bottom bar), 'peek' (one row of the most used
// tools), 'half' (everything, at most 40 % of the screen) and 'full' (scrolls; the one exception to the 40 % rule).
// Drag the handle up or down to move one step; a tap on the handle toggles peek ↔ half.
// More in the bottom bar opens it at the last height the user left it at (remembered), and closes it.
// No Preact here, so the tests run in plain Node.

/** @typedef {'closed' | 'peek' | 'half' | 'full'} SheetSize */

/** The heights from low to high. */
export const SIZES = /** @type {SheetSize[]} */ (['closed', 'peek', 'half', 'full']);

/** How far (px) a finger must move up or down to count as a swipe. */
export const SWIPE_PX = 40;

/** One more step per this many px of a long drag (a flick from closed past half reaches full). */
export const STEP_PX = 160;

/** The localStorage key of the last open height. */
export const SIZE_KEY = 'board-vision.sheet';

/**
 * The sheet size after a drag on it. dy < 0 = up. A short move is a tap: peek ↔ half (closed → peek, full → half).
 * @param {SheetSize} size @param {number} dy @returns {SheetSize}
 */
export function afterSwipe(size, dy) {
  const at = SIZES.indexOf(size);
  if (Math.abs(dy) < SWIPE_PX) return size === 'half' ? 'peek' : size === 'closed' ? 'peek' : 'half';
  const steps = 1 + Math.floor((Math.abs(dy) - SWIPE_PX) / STEP_PX);
  const to = Math.max(0, Math.min(SIZES.length - 1, at + (dy < 0 ? steps : -steps)));
  return SIZES[to];
}

/**
 * The sheet size after a tap on More: closed opens at the remembered height (half when none), open closes.
 * @param {SheetSize} size @param {string | null | undefined} [remembered] @returns {SheetSize}
 */
export function afterMenu(size, remembered) {
  if (size !== 'closed') return 'closed';
  return remembered === 'peek' || remembered === 'half' || remembered === 'full' ? remembered : 'half';
}

/**
 * What to remember after the sheet changed to `size` (null = keep the old value: closing is not a height).
 * @param {SheetSize} size @returns {SheetSize | null}
 */
export function toRemember(size) {
  return size === 'closed' ? null : size;
}

/** localStorage key for how often each sheet tile was tapped, per game: { game: { tileId: count } }. */
export const USE_KEY = 'board-vision.sheet-use';

/**
 * The tiles ordered by use (issue #163): the most tapped first, so the peek row holds the 3–4 most used ones for
 * this game. Ties (and tiles never tapped) keep the order given.
 * @template {{ id: string }} T
 * @param {T[]} tiles @param {Record<string, number> | undefined} counts @returns {T[]}
 */
export function byUse(tiles, counts) {
  const n = (/** @type {T} */ t) => (counts && Number.isFinite(counts[t.id]) ? counts[t.id] : 0);
  return tiles.map((t, i) => ({ t, i })).sort((a, b) => n(b.t) - n(a.t) || a.i - b.i).map((x) => x.t);
}

/**
 * The stored counts (text from localStorage) with one more tap on `id` in `game`. Bad or missing text starts fresh.
 * @param {string | null | undefined} text @param {string} game @param {string} id @returns {string}
 */
export function countUse(text, game, id) {
  const all = readUse(text);
  const mine = all[game] ?? {};
  mine[id] = (mine[id] ?? 0) + 1;
  all[game] = mine;
  return JSON.stringify(all);
}

/**
 * The stored counts, read safely: anything that is not an object of objects of numbers becomes {}.
 * @param {string | null | undefined} text @returns {Record<string, Record<string, number>>}
 */
export function readUse(text) {
  /** @type {Record<string, Record<string, number>>} */
  const out = {};
  try {
    const raw = JSON.parse(text ?? '{}');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    for (const [game, counts] of Object.entries(raw)) {
      if (!counts || typeof counts !== 'object' || Array.isArray(counts)) continue;
      out[game] = {};
      for (const [id, v] of Object.entries(counts)) if (typeof v === 'number' && Number.isFinite(v)) out[game][id] = v;
    }
  } catch { /* bad text: start fresh */ }
  return out;
}
