// @ts-check
// Console messages and errors in the Log tab of the sheet, so a phone needs no USB debugging. Newest at the bottom.
import { html } from 'htm/preact';

const COLORS = { log: 'text-neutral-200', info: 'text-sky-300', warn: 'text-amber-300', error: 'text-red-400' };

/** @param {{ lines: import('../engine/debug.js').LogLine[], onClear: () => void }} props */
export function DebugOverlay({ lines, onClear }) {
  return html`
    <div class="flex min-h-0 flex-1 flex-col rounded-lg bg-neutral-950/60 p-2 text-xs">
      <div class="flex items-center justify-between text-neutral-400">
        <span>Log (${lines.length})</span>
        <button type="button" class="min-h-11 px-3 text-sm text-neutral-200" onClick=${onClear}>Clear</button>
      </div>
      <pre class="min-h-0 flex-1 overflow-auto font-mono whitespace-pre-wrap">${lines.length === 0 ? 'No messages yet.' : lines.map((l, i) => html`<div key=${i} class=${COLORS[l.level]}>${l.time} ${l.text}</div>`)}</pre>
    </div>
  `;
}
