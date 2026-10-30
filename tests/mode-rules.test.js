// @ts-check
// Issue #139: the mode chip always says what the app does, and every restart of the search really runs detect().
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { modeChip, foundSomething, READING, MOVE_DONE_MS } from '../ui/mode-rules.js';
import { detectNow } from '../engine/speed.js';
import { detect as blankDetect } from '../games/_blank.js';
import { settle } from '../games/ubongo.js';

/** @type {import('../ui/mode-rules.js').Mode} */
const LIVE = {
  busy: null, paused: '', frozen: false, hasPicture: true, live: true, hand: false,
  searching: false, locked: false, info: '', photo: '',
};
// Busy jobs as engine/busy.js currentBusy() gives them (the chip reads the label and the error).
const LOADING = { label: 'Loading hand model…', error: '' };
const READING_JOB = { label: READING, error: '' };

export function chipIsNeverEmpty() {
  const flags = ['frozen', 'hasPicture', 'live', 'hand', 'moveDone', 'searching', 'locked'];
  for (const busy of [null, LOADING, READING_JOB, { label: 'x', error: 'failed' }]) {
    for (let bits = 0; bits < 2 ** flags.length; bits++) {
      const m = { ...LIVE, busy, ...Object.fromEntries(flags.map((f, i) => [f, Boolean(bits & (1 << i))])) };
      const chip = modeChip(m);
      assert.ok(chip.text.length > 0, JSON.stringify(m));
      assert.ok(chip.icon.length > 0);
    }
  }
}

export function chipSaysWhatTheAppDoes() {
  assert.equal(modeChip({ ...LIVE, busy: LOADING }).text, 'Loading hand model…'); // says what loads
  // Issue #171: a failed job's error shows in the chip (the one place for it), over everything else.
  const failed = modeChip({ ...LIVE, busy: { label: 'Loading _blank…', error: 'Loading _blank failed: 404' }, searching: true });
  assert.deepEqual(failed, { icon: 'circle-alert', text: 'Loading _blank failed: 404', tone: 'error' });
  assert.equal(modeChip({ ...LIVE, searching: true }).text, 'Looking for the board…');
  assert.equal(modeChip({ ...LIVE, searching: true }).tone, 'search');
  assert.equal(modeChip({ ...LIVE, info: '12 cards · 4 sets' }).text, 'Found · 12 cards · 4 sets');
  assert.equal(modeChip({ ...LIVE, locked: true, info: 'A24' }).text, 'Locked · A24');
  assert.equal(modeChip({ ...LIVE, live: false, frozen: true }).text, 'Frozen · tap ❄ for live');
  assert.equal(modeChip({ ...LIVE, hand: true, searching: true }).text, 'Hand over board · paused');
  assert.equal(modeChip({ ...LIVE, live: false, paused: 'Nothing changed' }).text, 'Paused · tap to continue');
  assert.equal(modeChip({ ...LIVE, live: false, hasPicture: false }).text, 'Start the camera or pick a photo');
  assert.equal(modeChip({ ...LIVE, live: false, busy: READING_JOB }).text, 'Reading the picture…');
  assert.equal(modeChip({ ...LIVE, live: false, frozen: true, busy: READING_JOB }).text, 'Frozen · tap ❄ for live');
  assert.equal(modeChip({ ...LIVE, live: false, photo: 'Photo 2/5', info: '3 sets' }).text, '3 sets', 'the photo number is in the top bar, not the chip');
  assert.equal(modeChip({ ...LIVE, live: false, photo: 'Photo 1/2', searching: true }).text, 'Nothing found');
}

// Issue #145, live with hands on: hand in → paused, hand out → "Move done · reading" → the result.
export function handInThenOutShowsMoveDone() {
  const found = { ...LIVE, info: '3 sets' };
  assert.equal(modeChip(found).text, 'Found · 3 sets');
  assert.equal(modeChip({ ...found, hand: true }).text, 'Hand over board · paused');
  const done = modeChip({ ...found, moveDone: true }); // engine/hands.js said 'stable'
  assert.equal(done.text, 'Move done · reading');
  assert.equal(done.tone, 'busy');
  assert.equal(modeChip({ ...found, moveDone: true, searching: true }).text, 'Move done · reading');
  assert.equal(modeChip({ ...found, moveDone: true, hand: true }).text, 'Hand over board · paused'); // hand back
  assert.equal(modeChip({ ...found, moveDone: false }).text, 'Found · 3 sets'); // after MOVE_DONE_MS
  assert.equal(modeChip({ ...found, live: false, moveDone: true }).text, '3 sets'); // camera off: no hand state
  assert.ok(MOVE_DONE_MS >= 1000 && MOVE_DONE_MS <= 3000);
}

