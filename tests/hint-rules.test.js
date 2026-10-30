// @ts-check
// Issue #152: three first-run hints in the mode chip, one at a time, never again once seen.
import assert from 'node:assert/strict';
import { HINTS, currentHint, hintChip, readSeen } from '../ui/hint-rules.js';

export function aFreshBrowserStartsAtTheFirstHint() {
  assert.equal(readSeen(null), 0);
  assert.equal(currentHint(0)?.bar, 'camera');
  assert.match(hintChip(0)?.text ?? '', /^Tip 1\/3: Camera.*tap for next$/);
}

export function threeHintsCameraMoreSteps() {
  assert.deepEqual(HINTS.map((h) => h.bar), ['camera', 'more', 'steps']);
  assert.match(hintChip(2)?.text ?? '', /^Tip 3\/3: Steps.*tap to close$/);
}

export function onceAllAreSeenNoHintShows() {
  assert.equal(readSeen(String(HINTS.length)), HINTS.length);
  assert.equal(currentHint(HINTS.length), null);
  assert.equal(hintChip(HINTS.length), null);
  assert.equal(hintChip(readSeen('99')), null);
}

export function oddStoredValuesCountAsNoneSeen() {
  for (const v of ['', 'x', '-1', '1.5']) assert.equal(readSeen(v), 0, v);
}

export function hintsUseTheChipNotASecondPlace() {
  const chip = hintChip(1);
  assert.equal(chip?.tone, 'hold');
  assert.equal(chip?.icon, 'lightbulb');
}
