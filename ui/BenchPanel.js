// @ts-check
// Benchmark tab of the sheet. On top one line: "Your phone: good / ok / slow for <game>" with the Speed mode and
// WebGPU or WASM. Below, each value next to its target ("detect 180 / 200 ms") with a verdict in colour and word.
// Targets: engine/bench.js TARGETS. "Copy" puts the table on the clipboard as plain text. Nothing leaves the phone.
import { html } from 'htm/preact';
import { overall, overallLine, rowText } from '../engine/bench.js';

const BUTTON = 'min-h-11 rounded-xl bg-neutral-800 px-3 text-sm font-medium text-neutral-100 active:bg-neutral-700';

// Whole class names (Tailwind finds only those): verdict → colour.
const COLOR = { good: 'text-emerald-400', ok: 'text-amber-400', slow: 'text-red-400' };
const BANNER = { good: 'bg-emerald-900/60 text-emerald-100', ok: 'bg-amber-900/60 text-amber-100', slow: 'bg-red-900/60 text-red-100' };

/**
 * @param {{
 *   report: import('../engine/bench.js').BenchReport,
 *   rows: import('../engine/bench.js').BenchRow[],
 *   onCopy: () => void, onReset: () => void,
 * }} props
 */
export function BenchPanel({ report, rows, onCopy, onReset }) {
  const worst = overall(rows);
  const info = [
    ['Device', [report.device, report.browser].filter(Boolean).join(', ')],
    ['Backend', report.backend || '– (no model yet)'],
    ['Detect rate', report.detectRate == null ? '–' : `${report.detectRate} per second`],
    ['Analysis size', report.analysis || '–'],
  ];
  return html`
    <div class="min-h-0 flex-1 overflow-auto text-sm text-neutral-200">
      <p class=${`rounded-lg px-3 py-2 font-semibold ${worst ? BANNER[worst] : 'bg-neutral-800 text-neutral-300'}`}>
        ${overallLine(report, rows)}
      </p>
      <table class="mt-2 w-full">
        <tr class="text-xs text-neutral-400"><td>Value</td><td>measured / target</td><td></td></tr>
        ${rows.map((row) => html`
          <tr key=${row.name}>
            <td class="pr-3 text-neutral-400">${row.name}${row.important ? '' : ' ·'}</td>
            <td class="font-mono">${rowText(row)}</td>
            <td class=${`text-right font-semibold ${row.verdict ? COLOR[row.verdict] : 'text-neutral-400'}`}>${row.verdict ?? '–'}</td>
          </tr>`)}
        ${info.map(([k, v]) => html`<tr key=${k}><td class="pr-3 text-neutral-400">${k}</td><td class="font-mono" colspan="2">${v}</td></tr>`)}
      </table>
      <p class="mt-1 text-xs text-neutral-400">· = not counted in the top line. good: within the target; ok: up to twice as slow; slow: worse.</p>
      <div class="mt-2 flex gap-2">
        <button type="button" class=${`${BUTTON} flex-1`} onClick=${onCopy}>Copy</button>
        <button type="button" class=${BUTTON} onClick=${onReset}>Reset times</button>
      </div>
    </div>
  `;
}
