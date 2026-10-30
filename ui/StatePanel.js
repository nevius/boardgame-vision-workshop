// @ts-check
// The state and move as JSON, in the State tab of the sheet.
import { html } from 'htm/preact';

/** @param {{ text: string }} props */
export function StatePanel({ text }) {
  return html`
    <pre class="min-h-0 flex-1 overflow-auto rounded-lg bg-neutral-950/60 p-3 font-mono text-xs whitespace-pre-wrap text-neutral-200">${text}</pre>
  `;
}
