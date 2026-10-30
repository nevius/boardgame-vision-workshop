// @ts-check
// Ubongo piece names (issue #61): shape letter + cube count (games/ubongo.js), and the line in the corner chip.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PIECES, LETTERS, pieceName, loadCards, infoLine } from '../games/ubongo.js';

export function namesAreUniquePerColour() {
  const seen = new Set();
  for (const p of Object.values(PIECES)) {
    const key = `${p.color} ${p.name}`;
    assert.ok(!seen.has(key), `two ${key} pieces`);
    seen.add(key);
  }
}

export function nameNumberIsTheCubeCountAndArrowMeansACubeOnTop() {
  for (const [key, p] of Object.entries(PIECES)) {
    const match = /^([A-Z])(\d+)([ab])?(↑)?$/.exec(p.name);
    assert.ok(match, `${key}: ${p.name} reads letter + number`);
    assert.equal(Number(match[2]), p.cubes.length, `${key}: ${p.name} counts all cubes`);
    assert.equal(Boolean(match[4]), p.cubes.some(([layer]) => layer > 0), `${key}: ↑ only when a cube is on top`);
  }
}

export function legendCoversEveryLetterUsed() {
  const text = readFileSync(new URL('../games/ubongo.js', import.meta.url), 'utf8');
  for (const p of Object.values(PIECES)) assert.ok(LETTERS.includes(p.name[0]), `${p.name} uses a known letter`);
  for (const letter of LETTERS) assert.match(text, new RegExp(`^//\\s.*\\s${letter}  \\S`, 'm'), `legend explains ${letter}`);
}

export function oldLearnedCardsStillWork() {
  // Cards learned before #61 store piece keys like 'red2'. The keys did not change, so they load as they are
  // and show the new names.
  const old = { 'A|abc': { type: 'A', confirmed: true, pieces: { '1–2': ['green4', 'red2', 'yellow3'] } } };
  const cards = loadCards({ getItem: () => JSON.stringify(old) });
  const pieces = cards['A|abc'].pieces['1–2'];
  assert.ok(pieces.every((p) => p in PIECES));
  assert.deepEqual(pieces.map(pieceName), ['L5↑', 'O5↑', 'U5']);
  assert.equal(pieceName('?'), '?');
}

export function infoLineIsOneShortLine() {
  const state = { corners: [{ x: 0, y: 0 }], area: null, tapped: false, grid: ['##'], pieces: ['red2'], card: 'A24', field: 'top', roll: '1–2', print: 'p', known: true };
  assert.equal(infoLine(state, { placements: [] }), 'A24 · roll 1–2 · top · solved');
  assert.equal(infoLine({ ...state, pieces: [] }, null), 'A24 · roll 1–2 · top · no pieces yet');
  assert.match(infoLine({ ...state, known: false }, null), /^New card: check it in More · A24 .* no solution$/); // what to do first
  assert.match(infoLine({ ...state, corners: null }, null), /No Ubongo card found/);
}
