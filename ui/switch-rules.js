// @ts-check
// What happens on a game switch, as small pure functions
// (tested in tests/switch-rules.test.js). No Preact here, so the tests run in plain Node.
// Issue #79: a new game never reads the old game's photo. It starts on the empty screen,
// unless the live camera runs: then the camera stays on and the new game reads fresh frames.

/**
 * The page state after switching games. Photos, a frozen picture, the last answer and tapped picture are gone.
 * @param {boolean} live  the camera runs right now
 * @returns {Partial<import('./App.js').UiState>}
 */
export function afterGameSwitch(live) {
  return {
    frozen: false, locked: false, canNext: false, canTap: false, stateText: '',
    hasPicture: live, canSave: live,
  };
}

/**
 * What a hash change means (issue #88). 'game': another game, start clean (as #79). 'solution': the same game,
 * only the solution key changed: swap the game file, keep the picture and run detect() on it once. 'none': nothing.
 * @param {{ game: string, solution: boolean } | null} before  null on the first load
 * @param {{ game: string, solution: boolean }} after
 * @returns {'game' | 'solution' | 'none'}
 */
export function switchKind(before, after) {
  if (!before || before.game !== after.game) return 'game';
  return before.solution === after.solution ? 'none' : 'solution';
}
