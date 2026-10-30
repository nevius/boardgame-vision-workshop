// @ts-check
// Issue #79: a game switch clears the picture; the empty screen offers sample photos and the camera.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterGameSwitch, switchKind } from '../ui/switch-rules.js';

export function switchWithoutCameraGoesToTheEmptyScreen() {
  const patch = afterGameSwitch(false);
  assert.equal(patch.hasPicture, false);
  assert.equal(patch.frozen, false);
  assert.equal(patch.canNext, false);
  assert.equal(patch.canSave, false);
  assert.equal(patch.stateText, '');
}

export function switchWithCameraKeepsTheCamera() {
  const patch = afterGameSwitch(true);
  assert.equal(patch.hasPicture, true);
  assert.equal(patch.canSave, true);
  assert.equal(patch.frozen, false);
  assert.equal(patch.canNext, false);
}

// Owner 30.10.: Camera and Sample photos sit in the bottom bar, not as big buttons on the empty screen; Sample
// photos only when the game has some and nothing is on screen yet (else they are in the sheet).
export function emptyScreenShowsSamplePhotosOnlyWhenThereAreSome() {
  const app = readFileSync(new URL('../ui/App.js', import.meta.url), 'utf8');
  assert.match(app, /const samplesInBar = ui\.hasReplay && !ui\.hasPicture && !ui\.live;/);
  assert.match(app, /samplesInBar && \{ id: 'replay'/);
  assert.match(app, /!samplesInBar && \{ id: 'replay'/);
  assert.doesNotMatch(readFileSync(new URL('../ui/CameraView.js', import.meta.url), 'utf8'), /Start camera|onReplay/);
}

// The page itself: no game run on an empty picture "to show something", photos cleared on a switch.
export function appClearsPhotosOnSwitch() {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const start = app.slice(app.indexOf('async function start()'), app.indexOf('// The one pipeline'));
  assert.match(start, /photos = \[\]/);
  assert.match(start, /afterGameSwitch\(live\)/);
  assert.doesNotMatch(start, /showPhoto\(/);
  assert.doesNotMatch(start, /showFrame\(/);
}

// Issue #88: the solution key keeps the picture; only another game starts clean.
export function solutionKeyKeepsThePicture() {
  assert.equal(switchKind(null, { game: 'set', solution: false }), 'game');
  assert.equal(switchKind({ game: 'set', solution: false }, { game: 'set', solution: true }), 'solution');
  assert.equal(switchKind({ game: 'set', solution: true }, { game: 'set', solution: false }), 'solution');
  assert.equal(switchKind({ game: 'set', solution: true }, { game: 'ubongo', solution: true }), 'game');
  assert.equal(switchKind({ game: 'set', solution: false }, { game: 'set', solution: false }), 'none');
}

// The page itself: only a game switch clears the photos; the solution key reads the same picture again.
export function appResetsOnlyOnAGameSwitch() {
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const start = app.slice(app.indexOf('async function start()'), app.indexOf('// A game switch starts clean'));
  assert.match(start, /switchKind\(loaded/);
  assert.match(start, /if \(kind === 'game'\) \{\s*show\(\{ hasReplay: false \}\);\s*resetPicture\(\);/);
  assert.match(start, /kind === 'solution'\) await readAgain\(\)/);
}
