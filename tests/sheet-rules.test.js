import assert from 'node:assert/strict';
import { afterSwipe, afterMenu, toRemember, SIZES, byUse, countUse, readUse } from '../ui/sheet-rules.js';

export function swipesMoveOneSnapHeight() {
  assert.deepEqual(SIZES, ['closed', 'peek', 'half', 'full']);
  assert.equal(afterSwipe('closed', -60), 'peek');
  assert.equal(afterSwipe('peek', -60), 'half');
  assert.equal(afterSwipe('half', -60), 'full');
  assert.equal(afterSwipe('full', -60), 'full');
  assert.equal(afterSwipe('full', 60), 'half');
  assert.equal(afterSwipe('half', 60), 'peek');
  assert.equal(afterSwipe('peek', 60), 'closed');
  assert.equal(afterSwipe('closed', 60), 'closed');
}

export function longDragsMoveFurther() {
  assert.equal(afterSwipe('closed', -250), 'half');
  assert.equal(afterSwipe('closed', -1000), 'full');
  assert.equal(afterSwipe('full', 1000), 'closed');
}

export function tapOnTheHandleTogglesPeekAndHalf() {
  assert.equal(afterSwipe('peek', 2), 'half');
  assert.equal(afterSwipe('half', -2), 'peek');
  assert.equal(afterSwipe('closed', 0), 'peek');
  assert.equal(afterSwipe('full', 0), 'half');
}

export function moreOpensAtTheRememberedHeight() {
  assert.equal(afterMenu('closed'), 'half');
  assert.equal(afterMenu('closed', null), 'half');
  assert.equal(afterMenu('closed', 'peek'), 'peek');
  assert.equal(afterMenu('closed', 'full'), 'full');
  assert.equal(afterMenu('closed', 'small'), 'half'); // an old or broken value
  assert.equal(afterMenu('peek', 'half'), 'closed');
  assert.equal(afterMenu('half'), 'closed');
  assert.equal(afterMenu('full'), 'closed');
}

export function closingIsNotRemembered() {
  assert.equal(toRemember('closed'), null);
  assert.equal(toRemember('peek'), 'peek');
  assert.equal(toRemember('full'), 'full');
}

export function mostUsedTilesComeFirst() {
  const tiles = [{ id: 'photos' }, { id: 'steps' }, { id: 'replay' }, { id: 'hands' }];
  assert.deepEqual(byUse(tiles, undefined).map((t) => t.id), ['photos', 'steps', 'replay', 'hands']);
  assert.deepEqual(byUse(tiles, { hands: 3, replay: 1, steps: 3 }).map((t) => t.id), ['steps', 'hands', 'replay', 'photos']);
}

export function useCountsArePerGameAndSafe() {
  let text = countUse(null, 'qwirkle', 'steps');
  text = countUse(text, 'qwirkle', 'steps');
  text = countUse(text, 'set', 'hands');
  assert.deepEqual(readUse(text), { qwirkle: { steps: 2 }, set: { hands: 1 } });
  assert.deepEqual(readUse('not json'), {});
  assert.deepEqual(readUse('[1]'), {});
  assert.deepEqual(readUse('{"a":{"x":"7","y":2},"b":3}'), { a: { y: 2 } });
  assert.deepEqual(readUse(countUse('oops', 'set', 'x')), { set: { x: 1 } });
}
