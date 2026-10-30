import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { findSolutionGames, flagsFromHash, gameFromHash, solutionFromHash, solutionHash } from '../engine/route.js';

const games = ['_blank', 'set', 'qwirkle'];

export function picksGameFromHash() {
  assert.equal(gameFromHash('#qwirkle', games, '_blank'), 'qwirkle');
  assert.equal(gameFromHash('#SET', games, '_blank'), 'set');
}

export function fallsBackForEmptyOrUnknown() {
  assert.equal(gameFromHash('', games, '_blank'), '_blank');
  assert.equal(gameFromHash('#chess', games, '_blank'), '_blank');
  assert.equal(gameFromHash(undefined, games, '_blank'), '_blank');
}

export function solutionFlag() {
  assert.equal(gameFromHash('#set&solution', games, '_blank'), 'set');
  assert.equal(solutionFromHash('#set&solution'), true);
  assert.equal(solutionFromHash('#set'), false);
  assert.equal(solutionFromHash('#solution'), false);
  assert.equal(solutionFromHash(''), false);
}

export function solutionKeyGoesBackAndForth() {
  assert.equal(solutionHash('ubongo', true), '#ubongo&solution');
  assert.equal(solutionHash('ubongo', false), '#ubongo');
  assert.equal(solutionFromHash(solutionHash('set', true)), true);
  assert.equal(gameFromHash(solutionHash('set', true), games, '_blank'), 'set');
}

// The solution key shows for exactly the games with a file in solutions/; none when the folder is missing.
export async function solutionGamesComeFromTheFolder() {
  const folder = new URL('../solutions/', import.meta.url);
  const files = existsSync(folder) ? readdirSync(folder).filter((f) => f.endsWith('.js')).map((f) => f.replace(/\.js$/, '')) : [];
  const exists = async (/** @type {string} */ url) => existsSync(new URL(`.${url}`, import.meta.url));
  assert.deepEqual(await findSolutionGames(games, exists), games.filter((g) => files.includes(g)));
  assert.deepEqual(await findSolutionGames(['set', 'nope'], async () => { throw new Error('offline'); }), []);
  /** @type {string[]} */
  const asked = [];
  await findSolutionGames(['_blank', 'set'], async (url) => (asked.push(url), true));
  assert.deepEqual(asked, ['./solutions/set.js'], 'the empty starter is never asked for');
}

export function demoFlags() {
  assert.deepEqual(flagsFromHash('#ubongo&solution&card=a24'), { card: 'A24', replay: false, hands: false, camera: false, steps: null });
  assert.deepEqual(flagsFromHash('#ubongo&solution&card=A24&replay'), { card: 'A24', replay: true, hands: false, camera: false, steps: null });
  assert.deepEqual(flagsFromHash('#tictactoe&solution&hands=show'), { card: null, replay: false, hands: true, camera: false, steps: null });
  assert.deepEqual(flagsFromHash('#set'), { card: null, replay: false, hands: false, camera: false, steps: null });
  assert.deepEqual(flagsFromHash(''), { card: null, replay: false, hands: false, camera: false, steps: null });
  assert.deepEqual(flagsFromHash('#replay'), { card: null, replay: false, hands: false, camera: false, steps: null }); // the game name is no flag
  assert.equal(flagsFromHash('#ubongo&card=').card, null);
  assert.equal(flagsFromHash('#set&solution&camera').camera, true);
  assert.equal(flagsFromHash('#set&solution&replay&steps=rules').steps, 'rules');
  assert.equal(flagsFromHash('#sudoku&steps=Scores').steps, 'scores');
  assert.equal(flagsFromHash('#sudoku&steps').steps, '');
  // the flags do not change the game or the solution key
  assert.equal(gameFromHash('#ubongo&solution&card=A24&replay', games.concat('ubongo'), '_blank'), 'ubongo');
  assert.equal(solutionFromHash('#ubongo&card=A24&solution'), true);
}
