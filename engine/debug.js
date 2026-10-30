// @ts-check
// Debug overlay data: catches console messages and errors so the phone can show them on screen
// (no USB debugging needed). captureConsole() once at start; the overlay reads logLines().
// The console still works as before; this only keeps a copy.

const KEEP = 100;  // keep the last 100 lines

/** @typedef {{ level: 'log' | 'info' | 'warn' | 'error', text: string, time: string }} LogLine */

/** @type {LogLine[]} */
const lines = [];
/** @type {Set<() => void>} */
const listeners = new Set();
let captured = false;

// One value → readable text. Errors show their message (and stack when there is one).
/** @param {any} value */
export function toText(value) {
  if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`;
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value) ?? String(value); } catch { return String(value); }
}

// Adds a line and tells the overlay to redraw.
/** @param {LogLine['level']} level @param {any[]} args */
export function addLine(level, args) {
  lines.push({ level, text: args.map(toText).join(' '), time: new Date().toTimeString().slice(0, 8) });
  if (lines.length > KEEP) lines.shift();
  for (const listener of listeners) listener();
}

// The lines so far, oldest first.
export function logLines() {
  return lines.slice();
}

export function clearLog() {
  lines.length = 0;
  for (const listener of listeners) listener();
}

// Calls fn on every new line. Returns a function that stops it.
/** @param {() => void} fn */
export function onLog(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Keeps a copy of console.log/info/warn/error, uncaught errors and failed promises. Safe to call twice.
/** @param {any} [target] the window (tests pass a fake one) */
export function captureConsole(target = globalThis) {
  if (captured) return;
  captured = true;
  for (const level of /** @type {const} */ (['log', 'info', 'warn', 'error'])) {
    const original = target.console[level].bind(target.console);
    target.console[level] = (...args) => {
      original(...args);
      addLine(level, args);
    };
  }
  target.addEventListener?.('error', (/** @type {ErrorEvent} */ e) => {
    addLine('error', [e.error ?? `${e.message} (${e.filename}:${e.lineno})`]);
  });
  target.addEventListener?.('unhandledrejection', (/** @type {PromiseRejectionEvent} */ e) => {
    addLine('error', ['Unhandled promise:', e.reason]);
  });
}
