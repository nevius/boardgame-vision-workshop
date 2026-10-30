// @ts-check
// One busy indicator for the whole app (issue #134): what is loading or working right now, in plain words.
// Code that starts something big calls busy(label, work) (or startBusy for more control); the page shows the
// newest job (ui/Busy.js in the app, ui/busy-plain.js on the plain pages). A job always ends: done or failed.
// Pure: no DOM here, so tests can run it in Node.
import { createMeter } from './progress.js';

/** @typedef {{ id: number, label: string, progress: number | null, detail: string, delay: number, error: string }} BusyJob */

export const ERROR_MS = 4000;  // a failed job shows its error this long, then it goes

/** @type {BusyJob[]} */
let jobs = [];
let nextId = 1;
/** @type {Set<(job: BusyJob | null) => void>} */
const listeners = new Set();

const tell = () => { const job = currentBusy(); listeners.forEach((fn) => fn(job)); };

// The job to show: the newest one (an error counts until its time is up). null when nothing runs.
/** @returns {BusyJob | null} */
export function currentBusy() {
  return jobs.at(-1) ?? null;
}

// Calls fn(job or null) on every change. Returns a function that stops it.
/** @param {(job: BusyJob | null) => void} fn */
export function onBusy(fn) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

// Starts a job. label: plain words ("Loading OpenCV…"). delay: ms before it shows (for steps that are often
// fast; the page fades it in with a CSS delay, so it also appears while the main thread is busy).
// Returns { progress(fraction 0..1), bytes(fraction, loaded, total), label(text), done(), fail(message) }.
// bytes fits fetchBytes: the pill then shows "3.2 / 10.1 MB · ~6 s left" (engine/progress.js, issue #162).
// Calling done/fail twice is harmless. now: the clock (tests pass their own).
/** @param {string} label @param {{ delay?: number, now?: () => number }} [options] */
export function startBusy(label, { delay = 0, now = () => performance.now() } = {}) {
  /** @type {BusyJob} */
  const job = { id: nextId++, label, progress: null, detail: '', delay, error: '' };
  /** @type {ReturnType<typeof createMeter> | null} */
  let meter = null;
  const startedAt = now();
  jobs.push(job);
  tell();
  let open = true;
  const update = (/** @type {Partial<BusyJob>} */ patch) => {
    if (!open) return;
    const i = jobs.indexOf(job);
    if (i < 0) return;
    jobs[i] = Object.assign(job, patch);
    tell();
  };
  const remove = () => {
    jobs = jobs.filter((j) => j !== job);
    tell();
  };
  return {
    progress: (/** @type {number | null} */ fraction) => update({ progress: fraction === null ? null : Math.max(0, Math.min(1, fraction)) }),
    bytes: (/** @type {number | null} */ _fraction, /** @type {number} */ loaded, /** @type {number | null} */ total) => {
      meter ??= createMeter(startedAt);
      meter.update(loaded, total, now());
      const view = meter.view(now());
      update({ progress: view.fraction, detail: view.text });
    },
    label: (/** @type {string} */ text) => update({ label: text }),
    done: () => {
      if (!open) return;
      open = false;
      remove();
    },
    fail: (/** @type {string} */ message) => {
      if (!open) return;
      update({ error: message, delay: 0, progress: null });
      open = false;
      setTimeout(remove, ERROR_MS);
    },
  };
}

// Runs work(job) under a busy label and ends the job when it finishes. A failure shows the error, then throws on.
/**
 * @template T
 * @param {string} label
 * @param {(job: ReturnType<typeof startBusy>) => Promise<T> | T} work
 * @param {{ delay?: number }} [options]
 * @returns {Promise<T>}
 */
export async function busy(label, work, options) {
  const job = startBusy(label, options);
  try {
    const result = await work(job);
    job.done();
    return result;
  } catch (err) {
    job.fail(`${label.replace(/…$/, '')} failed: ${/** @type {Error} */ (err)?.message ?? err}`);
    throw err;
  }
}

// Lets the browser paint once before heavy work, so a tap gets its feedback first.
export function nextPaint() {
  const g = /** @type {any} */ (globalThis);
  if (typeof g.requestAnimationFrame !== 'function') return new Promise((resolve) => setTimeout(resolve, 0));
  return new Promise((resolve) => g.requestAnimationFrame(() => setTimeout(resolve, 0)));
}

// Downloads a file and reports onProgress(fraction 0..1 or null, bytes loaded, total bytes or null) while it
// comes in. fraction and total are null when the server does not say how big it is (or the download is
// compressed and grows past the announced size). Returns the bytes. Throws when the response is not ok (offline).
/**
 * @param {string} url
 * @param {(fraction: number | null, loaded: number, total: number | null) => void} [onProgress]
 * @param {typeof fetch} [fetchFn]
 */
export async function fetchBytes(url, onProgress = () => {}, fetchFn = fetch) {
  const response = await fetchFn(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`.trim());
  const announced = Number(response.headers.get('content-length')) || 0;
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    onProgress(1, bytes.length, bytes.length);
    return bytes;
  }
  const reader = response.body.getReader();
  /** @type {Uint8Array[]} */
  const parts = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    got += value.length;
    const total = announced >= got ? announced : null;
    onProgress(total ? got / total : null, got, total);
  }
  const bytes = new Uint8Array(got);
  let at = 0;
  for (const part of parts) { bytes.set(part, at); at += part.length; }
  return bytes;
}

// Latest tap wins: wraps an async work(arg). While one call runs, new calls do not queue up: only the last
// argument waits and runs right after. Five fast taps on "next photo" read at most two photos, never five.
/** @template A @param {(arg: A) => Promise<void>} work @returns {(arg: A) => Promise<void>} */
export function latestWins(work) {
  let running = false;
  let waiting = false;
  /** @type {A} */
  let next;
  return async (arg) => {
    if (running) {
      next = arg;
      waiting = true;
      return;
    }
    running = true;
    try {
      let current = arg;
      for (;;) {
        try { await work(current); } catch (err) { console.error(err); }
        if (!waiting) break;
        waiting = false;
        current = next;
      }
    } finally {
      running = false;
    }
  };
}
