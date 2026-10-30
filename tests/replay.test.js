import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { isPhoto, expectedName, sameState, runGame, compareTruth } from '../engine/replay.js';

export function picksPhotoFiles() {
  assert.ok(isPhoto('a.jpg') && isPhoto('b.JPEG') && isPhoto('c.png'));
  assert.ok(!isPhoto('a.json') && !isPhoto('index.json') && !isPhoto('README.md'));
}

export function findsExpectedStateFile() {
  assert.equal(expectedName('board.1.jpg'), 'board.1.json');
}

export function comparesStatesIgnoringKeyOrder() {
  assert.ok(sameState({ a: 1, b: [1, { c: 2, d: 3 }] }, { b: [1, { d: 3, c: 2 }], a: 1 }));
  assert.ok(!sameState({ a: 1 }, { a: 2 }));
  assert.ok(!sameState([1, 2], [2, 1]));
}

export async function runsBlankGameOnAFrame() {
  const game = await import('../games/_blank.js');
  const frame = { width: 2, height: 1, data: new Uint8ClampedArray(8) };
  assert.deepEqual(await runGame(game, frame, {}), { state: { width: 2, height: 1, pieces: [] }, move: null });
}

export function comparesTruthByItsShape() {
  const cards = [{ color: 'red', number: 1 }];
  assert.equal(compareTruth({ cards: [{ color: 'red', number: 1, corners: [] }] }, cards).ok, true);
  assert.equal(compareTruth({ cards: [{ color: 'red', number: 2 }] }, cards).score.featuresRight, 1);
  const grid = [['X', ''], ['', 'O']];
  assert.equal(compareTruth({ corners: [{ x: 0, y: 0 }], cells: [['X', ''], ['', 'O']] }, grid).ok, true);
  assert.deepEqual(compareTruth({ cells: [['X', ''], ['', '']] }, grid).wrong, [{ row: 1, col: 1, read: '', truth: 'O' }]);
  assert.deepEqual(compareTruth({ grid: ['#'], pieces: ['a'], corners: [] }, { grid: ['#'], pieces: ['b'] }).wrong, ['pieces']);
}

// node replay/run.js on every replay folder: the reference solutions (solutions/*.js) read
// every photo right. The starters (games/*.js, half done for the workshop) may differ but must not crash.
// Needs the dev tools (OpenCV.js, image decoders): run pnpm install once. Without them it is skipped.
export async function replayRunnerSaysOkForSolutions() {
  const tools = await Promise.all([import('jpeg-js'), import('@techstark/opencv-js')]).catch(() => null);
  if (!tools) return console.log('     skipped: run pnpm install first');
  const folder = new URL('../solutions/', import.meta.url);
  if (!existsSync(folder)) return console.log('     skipped: no solutions/ (the solutions branch has them)');
  const solutions = readdirSync(folder).filter((f) => f.endsWith('.js')).map((f) => f.replace(/\.js$/, ''));
  assert.ok(solutions.length > 0, 'no solutions found');
  for (const game of solutions) {
    assert.deepEqual(await replay(game, '--solution'), ['ok'], `solutions/${game}.js`);
    const starter = await replay(game);
    assert.ok(starter.every((check) => check === 'ok' || check === 'differs'), `games/${game}.js: ${starter}`);
  }
  for (const folder of REQUIRED_FOLDERS) {
    if (!solutions.includes(folder.split('/')[0])) continue;
    assert.deepEqual(await replay(folder, '--solution'), ['ok'], `solutions/${folder.split('/')[0]}.js on replay/${folder}/`);
  }
}

// Sub-folders of real photos the reference solutions must read right too (one line each).
// set/owner: the owner's Set deck on the dark table (issue #124).
const REQUIRED_FOLDERS = ['set/owner'];

// The distinct "check" values of node replay/run.js <game> [flag].
async function replay(game, ...flags) {
  const run = promisify(execFile);
  const script = fileURLToPath(new URL('../replay/run.js', import.meta.url));
  const { stdout } = await run(process.execPath, [script, game, ...flags], { maxBuffer: 64 << 20 }).catch((err) => err);
  const checks = stdout.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line).check);
  assert.ok(checks.length > 0, `no photos for ${game}`);
  return [...new Set(checks)];
}

// Set's Sample photos (replay/set/samples.json) show only real photos that solutions/set.js reads right (issue #144):
// the launcher's "Set backup" opens the first one in front of the room.
export async function setSamplesAreReadRight() {
  const tools = await Promise.all([import('jpeg-js'), import('@techstark/opencv-js')]).catch(() => null);
  if (!tools) return console.log('     skipped: run pnpm install first');
  if (!existsSync(new URL('../solutions/set.js', import.meta.url))) return console.log('     skipped: no solutions/set.js');
  const samples = JSON.parse(readFileSync(new URL('../replay/set/samples.json', import.meta.url), 'utf8'));
  assert.ok(samples.length > 0, 'replay/set/samples.json is empty');
  const run = promisify(execFile);
  const script = fileURLToPath(new URL('../replay/run.js', import.meta.url));
  for (const folder of new Set(samples.map((/** @type {string} */ s) => s.split('/').slice(0, -1).join('/')))) {
    const { stdout } = await run(process.execPath, [script, ['set', folder].filter(Boolean).join('/'), '--solution'], { maxBuffer: 64 << 20 }).catch((err) => err);
    const lines = stdout.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
    for (const sample of samples.filter((/** @type {string} */ s) => s.split('/').slice(0, -1).join('/') === folder)) {
      const line = lines.find((l) => l.photo === sample.split('/').pop());
      assert.equal(line?.check, 'ok', `${sample}: ${line?.check ?? 'not found'}`);
      assert.ok(line.move?.sets?.length > 0, `${sample}: no set found`);
      // Every set the demo frames is a real set by the photo's truth file (the cards as they are on the table).
      const truthFile = new URL(`../replay/set/${sample.replace(/\.[^.]+$/, '.truth.json')}`, import.meta.url);
      if (!existsSync(truthFile)) continue;
      const truth = JSON.parse(readFileSync(truthFile, 'utf8'));
      for (const set of line.move.sets) {
        const real = ['color', 'number', 'shape', 'fill'].every((f) => new Set(set.map((i) => truth[i]?.[f])).size !== 2);
        assert.ok(real, `${sample}: cards ${set} are not a set on the table`);
      }
    }
  }
}
