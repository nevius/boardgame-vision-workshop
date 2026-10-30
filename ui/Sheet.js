// @ts-check
// The controls: a sheet that slides up from the bottom when More in the bottom bar is tapped. It snaps to heights
// (ui/sheet-rules.js): peek (one row of the most used tools, the rest one sideways swipe away, owner 30.10.), half (everything, at most 40 % of the screen, scrolls
// inside) and full (scrolls). Drag the handle (or the sheet) up or down; tap the handle for peek ↔ half. It opens at
// the height the user left it at. Closes with More again, the ✕, a tap outside it, or a drag down.
// Tabs: Controls (the game name with "All pages ›" (links.html, owner 30.10.), the game picker, then the actions that did not fit the bottom bar and the rare ones as a grid
// of small icon tiles, the ones this game uses most first (counted in this browser), then a Settings row), State, Benchmark, Log.
// The grid fits as many tiles as the width allows (4 on a 320 px phone, 5 at 390 px, more on a tablet).
// On narrow phones the tabs show only their icons. Every tap target is at least 44 px.
// At the end of the Settings row, a small dimmed key without a label: solution mode on/off (for the workshop
// owner; only for games with a file in solutions/).
// A game action with a list (`choices`, e.g. Ubongo's Roll) that did not fit the bar opens its list here, under the
// tiles. When the game holds the list open itself (`open`), a tap closes the sheet and the list shows above the bar.
import { html } from 'htm/preact';
import { useRef, useState } from 'preact/hooks';
import { afterSwipe, byUse, SWIPE_PX } from './sheet-rules.js';
import { Icon } from './icons.js';
import { gameTitle } from './picker-rules.js';

// Speed setting (engine/speed.js): Auto lightens itself on a slow phone, Saver is light, Full is the old way.
const SPEEDS = /** @type {[import('../engine/speed.js').SpeedChoice, string][]} */ ([['auto', 'Auto'], ['saver', 'Saver'], ['full', 'Full']]);
// A tile: about 56–64 px, a bit bigger on tablets and computers.
const TILE = 'flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl bg-neutral-800/70 px-1 py-1.5 text-neutral-100 active:bg-neutral-700 disabled:opacity-40 sm:min-h-16';
const TABS = /** @type {['' | 'state' | 'bench' | 'log', string, string][]} */ ([['', 'Controls', 'ellipsis'], ['state', 'State', 'braces'], ['bench', 'Benchmark', 'timer'], ['log', 'Log', 'scroll-text']]);

/**
 * One tile of the grid: icon with a short label below. With `onFiles` it opens the photo picker.
 * @param {{ icon: string, label: string, onClick?: () => void, onFiles?: (files: File[]) => void, disabled?: boolean, active?: boolean }} props
 */
export function SheetTile({ icon, label, onClick, onFiles, disabled = false, active = false }) {
  const inner = html`<${Icon} name=${icon} class=${active ? 'size-5 shrink-0 text-sky-400' : 'size-5 shrink-0 text-neutral-300'} /><span class="line-clamp-2 text-center text-[11px] leading-tight">${label}</span>`;
  if (onFiles) {
    return html`
      <label class="${TILE} cursor-pointer">
        ${inner}
        <input type="file" accept="image/*" multiple hidden onChange=${(/** @type {Event} */ e) => {
          const input = /** @type {HTMLInputElement} */ (e.currentTarget);
          onFiles([...(input.files ?? [])]);
          input.value = '';
        }} />
      </label>
    `;
  }
  return html`<button type="button" class=${TILE} disabled=${disabled} aria-pressed=${active} onClick=${onClick}>${inner}</button>`;
}

/** A small switch of a few options in the Settings row. @param {{ label: string, options: [string, string][], value: string, onPick: (v: string) => void }} props */
function Segments({ label, options, value, onPick }) {
  return html`
    <div role="radiogroup" aria-label=${label} class="flex rounded-lg bg-neutral-800 p-0.5">
      ${options.map(([v, text]) => html`<button key=${v} type="button" role="radio" aria-checked=${value === v}
        class=${value === v ? 'min-h-11 min-w-11 rounded-md bg-neutral-600 px-2.5 text-xs sm:px-3.5 font-semibold text-white' : 'min-h-11 min-w-11 rounded-md px-2.5 text-xs text-neutral-400 sm:px-3.5'}
        onClick=${() => onPick(v)}>${text}</button>`)}
    </div>
  `;
}

