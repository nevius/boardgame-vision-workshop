// @ts-check
// Issue #152: the game picker shows every game in games/list.js with its picture and what you need.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { games } from '../games/list.js';
import { gameCards } from '../ui/picker-rules.js';
import { ICONS } from '../ui/icons.js';

export function everyListedGameHasACardWithPictureAndNeeds() {
  const cards = gameCards(games);
  assert.deepEqual(cards.map((c) => c.name), games);
  for (const c of cards) {
    assert.ok(existsSync(new URL(`../${c.picture}`, import.meta.url)), `${c.name}: ${c.picture} is missing`);
    assert.ok(c.needs.length > 0 && c.title.length > 0, c.name);
  }
}

export function theIssueNamesWhatEachGameNeeds() {
  const needs = Object.fromEntries(gameCards(games).map((c) => [c.name, c.needs]));
  assert.match(needs.set, /Set cards/);
  assert.match(needs.qwirkle, /Qwirkle tiles/);
  assert.match(needs.ubongo, /A24/);
  assert.match(needs.sudoku, /Print sheet/);
  assert.match(needs.tictactoe, /Print sheet/);
}

export function anOwnGameGetsThePlainPicture() {
  const [c] = gameCards(['mygame']);
  assert.equal(c.title, 'mygame');
  assert.equal(c.picture, 'ui/pictures/_blank.svg');
  assert.equal(gameCards(['toString'])[0].title, 'toString');
}

export function theHintIconExists() {
  assert.ok('lightbulb' in ICONS);
}
