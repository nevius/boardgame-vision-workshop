import assert from 'node:assert/strict';
import { addLine, logLines, clearLog, onLog, toText, captureConsole } from '../engine/debug.js';

export function errorsBecomeText() {
  assert.equal(toText('hi'), 'hi');
  assert.equal(toText({ a: 1 }), '{"a":1}');
  assert.match(toText(new Error('boom')), /boom/);
}

export function keepsLinesAndTellsListeners() {
  clearLog();
  let calls = 0;
  const stop = onLog(() => calls++);
  addLine('warn', ['careful', 3]);
  stop();
  addLine('log', ['after']);
  assert.equal(calls, 1);
  assert.deepEqual(logLines().map((l) => [l.level, l.text]), [['warn', 'careful 3'], ['log', 'after']]);
}

export function capturesConsoleOfTarget() {
  clearLog();
  const seen = [];
  const target = { console: { log: (...a) => seen.push(a), info() {}, warn() {}, error() {} } };
  captureConsole(target);
  target.console.log('x', 1);
  assert.deepEqual(seen, [['x', 1]]);
  assert.equal(logLines().at(-1).text, 'x 1');
}
