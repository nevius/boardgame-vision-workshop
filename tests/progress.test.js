// @ts-check
// Download progress words (engine/progress.js, issue #162): speed, time left, text, the total line.
import assert from 'node:assert/strict';
import { createMeter, etaSeconds, mb, progressText, totalView } from '../engine/progress.js';
import { startBusy, currentBusy, fetchBytes } from '../engine/busy.js';
import { busyText } from '../ui/busy-plain.js';

const MB = 1e6;

export function textForKnownUnknownAndDone() {
  assert.equal(mb(3_240_000), '3.2');
  assert.equal(progressText(3.2 * MB, 10.1 * MB, 6), '3.2 / 10.1 MB · ~6 s left');
  assert.equal(progressText(3.2 * MB, 10.1 * MB, null), '3.2 / 10.1 MB');
  assert.equal(progressText(9.9 * MB, 10.1 * MB, 1), '9.9 / 10.1 MB · almost done');
  assert.equal(progressText(3.2 * MB, null, null), '3.2 MB · loading…');
  assert.equal(progressText(10.1 * MB, 10.1 * MB, 3, true), '10.1 MB');
}

export function etaWaitsForSpeedAndRoundsUp() {
  assert.equal(etaSeconds(1 * MB, 10 * MB, 2 * MB, 400), null, 'first 0.5 s: no countdown');
  assert.equal(etaSeconds(1 * MB, 10 * MB, 2 * MB, 600), 5, '9 MB at 2 MB/s = 4.5 s → 5');
  assert.equal(etaSeconds(1 * MB, null, 2 * MB, 600), null, 'size unknown');
  assert.equal(etaSeconds(1 * MB, 10 * MB, 0, 600), null, 'no speed');
}

export function meterMeasuresSpeedOverTheLastSeconds() {
  const m = createMeter(0);
  for (let t = 100; t <= 1000; t += 100) m.update(t * 1000, 10 * MB, t); // 1 MB/s
  const v = m.view(1000);
  assert.ok(v.rate !== null && Math.abs(v.rate - 1 * MB) < 1, `rate ${v.rate}`);
  assert.equal(v.eta, 9); // 9 MB left at 1 MB/s
  assert.equal(v.text, '1.0 / 10.0 MB · ~9 s left');
  assert.equal(v.fraction, 0.1);
}

export function meterHidesCountdownAtFirst() {
  const m = createMeter(0);
  m.update(0.2 * MB, 10 * MB, 200);
  assert.equal(m.view(200).eta, null);
  assert.equal(m.view(200).text, '0.2 / 10.0 MB');
}

export function countdownNeverJumpsUpMuch() {
  const m = createMeter(0);
  for (let t = 100; t <= 2000; t += 100) m.update(t * 1000, 10 * MB, t); // 1 MB/s: 8 s left at 2 s
  const before = /** @type {number} */ (m.view(2000).eta);
  // The connection stalls for a second: hardly any new bytes.
  m.update(2.01 * MB, 10 * MB, 3000);
  const after = /** @type {number} */ (m.view(3000).eta);
  assert.ok(after <= before + 1, `${before} → ${after}`);
}

export function moreBytesThanAnnouncedMeansSizeUnknown() {
  const m = createMeter(0);
  m.update(5 * MB, 4 * MB, 1000); // compressed: the browser gives more bytes than the header said
  const v = m.view(1000);
  assert.equal(v.total, null);
  assert.equal(v.text, '5.0 MB · loading…');
}

export function finishedMeterShowsSizeOnly() {
  const m = createMeter(0);
  m.update(4 * MB, 4 * MB, 1000);
  m.finish();
  const v = m.view(1000);
  assert.equal(v.done, true);
  assert.equal(v.fraction, 1);
  assert.equal(v.text, '4.0 MB');
}

export function totalSumsAndWaitsForTheSlowestFile() {
  const view = (/** @type {number} */ loaded, /** @type {number | null} */ total, /** @type {number | null} */ eta, done = false) =>
    ({ loaded, total, eta, done, rate: null, fraction: null, text: '' });
  assert.equal(totalView([view(3 * MB, 10 * MB, 6), view(4.4 * MB, 15 * MB, 12)]).text, '7.4 / 25.0 MB · ~12 s left');
  assert.equal(totalView([view(3 * MB, 10 * MB, 6), view(1 * MB, null, null)]).text, '4.0 MB · loading…');
  assert.equal(totalView([view(10 * MB, 10 * MB, null, true), view(4.4 * MB, 15 * MB, 3)]).text, '14.4 / 25.0 MB · ~3 s left');
  const done = totalView([view(10 * MB, 10 * MB, null, true), view(2 * MB, null, null, true)]);
  assert.equal(done.done, true);
  assert.equal(done.text, '12.0 MB');
}

export function busyPillShowsMegabytes() {
  const before = currentBusy();
  let now = 0;
  const job = startBusy('Loading hand model…', { now: () => now });
  try {
    now = 1000;
    job.bytes(null, 2 * MB, 8 * MB);
    const shown = /** @type {import('../engine/busy.js').BusyJob} */ (currentBusy());
    assert.equal(shown.progress, 0.25);
    assert.equal(busyText(shown), 'Loading hand model… 2.0 / 8.0 MB · ~3 s left');
  } finally {
    job.done();
  }
  assert.equal(currentBusy(), before);
}

export async function fetchBytesReportsBytesWithoutSize() {
  const parts = [new Uint8Array([1, 2]), new Uint8Array([3])];
  const fakeFetch = async () => new Response(new ReadableStream({
    start(c) { parts.forEach((p) => c.enqueue(p)); c.close(); },
  }));
  const steps = [];
  const bytes = await fetchBytes('x', (f, loaded, total) => steps.push([f, loaded, total]), /** @type {any} */ (fakeFetch));
  assert.equal(bytes.length, 3);
  assert.deepEqual(steps, [[null, 2, null], [null, 3, null]]);
}
