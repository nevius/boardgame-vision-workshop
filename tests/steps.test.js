// @ts-check
// The Steps view's memory (engine/steps.js) and the stages the pure blocks record (engine/tiles.js, fewshot.js).
import assert from 'node:assert/strict';
import { setStepsOn, startSteps, recordStep, finishSteps, getSteps, showStep, grayToPicture, getScores } from '../engine/steps.js';
import { matchTile, topLabels } from '../engine/fewshot.js';
import { cutTiles } from '../engine/tiles.js';

const picture = (w = 4, h = 2) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });

export function recordsNothingWhileOff() {
  setStepsOn(false);
  let made = 0;
  startSteps();
  recordStep('camera', () => { made++; return picture(); });
  assert.deepEqual(finishSteps(), []);
  assert.equal(made, 0, 'a costly picture is not made while off');
}

export function keepsTheLastPicturePerStageInOrder() {
  setStepsOn(true);
  startSteps();
  const a = picture(); const b = picture(); const c = picture();
  recordStep('camera', a);
  recordStep('straightened', b);
  recordStep('camera', c, { quads: [[{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]] });
  assert.deepEqual(getSteps(), [], 'shown only when the frame is done');
  const steps = finishSteps();
  assert.deepEqual(steps.map((s) => s.name), ['camera', 'straightened']);
  assert.equal(steps[0].image, c);
  assert.equal(steps[0].quads?.length, 1);
  startSteps();
  assert.equal(getSteps().length, 2, 'the last frame stays shown while the next one runs');
  const d = picture();
  recordStep('camera', d); // a tracked frame: only the camera is new, the other stages stay
  showStep('ink', picture());
  const next = finishSteps();
  assert.deepEqual(next.map((s) => s.name), ['camera', 'straightened', 'ink']);
  assert.equal(next[0].image, d);
  assert.equal(next[1].image, b);
  setStepsOn(false);
  assert.deepEqual(getSteps(), []);
}

export function cutTilesRecordsTheGrid() {
  setStepsOn(true);
  startSteps();
  const board = picture(6, 6);
  cutTiles(board, 3, 3);
  const [step] = finishSteps();
  assert.equal(step.name, 'tiles');
  assert.equal(step.image, board);
  assert.equal(step.boxes?.length, 9);
  setStepsOn(false);
}

export function grayBecomesRgba() {
  const p = grayToPicture([0, 255], 2, 1);
  assert.deepEqual([...p.data], [0, 0, 0, 255, 255, 255, 255, 255]);
}

export function topLabelsGivesTheBestThreeNames() {
  const refs = [
    { label: 'a', embedding: [1, 0] }, { label: 'a', embedding: [0.9, 0.1] },
    { label: 'b', embedding: [0.7, 0.7] }, { label: 'c', embedding: [0, 1] }, { label: 'd', embedding: [-1, 0] },
  ];
  const top = topLabels([1, 0], refs);
  assert.deepEqual(top.map((t) => t.label), ['a', 'b', 'c'], 'one entry per name, best first, at most 3');
  assert.equal(top[0].score, 1);
  assert.equal(top[1].score, 0.707);
  assert.deepEqual(topLabels([1, 0], []), []);
}

export function matchTileKeepsScoresOnlyWhileOn() {
  const refs = [{ label: 'x', embedding: [1, 0] }, { label: 'o', embedding: [0, 1] }];
  setStepsOn(false);
  startSteps();
  matchTile([1, 0], refs);
  finishSteps();
  assert.deepEqual(getScores(), []);
  setStepsOn(true);
  startSteps();
  matchTile([1, 0], refs);
  matchTile([0.2, 1], refs);
  finishSteps();
  const scores = getScores();
  assert.deepEqual(scores.map((s) => s.label), ['x', 'o']);
  assert.deepEqual(scores[0].top.map((t) => t.label), ['x', 'o']);
  assert.equal(scores[0].backend, null, 'own numbers, no embedder');
  startSteps();
  finishSteps();
  assert.equal(getScores().length, 2, 'a frame without tiles keeps the last scores');
  setStepsOn(false);
  assert.deepEqual(getScores(), []);
}
