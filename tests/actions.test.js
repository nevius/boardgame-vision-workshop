import assert from 'node:assert/strict';
import { setActions, setInfo, setPip, clearGameUi, gameUi, onGameUi, MAX_ACTIONS } from '../engine/actions.js';

const action = (id, more = false) => ({ id, icon: 'box', label: id, onTap: () => {}, more });

export function atMostFourActionsOnThePicture() {
  const seen = [];
  onGameUi((ui) => seen.push(ui));
  const warn = console.warn;
  console.warn = () => {};
  try {
    setActions([action('1'), action('2'), action('forget', true), action('3'), action('4'), action('5')]);
  } finally {
    console.warn = warn;
  }
  const ids = gameUi().actions.map((a) => a.id);
  assert.equal(ids.filter((id) => id !== 'forget').length, MAX_ACTIONS);
  assert.ok(ids.includes('forget')); // rare ones go to the ⋯ sheet, any number
  assert.ok(!ids.includes('5'));
  assert.equal(seen.length, 1);
  onGameUi(() => {});
}

export function infoPipAndClear() {
  setInfo('A24 · roll 1–2');
  setPip({ label: 'Pieces', draw: () => {} });
  assert.equal(gameUi().info, 'A24 · roll 1–2');
  assert.equal(gameUi().pip?.label, 'Pieces');
  clearGameUi();
  assert.deepEqual(gameUi(), { actions: [], info: '', pip: null });
}
