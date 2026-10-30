// @ts-check
// "Check my game" (issue #149): the sample photos through the game file that runs now, one row per TODO, the same
// rules as `pnpm learn <game>` (engine/learn.js). A row: ✓ or ✗, the TODO's name and score, a link to its lesson
// section (on GitHub, like the All pages page), and what failed (read vs. expected) with "Open photo" to look at
// that photo in the Steps view.
// A game without a learning track gets one row: how many photos are read as in their truth file.
// While it runs, the busy indicator and the mode chip say "Checking photo n of m…"; the page stays usable.
import { html } from 'htm/preact';
import { Icon } from './icons.js';
import { githubBase } from '../links.js';

/**
 * What the panel shows. results null = not run yet (or running).
 * @typedef {{ file: string, running: boolean, results: import('../engine/learn.js').TodoResult[] | null, lesson: string, note: string }} CheckView
 * lesson: the track's lesson file (workshop/learn/<game>.md), '' for a game without a track.
 */

const BUTTON = 'min-h-tap rounded-ui bg-surface-2 px-3 text-sm font-medium text-neutral-100 active:bg-neutral-700 disabled:opacity-40';

/** @param {{ check: CheckView, onRun: () => void, onOpen: (photo: string) => void }} props */
export function CheckPanel({ check, onRun, onOpen }) {
  const { results } = check;
  const green = results ? results.filter((r) => r.ok).length : 0;
  return html`
    <div class="min-h-0 flex-1 overflow-auto text-sm text-neutral-200">
      <div class="flex items-center gap-2">
        <p class="min-w-0 flex-1 font-mono text-xs text-neutral-400">${check.file}</p>
        <button type="button" class=${BUTTON} disabled=${check.running} onClick=${onRun}>${check.running ? 'Checking…' : results ? 'Check again' : 'Check'}</button>
      </div>
      ${check.note && html`<p class="mt-2 text-neutral-400">${check.note}</p>`}
      ${results && results.length > 0 && html`
        <p class=${`mt-2 rounded-ui px-3 py-2 font-semibold ${green === results.length ? 'bg-ok/30 text-neutral-100' : 'bg-surface-2 text-neutral-100'}`}>
          ${results[0].todo === 0 ? (results[0].ok ? 'All photos read right ✓' : 'Not all photos read right yet') : `${green} of ${results.length} TODOs green`}
        </p>
        <ul class="mt-1">
          ${results.map((r) => html`
            <li key=${r.todo} class="border-b border-line py-2">
              <div class="flex items-center gap-2">
                <${Icon} name=${r.ok ? 'check' : 'circle-alert'} class=${r.ok ? 'size-5 shrink-0 text-ok' : 'size-5 shrink-0 text-error'} />
                <span class="min-w-0 flex-1 font-semibold">${r.todo > 0 ? `TODO ${r.todo}` : 'Photos'}${r.name && r.todo > 0 ? ` · ${r.name}` : ''}
                  <span class="font-normal text-neutral-400"> ${r.summary ?? ''}</span></span>
                ${r.todo > 0 && check.lesson && html`<a class="flex min-h-tap items-center px-2 text-accent-text underline" target="_blank" rel="noopener"
                  href=${`${githubBase(location.href)}${check.lesson}#todo-${r.todo}`}>Lesson</a>`}
              </div>
              ${(r.wrong ?? []).slice(0, 5).map((w, i) => html`
                <div key=${i} class="flex items-center gap-2 pl-7">
                  <span class="min-w-0 flex-1 font-mono text-xs break-words text-neutral-300">${w.text}</span>
                  ${w.photo && html`<button type="button" class=${`${BUTTON} shrink-0 text-xs`} onClick=${() => onOpen(/** @type {string} */ (w.photo))}>Open photo</button>`}
                </div>
              `)}
              ${(r.wrong?.length ?? 0) > 5 && html`<p class="pl-7 text-xs text-neutral-400">and ${(r.wrong?.length ?? 0) - 5} more</p>`}
            </li>
          `)}
        </ul>
      `}
    </div>
  `;
}
