import assert from 'node:assert/strict';
import { createVotes, winner, holdSteady } from '../engine/steady.js';

const features = ['color', 'number'];
// A card 100 × 60 pixels with its top-left corner at (x, y).
const card = (x, y, color, number) => ({
  corners: [{ x, y }, { x: x + 100, y }, { x: x + 100, y: y + 60 }, { x, y: y + 60 }], color, number,
});

export function winnerNeedsEnoughVotes() {
  assert.equal(winner(['red', 'red', 'green'], 0.6), 'red');
  assert.equal(winner(['red', 'green', null], 0.6), null);
  assert.equal(winner([], 0.6), null);
}

export function flickerIsSuppressed() {
  const votes = createVotes({ features });
  // Ten frames of the same card, read right 8 times and wrong twice; the card moves a little (hand shake).
  const reads = ['red', 'red', 'green', 'red', 'red', 'red', 'purple', 'red', 'red', 'red'];
  const shown = reads.map((color, i) => votes.update([card(200 + i, 100 - i, color, 2)])[0]);
  assert.deepEqual(shown.slice(2).map((c) => c.color), Array(8).fill('red'), 'the wrong reads never show');
  assert.ok(shown.every((c) => c.number === 2));
  assert.equal(shown[9].corners[0].x, 209, 'corners are the newest ones');
}

export function unsureFeatureBecomesNull() {
  const votes = createVotes({ features, limit: 0.6 });
  let shown;
  for (const color of ['red', 'green', 'purple', 'red', 'green', 'purple']) shown = votes.update([card(0, 0, color, 1)])[0];
  assert.equal(shown.color, null, 'no colour wins 60 % of the votes: "?"');
  assert.equal(shown.number, 1);
}

export function eachCardHasItsOwnVotes() {
  const votes = createVotes({ features });
  for (let i = 0; i < 5; i++) votes.update([card(0, 0, 'red', 1), card(300, 0, 'green', 3)]);
  // Same two cards, listed the other way round: each keeps its own votes.
  const [b, a] = votes.update([card(302, 1, 'green', 3), card(1, 2, 'purple', 1)]);
  assert.equal(a.color, 'red');
  assert.equal(b.color, 'green');
  // A new card far away starts with its own read.
  assert.equal(votes.update([card(600, 400, 'purple', 2)])[0].color, 'purple');
}

export function holdKeepsTheOldValueUntilANewOneIsSteady() {
  const hold = holdSteady(3);
  assert.deepEqual(hold(['a']), ['a']); // the first value counts at once
  assert.deepEqual(hold(['b']), ['a']);
  assert.deepEqual(hold(['b']), ['a']);
  const third = ['b'];
  assert.equal(hold(third), third); // three in a row: the new value counts (same object back)
  assert.deepEqual(hold(['a']), ['b']);
}
