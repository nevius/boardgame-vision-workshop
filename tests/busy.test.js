// @ts-check
// The busy indicator's state (engine/busy.js, issue #134): on/off order, errors that end, latest tap wins.
import assert from 'node:assert/strict';
import { busy, startBusy, currentBusy, onBusy, latestWins, fetchBytes } from '../engine/busy.js';

export async function newestJobShowsAndGoesWhenDone() {
  const before = currentBusy(); // another test file may have left an error that has not timed out yet
  const seen = [];
  const stop = onBusy((job) => seen.push(job?.label ?? null));
  try {
    const a = startBusy('Loading OpenCV…');
    const b = startBusy('Reading photo 1 of 3…');
    assert.equal(currentBusy()?.label, 'Reading photo 1 of 3…');
    b.done();
    assert.equal(currentBusy()?.label, 'Loading OpenCV…');
    a.done();
    a.done(); // twice is harmless
    assert.equal(currentBusy(), before);
    assert.deepEqual(seen, ['Loading OpenCV…', 'Reading photo 1 of 3…', 'Loading OpenCV…', before?.label ?? null]);
  } finally {
    stop();
  }
}

export function progressStaysBetweenZeroAndOne() {
  const before = currentBusy();
  const job = startBusy('Loading hand model…');
  job.progress(1.7);
  assert.equal(currentBusy()?.progress, 1);
  job.progress(null);
  assert.equal(currentBusy()?.progress, null);
  job.done();
  job.progress(0.5); // after done: no effect, no job comes back
  assert.equal(currentBusy(), before);
}

export async function failureTurnsIntoTheErrorThenGoes() {
  await assert.rejects(busy('Loading OpenCV…', async () => { throw new Error('offline'); }), /offline/);
  assert.match(currentBusy()?.error ?? '', /Loading OpenCV failed: offline/);
  const errorJob = currentBusy();
  // A new job shows over the error; when it is done the error is still there until its time is up.
  const value = await busy('Reading the board…', () => 42);
  assert.equal(value, 42);
  assert.equal(currentBusy(), errorJob);
}

export async function latestTapWinsAndTapsDoNotQueue() {
  const ran = [];
  /** @type {() => void} */
  let finish = () => {};
  const read = latestWins(async (/** @type {number} */ n) => {
    ran.push(n);
    if (n === 1) await new Promise((resolve) => { finish = () => resolve(undefined); });
  });
  const first = read(1);
  await read(2);
  await read(3);
  await read(4);
  finish();
  await first;
  assert.deepEqual(ran, [1, 4]);
  await read(5); // idle again: runs right away
  assert.deepEqual(ran, [1, 4, 5]);
}

export async function fetchBytesReportsProgressAndThrowsWhenNotOk() {
  const parts = [new Uint8Array([1, 2]), new Uint8Array([3, 4])];
  const fakeFetch = async () => new Response(new ReadableStream({
    start(c) { parts.forEach((p) => c.enqueue(p)); c.close(); },
  }), { headers: { 'content-length': '4' } });
  const steps = [];
  const bytes = await fetchBytes('x', (f) => steps.push(f), /** @type {any} */ (fakeFetch));
  assert.deepEqual([...bytes], [1, 2, 3, 4]);
  assert.deepEqual(steps, [0.5, 1]);
  const notFound = async () => new Response('', { status: 404, statusText: 'Not Found' });
  await assert.rejects(fetchBytes('x', undefined, /** @type {any} */ (notFound)), /404/);
}
