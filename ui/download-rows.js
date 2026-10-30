// @ts-check
// The pre-flight download list (issue #162), shared by the demo launcher (workshop/launcher.js) and the device
// check (check.js): one row per big file with a thin bar and "3.2 / 10.1 MB · ~6 s left", plus a total line on
// top. All files download side by side. A file already on the device (#136 cache) shows "from device ✓" at once.
// The maths is in engine/progress.js. Plain DOM (no Preact); styles: `.checks .bar` in tailwind.css.
import { fetchBytes } from '../engine/busy.js';
import { createMeter, totalView, mb } from '../engine/progress.js';
import { isOnDevice } from '../engine/offline.js';

export const TICK_MS = 250; // the rows redraw 4 times per second, not on every chunk

/** @typedef {{ bytes: Uint8Array | null, note: string }} Downloaded */

/**
 * Adds the rows to `list` and starts the downloads. Returns one line and one promise per file name: the page's
 * own check then waits for the promise and writes its result into the line.
 * @param {HTMLElement} list
 * @param {{ name: string, url: () => Promise<string | null> }[]} files
 */
export function downloadRows(list, files) {
  const totalLine = row('Total');
  totalLine.line.dataset.total = '1';
  list.append(totalLine.line);
  const items = files.map((file) => {
    const r = row(file.name);
    list.append(r.line);
    return { ...file, ...r, meter: createMeter(performance.now()), state: /** @type {'run' | 'device' | 'done' | 'failed'} */ ('run') };
  });

  const draw = () => {
    const now = performance.now();
    const views = items.map((it) => it.meter.view(now));
    items.forEach((it, i) => { if (it.state === 'run') it.show(views[i].text, views[i].fraction); });
    const total = totalView(views);
    const failed = items.some((it) => it.state === 'failed');
    totalLine.show(failed ? `${mb(total.loaded)} MB, a download failed` : total.done ? `${mb(total.loaded)} MB ✓` : total.text,
      total.done ? 1 : total.total ? total.loaded / total.total : null);
    totalLine.line.className = failed ? 'bad' : total.done ? 'good' : 'wait';
  };
  const timer = setInterval(draw, TICK_MS);

  /** @type {Map<string, { line: HTMLLIElement, ready: Promise<Downloaded> }>} */
  const rows = new Map();
  const all = items.map((it) => {
    const ready = (async () => {
      try {
        const url = await it.url();
        if (!url) {
          it.meter.finish();
          it.state = 'done';
          it.show('loads with the library', 1);
          return { bytes: null, note: '' };
        }
        if (await isOnDevice(url).catch(() => false)) {
          it.state = 'device';
          it.show('from device ✓', 1);
        }
        const bytes = await fetchBytes(url, (_f, loaded, total) => it.meter.update(loaded, total, performance.now()));
        it.meter.update(bytes.length, bytes.length, performance.now());
        it.meter.finish();
        const fromDevice = it.state === 'device';
        it.state = 'done';
        it.show(fromDevice ? 'from device ✓' : `${mb(bytes.length)} MB ✓`, 1);
        return { bytes, note: fromDevice ? 'from device' : `${mb(bytes.length)} MB downloaded` };
      } catch (err) {
        it.meter.finish();
        it.state = 'failed';
        throw err;
      }
    })();
    ready.catch(() => {}); // the page's own check reports the error
    rows.set(it.name, { line: it.line, ready });
    return ready;
  });
  Promise.allSettled(all).then(() => { clearInterval(timer); draw(); });
  draw();
  return rows;
}

// A check's result plus where its file came from: "loaded, runs on GPU, 7.8 MB downloaded".
/** @template {{ text: string }} R @param {R} result @param {Downloaded} d @returns {R} */
export function withNote(result, d) {
  return d.note ? { ...result, text: `${result.text}, ${d.note}` } : result;
}

// One line: "… name · text" and a bar under it. fraction null = size unknown: the bar moves to and fro.
/** @param {string} name */
function row(name) {
  const line = document.createElement('li');
  line.className = 'wait';
  const text = document.createElement('span');
  const bar = document.createElement('span');
  bar.className = 'bar';
  const fill = document.createElement('span');
  bar.append(fill);
  line.append(text, bar);
  /** @param {string} words @param {number | null} fraction */
  const show = (words, fraction) => {
    text.textContent = `${fraction === 1 ? '' : '… '}${name} · ${words}`;
    bar.classList.toggle('moving', fraction === null);
    fill.style.width = fraction === null ? '' : `${Math.round(fraction * 100)}%`;
  };
  show('waiting…', 0);
  return { line, show };
}
