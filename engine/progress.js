// @ts-check
// Download progress in plain words (issue #162): "3.2 / 10.1 MB · ~6 s left". One place for the maths
// (speed, time left, text), used by the pre-flight list (ui/download-rows.js) and the busy pill (engine/busy.js).
// Pure: the caller passes the time in ms, so tests need no clock.

export const WINDOW_MS = 2000;  // speed = bytes over about the last 2 s
export const QUIET_MS = 500;    // no countdown in the first 0.5 s (no speed yet)
export const ALMOST_S = 2;      // under 2 s left: "almost done"
export const STEP_MS = 250;     // a new countdown at most 4 times per second
export const MAX_UP_S = 1;      // the countdown never goes up by more than 1 s per step

/** @typedef {{ loaded: number, total: number | null, rate: number | null, eta: number | null, fraction: number | null, done: boolean, text: string }} ProgressView */

// One meter per download. update(loaded, total, now) on every chunk; view(now) gives the numbers and the text.
// total: the size the server announced, or null/0 when unknown. When more bytes arrive than announced (a
// compressed download), the size counts as unknown from then on.
export function createMeter(start = 0) {
  /** @type {{ t: number, loaded: number }[]} */
  let samples = [{ t: start, loaded: 0 }];
  let loaded = 0;
  /** @type {number | null} */
  let total = null;
  /** @type {number | null} */
  let rate = null;
  /** @type {number | null} */
  let eta = null;
  let stepAt = -Infinity;
  let done = false;

  return {
    /** @param {number} bytes @param {number | null | undefined} size @param {number} now */
    update(bytes, size, now) {
      loaded = bytes;
      total = size && size >= bytes ? size : null;
      samples.push({ t: now, loaded });
      // Keep the samples of the last WINDOW_MS, plus one older one as the start of the window.
      while (samples.length > 2 && now - samples[1].t >= WINDOW_MS) samples.shift();
    },
    finish() { done = true; },
    /** @param {number} now @returns {ProgressView} */
    view(now) {
      if (now - stepAt >= STEP_MS) {
        stepAt = now;
        const first = samples[0];
        const last = samples.at(-1) ?? first;
        const ms = last.t - first.t;
        const fresh = ms > 0 ? ((last.loaded - first.loaded) / ms) * 1000 : null;
        // Smooth: half the old speed, half the new one.
        rate = fresh === null ? rate : rate === null ? fresh : (rate + fresh) / 2;
        const raw = etaSeconds(loaded, total, rate, now - start);
        eta = raw === null || eta === null ? raw : Math.min(raw, eta + MAX_UP_S);
      }
      const fraction = total ? Math.min(1, loaded / total) : null;
      return { loaded, total, rate, eta, fraction: done ? 1 : fraction, done, text: progressText(loaded, total, done ? null : eta, done) };
    },
  };
}

// Seconds left, rounded up to whole seconds. null while there is no speed yet or the size is unknown.
/** @param {number} loaded @param {number | null} total @param {number | null} rate bytes per s @param {number} elapsed ms */
export function etaSeconds(loaded, total, rate, elapsed) {
  if (!total || !rate || rate <= 0 || elapsed < QUIET_MS) return null;
  return Math.max(0, Math.ceil((total - loaded) / rate));
}

// Megabytes with one decimal: 3_200_000 → "3.2". Decimal MB, like the phone's own download screens.
/** @param {number} bytes */
export function mb(bytes) {
  return (bytes / 1e6).toFixed(1);
}

// "3.2 / 10.1 MB · ~6 s left", "3.2 MB · loading…" (size unknown), "… · almost done", "10.1 MB" (done).
/** @param {number} loaded @param {number | null} total @param {number | null} eta @param {boolean} [done] */
export function progressText(loaded, total, eta, done = false) {
  if (done) return `${mb(loaded)} MB`;
  if (!total) return `${mb(loaded)} MB · loading…`;
  const size = `${mb(loaded)} / ${mb(total)} MB`;
  if (eta === null) return size;
  return eta < ALMOST_S ? `${size} · almost done` : `${size} · ~${eta} s left`;
}

// The total line over several downloads: sums the bytes; the time left is the longest one still running
// (they download side by side). Size unknown while a running file's size is unknown.
/** @param {ProgressView[]} views */
export function totalView(views) {
  const loaded = views.reduce((sum, v) => sum + v.loaded, 0);
  const known = views.every((v) => v.done || v.total !== null);
  const total = known ? views.reduce((sum, v) => sum + (v.total ?? v.loaded), 0) : null;
  const running = views.filter((v) => !v.done);
  const etas = running.map((v) => v.eta);
  const eta = running.length && etas.every((e) => e !== null) ? Math.max(.../** @type {number[]} */ (etas)) : null;
  const done = running.length === 0;
  return { loaded, total, eta, done, text: progressText(loaded, total, eta, done && views.length > 0) };
}
