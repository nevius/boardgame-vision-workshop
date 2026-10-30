// @ts-check
// The busy indicator (engine/busy.js): what is loading or working right now, at the top of the picture.
// A spinner (CSS, keeps turning while the page computes), plain words, a thin bar when the download size is known.
// A job with a delay fades in only after it (fast steps never flash). A failed job shows nothing here: its error
// goes to the mode chip (ui/mode-rules.js, issue #171), so one failure gives one message.
// Screen readers hear the words (aria-live="polite"). The plain pages use ui/busy-plain.js with the same classes.
import { html } from 'htm/preact';
import { BUSY_PILL, BUSY_SPINNER, BUSY_BAR, busyText } from './busy-plain.js';

/** @param {{ job: import('../engine/busy.js').BusyJob | null }} props */
export function Busy({ job }) {
  return html`
    <div role="status" aria-live="polite" class="pointer-events-none absolute top-2 left-1/2 z-30 flex w-full -translate-x-1/2 justify-center">
      ${job && !job.error && html`<div key=${job.id} class=${`relative ${BUSY_PILL}`} style=${{ animationDelay: `${job.delay}ms` }}>
          <span class=${BUSY_SPINNER} aria-hidden="true"></span>
          <span class="truncate">${busyText(job)}</span>
          ${job.progress !== null && html`<span class=${BUSY_BAR} style=${{ width: `${Math.round(job.progress * 100)}%` }}></span>`}
        </div>`}
    </div>
  `;
}
