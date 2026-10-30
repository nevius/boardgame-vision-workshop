// @ts-check
// First-run hints (issue #152): three short hints the first time the page opens, one at a time, in the mode chip
// (the one status place, issue #163). A tap on the chip shows the next one; after the last they never come back,
// unless "Show hints again" in the ⋯ sheet. How many were seen is remembered in this browser (HINT_KEY).
// Small pure functions, tested in tests/hint-rules.test.js (no Preact here).

export const HINT_KEY = 'bv-hints-seen';

/**
 * @typedef {object} Hint
 * @property {string} bar   the bottom-bar button it is about (gets a ring while the hint shows), '' = none
 * @property {string} text
 */

/** @type {Hint[]} */
export const HINTS = [
  { bar: 'camera', text: 'Camera in the bottom bar starts the live picture' },
  { bar: 'more', text: '⋯ More in the bottom bar: photos, games, settings' },
  { bar: 'steps', text: 'Steps (once a picture shows) shows how it is read, step by step' },
];

/**
 * How many hints were seen, from the stored text. Anything odd counts as none seen.
 * @param {string | null} stored
 */
export function readSeen(stored) {
  const n = Number(stored);
  return Number.isInteger(n) && n >= 0 ? Math.min(n, HINTS.length) : 0;
}

/**
 * The hint to show now, or null when all were seen.
 * @param {number} seen
 * @returns {Hint | null}
 */
export function currentHint(seen) {
  return HINTS[seen] ?? null;
}

/**
 * The mode chip for a hint: "Tip 1/3: … · tap for next" (the last one: "· tap to close").
 * @param {number} seen
 * @returns {import('./mode-rules.js').Chip | null}
 */
export function hintChip(seen) {
  const hint = currentHint(seen);
  if (!hint) return null;
  const last = seen === HINTS.length - 1;
  return { icon: 'lightbulb', text: `Tip ${seen + 1}/${HINTS.length}: ${hint.text} · ${last ? 'tap to close' : 'tap for next'}`, tone: 'hold' };
}
