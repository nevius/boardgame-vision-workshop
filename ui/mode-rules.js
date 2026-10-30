// @ts-check
// What the app is doing right now, as one line for the mode chip in the top bar (issue #139), and the rule
// "did detect() find anything?". The chip text starts with what matters (the game's own line, what to do
// next); "Photo n/m" is not in it (the top bar shows it), so nothing secondary pushes the important part out. Small pure functions, tested in tests/mode-rules.test.js (no Preact here).
// The chip is never empty: the first rule that fits wins, from top to bottom in modeChip().
// Loading and reading come from the one busy indicator (engine/busy.js, issue #134): no flags of its own.

// The busy label app.js uses while detect() reads a photo or frozen picture; any other busy job shows its own
// label ("Loading hand model…", "Starting camera…"), so the chip says what loads.
export const READING = 'Reading the picture…';

// How long the chip says "Move done · reading" after the hand left the board (issue #145).
export const MOVE_DONE_MS = 2000;

/**
 * @typedef {object} Mode What app.js knows about its work right now.
 * @property {{ label: string, error: string } | null} busy  the newest busy job (engine/busy.js currentBusy()), or null
 * @property {string} paused       why the camera stopped by itself ('' = it did not)
 * @property {boolean} frozen      the picture is frozen (❄)
 * @property {boolean} hasPicture  a camera picture or a photo is on screen
 * @property {boolean} live        the camera runs
 * @property {boolean} hand        a hand is over the board (detect() waits for it to go)
 * @property {boolean} [moveDone]  the hand just left (engine/hands.js 'stable'): detect() reads the move
 * @property {boolean} searching   nothing found since the last restart (unlock, unfreeze, switch, Search again)
 * @property {boolean} locked      a card or board is anchored (engine/anchor.js)
 * @property {string} info         the game's own line (engine.setInfo), e.g. "12 cards · 4 sets"
 * @property {string} [photo]      "Photo 2/5" when photos are shown (the top bar shows it next to the game name, not the chip)
 */

/**
 * @typedef {object} Chip
 * @property {string} icon  a name in ui/icons.js
 * @property {string} text  plain words, short
 * @property {'busy' | 'search' | 'found' | 'hold' | 'idle' | 'error'} tone  busy and search spin; hold = frozen,
 *   paused or locked; error = a job failed (issue #171: the chip is the one place for errors)
 */

/** The mode chip for the app's state. @param {Mode} m @returns {Chip} */
export function modeChip(m) {
  // A failed job ("Loading _blank failed: …") shows here for a few seconds (engine/busy.js), nowhere else.
  if (m.busy?.error) return { icon: 'circle-alert', text: m.busy.error, tone: 'error' };
  const job = m.busy ? m.busy.label : '';
  if (job && job !== READING) return { icon: 'loader', text: job, tone: 'busy' };
  if (m.paused) return { icon: 'pause', text: 'Paused · tap to continue', tone: 'hold' };
  if (m.frozen) return { icon: 'snowflake', text: `Frozen${m.info ? ` · ${m.info}` : ''} · tap ❄ for live`, tone: 'hold' };
  if (!m.hasPicture) return { icon: 'camera', text: 'Start the camera or pick a photo', tone: 'idle' };
  if (m.live && m.hand) return { icon: 'hand', text: 'Hand over board · paused', tone: 'hold' };
  if (m.live && m.moveDone) return { icon: 'hand', text: 'Move done · reading', tone: 'busy' };
  if (job === READING) return { icon: 'loader', text: READING, tone: 'busy' };
  if (m.live && m.searching) return { icon: 'scan-search', text: 'Looking for the board…', tone: 'search' };
  if (m.live && m.locked) return { icon: 'lock', text: `Locked${m.info ? ` · ${m.info}` : ' on the board'}`, tone: 'hold' };
  if (m.live) return { icon: 'eye', text: m.info ? `Found · ${m.info}` : 'Live · reading', tone: 'found' };
  if (m.searching) return { icon: 'scan-search', text: 'Nothing found', tone: 'idle' };
  return { icon: 'image', text: m.info || 'Found', tone: 'found' };
}

/**
 * Did detect() find anything? True when the state holds a non-empty list or an object (like corners).
 * Numbers, strings and true/false are labels (width, card type, "tapped"), not things that were seen, so they
 * never count. Games return "nothing here" states like { corners: null, cards: [], type: 'A' } with no board in view.
 * @param {unknown} state
 */
export function foundSomething(state) {
  if (state === null || typeof state !== 'object') return false;
  if (Array.isArray(state)) return state.length > 0;
  return Object.values(state).some((v) => (Array.isArray(v) ? v.length > 0 : v !== null && typeof v === 'object'));
}
