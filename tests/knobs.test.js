// @ts-check
// Knobs (engine/knobs.js): defaults, clamping, reset, a game's own knobs.
import assert from 'node:assert/strict';
import { ENGINE_KNOBS, knob, setKnob, resetKnobs, listKnobs, useGameKnobs } from '../engine/knobs.js';

export function defaultsAreTheOldConstants() {
  useGameKnobs();
  // With default knobs every result stays as before: Canny(40, 120).
  assert.equal(knob('edgeLow'), 40);
  assert.equal(knob('edgeHigh'), 120);
}

export function setKeepsInRangeAndResetRestores() {
  useGameKnobs();
  assert.equal(setKnob('edgeLow', 80), 80);
  assert.equal(knob('edgeLow'), 80);
  assert.equal(setKnob('edgeHigh', 999), 255);
  assert.equal(setKnob('edgeHigh', -5), 0);
  assert.equal(setKnob('edgeLow', NaN), 80);
  assert.equal(listKnobs().find((k) => k.name === 'edgeLow')?.value, 80);
  resetKnobs();
  assert.equal(knob('edgeLow'), 40);
  assert.equal(knob('edgeHigh'), 120);
  assert.equal(ENGINE_KNOBS[0].value, 40); // the list of defaults itself never changes
}

export function unknownKnobThrows() {
  useGameKnobs();
  assert.throws(() => knob('nope'), /Unknown knob/);
  assert.ok(Number.isNaN(setKnob('nope', 1)));
}

export function gameKnobsComeAfterTheEngineAndGoWithTheGame() {
  useGameKnobs([
    { name: 'inkLimit', label: 'Ink limit', value: 0.2, min: 0, max: 1, step: 0.01 },
    { name: 'edgeLow', label: 'stolen', value: 5, min: 0, max: 10, step: 1 }, // an engine name: skipped
  ]);
  assert.deepEqual(listKnobs().map((k) => k.name), ['edgeLow', 'edgeHigh', 'inkLimit']);
  assert.equal(knob('edgeLow'), 40);
  setKnob('inkLimit', 0.5);
  setKnob('edgeLow', 60);
  useGameKnobs(); // another game: its knobs gone, all values back to default
  assert.equal(knob('edgeLow'), 40);
  assert.throws(() => knob('inkLimit'));
}
