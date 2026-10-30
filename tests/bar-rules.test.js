// @ts-check
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { barSlots, BAR_SLOTS } from '../ui/bar-rules.js';

const a = (/** @type {string} */ id) => ({ id });

export function barKeepsOrder() {
  const { bar, rest } = barSlots(a('camera'), ['search', 'freeze', 'next', 'g1', 'save'].map(a), a('more'));
  assert.equal(bar.length, BAR_SLOTS);
  assert.deepEqual(bar.map((b) => b.id), ['camera', 'search', 'freeze', 'next', 'more']);
  assert.deepEqual(rest.map((b) => b.id), ['g1', 'save']);
}

export function barWithFewActions() {
  const { bar, rest } = barSlots(a('camera'), [a('search')], a('more'));
  assert.deepEqual(bar.map((b) => b.id), ['camera', 'search', 'more']);
  assert.deepEqual(rest, []);
}

// Ubongo in 3D view sends 4 actions. A list does not take a slot by itself (it opens in the sheet), so the page's
// play buttons stay in thumb reach; only a list the game holds open keeps a bar slot.
export function listActionGoesToSheetUnlessHeldOpen() {
  const list = (/** @type {string} */ id, /** @type {boolean | undefined} */ open = undefined) => ({ id, open, choices: [{ label: '1' }] });
  const wanted = [a('search'), a('next'), list('roll'), list('pieces', false), a('steps')];
  const closed = barSlots(a('camera'), wanted, a('more'));
  assert.deepEqual(closed.bar.map((b) => b.id), ['camera', 'search', 'next', 'roll', 'more']);
  assert.deepEqual(closed.rest.map((b) => b.id), ['pieces', 'steps']);
  wanted[3] = list('pieces', true);
  const held = barSlots(a('camera'), wanted, a('more'));
  assert.deepEqual(held.bar.map((b) => b.id), ['camera', 'search', 'next', 'pieces', 'more']);
  assert.deepEqual(held.rest.map((b) => b.id), ['roll', 'steps']);
}

// Steps sits in the bar or in the sheet, exactly once (review of PR #175: it showed twice in the sheet).
export function stepsShowsOnce() {
  const app = readFileSync(new URL('../ui/App.js', import.meta.url), 'utf8');
  assert.equal(app.match(/id: 'steps'/g)?.length, 1, "App.js lists Steps once, in the bar's wanted list");
}

// A list that did not fit the bar opens inside the sheet.
export function sheetOpensLists() {
  const sheet = readFileSync(new URL('../ui/Sheet.js', import.meta.url), 'utf8');
  assert.match(sheet, /list\.choices\?\.map/, 'Sheet.js renders the choices of a row');
}

// Page buttons come first in App.js, so game actions never push Search again or Next photo out of thumb reach.
export function pageButtonsBeforeGameActions() {
  const app = readFileSync(new URL('../ui/App.js', import.meta.url), 'utf8');
  const next = app.indexOf("id: 'next'");
  const gameActions = app.indexOf('...game.actions.filter((a) => !a.more)');
  assert.ok(app.indexOf("id: 'search'") < gameActions && next < gameActions, 'Search again and Next photo come before the game actions');
}

export function oneStatusPlace() {
  const app = readFileSync(new URL('../ui/App.js', import.meta.url), 'utf8');
  const top = readFileSync(new URL('../ui/TopBar.js', import.meta.url), 'utf8');
  assert.doesNotMatch(app, /Toast/, 'App.js shows no toast');
  assert.doesNotMatch(top, /<select|onCamera|onMenu/, 'the top bar only shows, it has no play controls');
}