export function emptyStatesCountAsNothingFound() {
  assert.equal(foundSomething(null), false);
  assert.equal(foundSomething({ cards: [] }), false);
  assert.equal(foundSomething({ corners: null, grid: [] }), false);
  assert.equal(foundSomething({ corners: null, cells: [] }), false);
  assert.equal(foundSomething({}), false);
  assert.equal(foundSomething({ cards: [{ id: 1 }] }), true);
  assert.equal(foundSomething({ corners: [{ x: 0, y: 0 }], grid: [] }), true);
  assert.equal(foundSomething({ corners: { tl: { x: 0, y: 0 } } }), true);
}

// Numbers, strings and true/false are labels, not things seen: _blank's sizes and Ubongo's card type never count.
export async function labelsAloneCountAsNothingFound() {
  assert.equal(foundSomething(await blankDetect(/** @type {any} */ ({ width: 640, height: 480 }), /** @type {any} */ ({}))), false);
  // The same "no card" state as readScene() in games/ubongo.js.
  const empty = { corners: null, area: null, grid: [], pieces: [], seen: [], options: [], tapped: false, card: null, type: /** @type {'A'} */ ('A'), print: null, known: false, field: null, roll: null, number: null, fields: [] };
  assert.equal(foundSomething(settle(empty)), false);
  assert.equal(foundSomething({ width: 640, height: 480, label: 'x', ok: true }), false);
  assert.equal(foundSomething(42), false);
}

// The camera loop's rule: while searching, detect() runs on every frame, whatever the hand check or a still picture say.
export function searchingRunsDetectOnEveryFrame() {
  const still = { detectNext: false, hands: true, skip: true, moving: false, hasResult: true };
  assert.equal(detectNow({ ...still, searching: true }), true);
  assert.equal(detectNow({ ...still, searching: false }), false); // found: wait for a hand to move
  assert.equal(detectNow({ ...still, searching: false, detectNext: true }), true);
  assert.equal(detectNow({ ...still, searching: false, hands: false }), false); // still picture, answer kept
  assert.equal(detectNow({ ...still, searching: false, hands: false, moving: true }), true);
}

// Every way to restart (unlock = Search again, unfreeze = camera start, game switch, photo switch, Forget corners,
// tapped corners) goes through restartSearch() in app.js, which makes the next frame run detect().
export function everyRestartPathRestartsTheSearch() {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const body = (/** @type {string} */ head) => {
    const at = app.indexOf(head);
    assert.ok(at >= 0, `app.js has ${head}`);
    return app.slice(at, app.indexOf('\n  },', at));
  };
  const restart = app.slice(app.indexOf('function restartSearch()'), app.indexOf('\n}', app.indexOf('function restartSearch()')));
  assert.match(restart, /searching = true/);
  assert.match(restart, /detectNext = true/);
  assert.match(restart, /change\.reset\(\)/);
  const fn = (/** @type {string} */ name) => app.slice(app.indexOf(`function ${name}(`), app.indexOf('\n}', app.indexOf(`function ${name}(`)));
  for (const name of ['startCamera', 'forgetCorners', 'tapCorners', 'start']) {
    assert.match(fn(name), /restartSearch\(\)/, `${name} restarts the search`);
  }
  const readPhoto = app.slice(app.indexOf('const readPhoto = latestWins('), app.indexOf('\n});', app.indexOf('const readPhoto = latestWins(')));
  assert.match(readPhoto, /restartSearch\(\)/, 'readPhoto restarts the search');
  assert.match(body('search: async'), /unlockAll\(\)[\s\S]*restartSearch\(\)/, 'Search again unlocks and restarts');
  assert.match(body('freeze: async'), /if \(ui\.frozen\) return startCamera\(\)/, 'unfreeze starts the camera (which restarts)');
  assert.match(app, /detectNow\(\{ searching: searching && !ui\.hand/, 'the camera loop asks detectNow');
  assert.match(restart, /searchRun\+\+/);
  assert.match(app, /if \(run === searchRun\) searching = !foundSomething\(state\)/, 'an older detect() cannot end a new search');
}
