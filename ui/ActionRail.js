// @ts-check
// The game's own buttons (owner 30.10.: always on screen, no detour through More): the game's actions
// (engine/actions.js) and the solution key, as one column at the right edge, just above the bottom bar (thumb
// zone). Slim, so it covers little of the picture: icons only, in the bottom bar's look (ui/BottomBar.js: the same
// panel, the same accent pill when on, the same badge). The first visits show each label under its icon for a few
// seconds; after that only the icons stay (remembered in this browser; the label stays the button's name for
// screen readers). An action with `choices` (die numbers, pieces) opens the
// same small list as the bar, to the left of the column; a tap on an item picks it.
import { html } from 'htm/preact';
import { useEffect, useState } from 'preact/hooks';
import { Icon } from './icons.js';

const BUTTON = 'relative flex min-h-12 w-12 flex-col items-center justify-center gap-0.5 rounded-ui text-[10px] leading-tight';
const SEEN_KEY = 'board-vision.rail-labels-seen';
const LABEL_MS = 6000;
const storage = (() => { try { return globalThis.localStorage; } catch { return undefined; } })();

/** @param {{ actions: import('../engine/actions.js').Action[] }} props */
export function ActionRail({ actions }) {
  const [openId, setOpenId] = useState('');
  const [labels, setLabels] = useState(() => { try { return storage?.getItem(SEEN_KEY) !== '1'; } catch { return true; } });
  useEffect(() => {
    if (!labels || actions.length === 0) return undefined;
    const timer = setTimeout(() => {
      setLabels(false);
      try { storage?.setItem(SEEN_KEY, '1'); } catch { /* not remembered */ }
    }, LABEL_MS);
    return () => clearTimeout(timer);
  }, [labels, actions.length > 0]);
  if (actions.length === 0) return null;
  // The game keeps a list open with `open`; else this column does (one at a time).
  const isOpen = (/** @type {import('../engine/actions.js').Action} */ a) => Boolean(a.choices?.length) && (a.open ?? openId === a.id);
  const list = actions.find(isOpen);
  return html`
    <nav aria-label="Game buttons" class="absolute right-2 bottom-3 z-10">
      ${list && html`
        <div role="group" aria-label=${list.label}
          class="absolute right-full bottom-0 mr-2 grid max-h-[50dvh] w-max max-w-[min(18rem,calc(100vw-6rem))] grid-cols-4 gap-1 overflow-y-auto rounded-ui bg-surface/95 p-1.5 shadow-xl ring-1 ring-line">
          ${list.choices?.map((c) => html`
            <button key=${c.label} type="button" aria-pressed=${c.active === true}
              class=${c.active ? 'flex min-h-tap min-w-tap items-center justify-center gap-1 rounded-ui bg-accent px-2 text-sm font-semibold text-white' : 'flex min-h-tap min-w-tap items-center justify-center gap-1 rounded-ui bg-surface-2 px-2 text-sm text-neutral-100 active:bg-neutral-700'}
              onClick=${() => { c.onTap(); if (list.open === undefined) setOpenId(''); }}>
              ${c.color && html`<span class="size-2.5 shrink-0 rounded-full" style=${{ background: c.color }}></span>`}${c.label}
            </button>
          `)}
        </div>
      `}
      <div class="flex flex-col gap-0.5 rounded-ui bg-surface/80 p-0.5 shadow-xl ring-1 ring-line backdrop-blur">
        ${actions.map((a) => {
          const on = a.active === true || isOpen(a);
          return html`
            <button key=${a.id} type="button" data-rail=${a.id} aria-label=${a.label} aria-pressed=${on} aria-expanded=${a.choices?.length ? isOpen(a) : undefined}
              class=${on ? `${BUTTON} text-accent-text` : `${BUTTON} text-neutral-100 active:bg-surface-2`}
              onClick=${() => {
                if (a.choices?.length && a.open === undefined) setOpenId(openId === a.id ? '' : a.id);
                else a.onTap?.();
              }}>
              <span class=${on ? 'relative flex size-10 items-center justify-center rounded-full bg-accent text-white' : 'relative flex size-10 items-center justify-center rounded-full'}>
                <${Icon} name=${a.icon} class="size-5" />
                ${a.badge && html`<span class="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-neutral-100 px-1 text-[10px] leading-4 font-bold text-neutral-950">${a.badge}</span>`}
              </span>
              ${labels && html`<span aria-hidden="true" class="absolute top-1/2 right-full mr-2 -translate-y-1/2 rounded-md bg-surface/95 px-1.5 py-0.5 text-xs whitespace-nowrap text-neutral-100 shadow ring-1 ring-line">${a.label}</span>`}
            </button>
          `;
        })}
      </div>
    </nav>
  `;
}
