import assert from 'node:assert/strict';
import { handTracker } from '../engine/hands.js';

export function reportsHandThenStableOnce() {
  const t = handTracker({ stableMs: 500 });
  assert.equal(t.update(false, 0), null);        // nothing happened yet
  assert.equal(t.update(true, 100), 'hand');
  assert.equal(t.update(true, 200), null);
  assert.equal(t.busy(), true);
  assert.equal(t.update(false, 300), null);      // gone only 100 ms
  assert.equal(t.update(false, 700), 'stable');  // gone 500 ms
  assert.equal(t.update(false, 2000), null);     // only once
  assert.equal(t.busy(), false);
}

export function handComingBackRestartsTheWait() {
  const t = handTracker({ stableMs: 500 });
  t.update(true, 0);
  t.update(false, 400);
  assert.equal(t.update(true, 450), 'hand');
  assert.equal(t.update(false, 800), null);      // 350 ms since last seen
  assert.equal(t.update(false, 950), 'stable');
}
