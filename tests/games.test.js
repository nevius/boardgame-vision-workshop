// Every game in games/list.js must follow the contract in games/_blank.js.
import assert from 'node:assert/strict';
import { games } from '../games/list.js';

const fakeFrame = { width: 4, height: 3, data: new Uint8ClampedArray(4 * 3 * 4) };

export async function everyGameFollowsTheContract() {
  for (const name of games) {
    const game = await import(`../games/${name}.js`);
    assert.equal(typeof game.config?.title, 'string', `${name}: config.title`);
    for (const fn of ['detect', 'solve', 'draw']) {
      assert.equal(typeof game[fn], 'function', `${name}: ${fn}()`);
    }
  }
}

export async function blankStateAndMoveArePlainJson() {
  const game = await import('../games/_blank.js');
  const state = await game.detect(fakeFrame, /** @type {any} */ ({}));
  assert.deepEqual(JSON.parse(JSON.stringify(state)), state);
  const move = game.solve(state);
  assert.deepEqual(JSON.parse(JSON.stringify(move)), move);
}