/**
 * @param {{
 *   size: import('./sheet-rules.js').SheetSize, tab: string,
 *   rows: import('../engine/actions.js').Action[],
 *   games: string[], game: string, title: string, onPick: (name: string) => void,
 *   fill: boolean, speed: import('../engine/speed.js').SpeedChoice, solution: boolean, hasSolution: boolean,
 *   use: Record<string, number>, onUse: (id: string) => void,
 *   onSize: (size: import('./sheet-rules.js').SheetSize) => void, onTab: (name: '' | 'state' | 'bench' | 'log') => void,
 *   onPhotos: (files: File[]) => void, onFill: () => void,
 *   onSpeed: (choice: import('../engine/speed.js').SpeedChoice) => void, onSolution: () => void,
 *   children?: import('preact').ComponentChildren,
 * }} props
 */
export function Sheet(props) {
  // A drag up or down on the sheet moves it one height (a long drag more). Taps on its buttons stay taps.
  // The handle always drags; on the scrolling part a phone may scroll instead, so "drag the handle" is the reliable way.
  /** @type {import('preact').RefObject<number | null>} */
  const startY = useRef(null);
  // True right after a drag, so the click that follows it on the handle is not also a tap.
  const dragged = useRef(false);
  const swipe = {
    onPointerDown: (/** @type {PointerEvent} */ e) => { startY.current = e.clientY; },
    onPointerUp: (/** @type {PointerEvent} */ e) => {
      dragged.current = startY.current != null && Math.abs(e.clientY - startY.current) >= SWIPE_PX;
      if (dragged.current && startY.current != null) props.onSize(afterSwipe(props.size, e.clientY - startY.current));
      startY.current = null;
    },
    onPointerCancel: () => { startY.current = null; },
  };
  // The list of a row with `choices` that is open inside the sheet ('' = none).
  const [listId, setListId] = useState('');
  const peek = props.size === 'peek';
  const list = props.rows.find((a) => a.id === listId && a.choices?.length);
  /** @param {import('../engine/actions.js').Action} a */
  const tapRow = (a) => {
    if (!a.choices?.length) a.onTap?.();
    else if (a.open === undefined) {
      setListId(listId === a.id ? '' : a.id);
      // The list only shows above peek, so opening one from the peek row raises the sheet to half.
      if (peek && listId !== a.id) props.onSize('half');
    }
    else { a.onTap?.(); props.onSize('closed'); }
  };
  return html`
    <section
      id="controls" aria-label="Controls"
      class=${`absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-2xl bg-neutral-900/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-2xl ring-1 ring-white/10 backdrop-blur transition-transform duration-200 starting:translate-y-full motion-reduce:transition-none ${props.size === 'full' ? 'max-h-[90dvh]' : 'max-h-[40dvh]'}`}
      ...${swipe}
    >
      <button type="button" aria-label=${peek ? 'Show all tools' : 'Show fewer tools'} class="flex min-h-11 w-full shrink-0 touch-none items-center justify-center"
        onClick=${() => { if (!dragged.current) props.onSize(afterSwipe(props.size, 0)); dragged.current = false; }}><span class="h-1 w-10 rounded-full bg-neutral-600"></span></button>
      ${!peek && html`<div class="flex shrink-0 items-center gap-0.5 border-b border-white/10 pb-1">
        <div role="tablist" class="flex flex-1 items-center gap-0.5">
        ${TABS.map(([name, label, icon]) => html`
          <button key=${name} type="button" role="tab" aria-label=${label} aria-selected=${props.tab === name} onClick=${() => props.onTab(name)}
            class=${props.tab === name ? 'flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg bg-neutral-800 text-xs font-semibold text-sky-400' : 'flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg text-xs text-neutral-400'}>
            <${Icon} name=${icon} class="size-4" /><span class="hidden min-[400px]:inline">${label}</span>
          </button>
        `)}
        </div>
        <button type="button" aria-label="Close controls" class="flex size-11 shrink-0 items-center justify-center rounded-full text-neutral-400 active:bg-neutral-800" onClick=${() => props.onSize('closed')}>
          <${Icon} name="x" class="size-5" />
        </button>
      </div>`}
      ${peek || props.tab === '' ? html`
        <div class="min-h-0 overflow-y-auto pt-1.5">
          ${!peek && html`<a href="links.html" class="flex min-h-tap items-center gap-2 rounded-ui px-1 text-sm active:bg-neutral-800">
            <span class="min-w-0 truncate font-semibold text-neutral-100">${props.title}</span>
            <span class="ml-auto shrink-0 text-neutral-400">All pages ›</span>
          </a>`}
          ${!peek && html`<label class="flex min-h-tap items-center gap-2 pb-1.5 text-sm text-neutral-300">
            <span class="shrink-0">Game</span>
            <select aria-label="Game" value=${props.game}
              class="min-h-11 min-w-0 flex-1 rounded-ui border border-line bg-surface-2 px-2 text-base text-neutral-100"
              onChange=${(/** @type {Event} */ e) => props.onPick(/** @type {HTMLSelectElement} */ (e.currentTarget).value)}>
              ${props.games.map((name) => html`<option key=${name} value=${name}>${gameTitle(name)}</option>`)}
            </select>
          </label>`}
          <div class=${peek ? 'flex gap-1.5 overflow-x-auto overscroll-x-contain pb-1 *:w-[72px] *:shrink-0 sm:*:w-[84px]' : 'grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-1.5 sm:grid-cols-[repeat(auto-fill,minmax(76px,1fr))]'}>
            ${byUse([{ id: 'photos' }, ...props.rows], props.use).map((a) => 'icon' in a
              ? html`<${SheetTile} key=${a.id} icon=${a.icon} label=${a.label} active=${a.active || a.id === list?.id}
                onClick=${() => { props.onUse(a.id); tapRow(a); }} />`
              : html`<${SheetTile} key="photos" icon="images" label="Your photos" onFiles=${(/** @type {File[]} */ f) => { props.onUse('photos'); props.onPhotos(f); }} />`)}
          </div>
          ${!peek && list && html`
            <div role="group" aria-label=${list.label} class="grid grid-cols-4 gap-1 pt-1.5">
              ${list.choices?.map((c) => html`
                <button key=${c.label} type="button" aria-pressed=${c.active === true}
                  class=${c.active ? 'flex min-h-tap min-w-tap items-center justify-center gap-1 rounded-ui bg-accent px-2 text-sm font-semibold text-white' : 'flex min-h-tap min-w-tap items-center justify-center gap-1 rounded-ui bg-surface-2 px-2 text-sm text-neutral-100 active:bg-neutral-700'}
                  onClick=${() => { c.onTap(); setListId(''); }}>
                  ${c.color && html`<span class="size-2.5 shrink-0 rounded-full" style=${{ background: c.color }}></span>`}${c.label}
                </button>
              `)}
            </div>
          `}
          ${!peek && html`<div role="group" aria-label="Settings" class="flex flex-wrap items-center gap-1.5 pt-1.5">
            <${Segments} label="Speed" options=${SPEEDS} value=${props.speed} onPick=${props.onSpeed} />
            <${Segments} label="Camera picture" options=${[['fill', 'Fill screen'], ['fit', 'Fit']]} value=${props.fill ? 'fill' : 'fit'}
              onPick=${(/** @type {string} */ v) => { if ((v === 'fill') !== props.fill) props.onFill(); }} />
            ${props.hasSolution && html`
              <button type="button" aria-label="Solution mode" aria-pressed=${props.solution}
                class=${props.solution ? 'ml-auto flex size-11 items-center justify-center rounded-full text-amber-400/70 active:bg-neutral-800' : 'ml-auto flex size-11 items-center justify-center rounded-full text-neutral-500 active:bg-neutral-800'}
                onClick=${props.onSolution}>
                <${Icon} name="key-round" class="size-4" />
              </button>
            `}
          </div>`}
        </div>
      ` : html`
        <div class=${props.size === 'full' ? 'flex h-[calc(90dvh-7rem)] min-h-0 flex-col pt-1' : 'flex h-[calc(40dvh-7rem)] min-h-0 flex-col pt-1'}>${props.children}</div>
      `}
    </section>
  `;
}
