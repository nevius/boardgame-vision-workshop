// @ts-check
// The busy indicator (engine/busy.js) for the plain pages (check.html, warp.html, tiles.html): no Preact there.
// A plain page calls mountBusy() once. The app uses ui/Busy.js, with the same look (classes below).
import { currentBusy, onBusy } from '../engine/busy.js';

// Shared with ui/Busy.js. The spinner turns with a CSS animation, so it keeps moving while the page computes.
export const BUSY_PILL = 'pointer-events-none flex max-w-[85%] animate-busy-in items-center gap-2 overflow-hidden rounded-full bg-neutral-800 px-3 py-1.5 text-xs text-neutral-100 shadow-lg ring-1 ring-white/10';
export const BUSY_ERROR = 'pointer-events-none flex max-w-[85%] items-center gap-2 rounded-full bg-red-900 px-3 py-1.5 text-xs text-neutral-100 shadow-lg ring-1 ring-white/10';
export const BUSY_SPINNER = 'size-3.5 shrink-0 animate-spin rounded-full border-2 border-sky-400 border-t-transparent motion-reduce:animate-pulse';
export const BUSY_BAR = 'absolute bottom-0 left-0 h-0.5 bg-sky-400';

/** @param {import('../engine/busy.js').BusyJob | null} job @param {HTMLElement} box */
export function fillBusy(job, box) {
  // Same job, only new progress: update the words and the bar in place (no new fade-in on every chunk).
  const old = /** @type {HTMLElement | null} */ (box.firstElementChild);
  if (job && !job.error && old?.dataset.job === String(job.id) && !old.dataset.error) {
    const text = /** @type {HTMLElement} */ (old.querySelector('.truncate'));
    text.textContent = busyText(job);
    const bar = /** @type {HTMLElement | null} */ (old.querySelector('[data-bar]'));
    if (bar && job.progress !== null) { bar.style.width = `${Math.round(job.progress * 100)}%`; return; }
    if (!bar && job.progress === null) return;
  }
  box.replaceChildren();
  if (!job) return;
  const pill = document.createElement('div');
  pill.className = job.error ? BUSY_ERROR : `relative ${BUSY_PILL}`;
  pill.style.animationDelay = `${job.delay}ms`;
  pill.dataset.job = String(job.id);
  if (job.error) pill.dataset.error = '1';
  if (!job.error) {
    const spinner = document.createElement('span');
    spinner.className = BUSY_SPINNER;
    spinner.setAttribute('aria-hidden', 'true');
    pill.append(spinner);
  }
  const text = document.createElement('span');
  text.className = 'truncate';
  text.textContent = job.error || busyText(job);
  pill.append(text);
  if (!job.error && job.progress !== null) {
    const bar = document.createElement('span');
    bar.className = BUSY_BAR;
    bar.dataset.bar = '1';
    bar.style.width = `${Math.round(job.progress * 100)}%`;
    pill.append(bar);
  }
  box.append(pill);
}

// The words: the label, plus the megabytes and time left of a download (engine/progress.js, issue #162),
// else the percentage when only a fraction is known.
/** @param {import('../engine/busy.js').BusyJob} job */
export function busyText(job) {
  if (job.detail) return `${job.label} ${job.detail}`;
  return job.progress === null ? job.label : `${job.label} ${Math.round(job.progress * 100)} %`;
}

// Adds the indicator to the page (fixed at the top) and keeps it up to date.
export function mountBusy() {
  const box = document.createElement('div');
  box.setAttribute('role', 'status');
  box.setAttribute('aria-live', 'polite');
  box.className = 'fixed top-2 left-1/2 z-50 flex -translate-x-1/2 justify-center';
  document.body.append(box);
  fillBusy(currentBusy(), box);
  onBusy((job) => fillBusy(job, box));
}
