// @ts-check
// The one action bar (issue #163), at the bottom edge in thumb reach: 3–5 equal buttons in one centred row, each
// an icon with a short label below it (at least 48 px high), e.g. Camera · Search again · Freeze · Next photo · More.
// Which actions get a slot: ui/bar-rules.js. An action with `choices` (die numbers, pieces) opens a small list
// just above the bar; a tap on an item picks it. Works the same for right- and left-handed use (centred).
import { html } from 'htm/preact';
import { useState } from 'preact/hooks';
import { Icon } from './icons.js';

const BUTTON = 'relative flex min-h-14 min-w-0 max-w-24 flex-1 basis-0 flex-col items-center justify-center gap-0.5 rounded-ui px-0.5 text-[11px] leading-tight';

// `ring`: the id of the button a first-run hint is about (ui/hint-rules.js); it gets an accent ring.
/** @param {{ actions: import('../engine/actions.js').Action[], ring?: string }} props */
export function BottomBar({ actions, ring = '' }) {
  const [openId, setOpenId] = useState('');
  // The game keeps a list open with `open`; else this bar does (one at a time).
  const isOpen = (/** @type {import('../engine/actions.js').Action} */ a) => Boolean(a.choices?.length) && (a.open ?? openId === a.id);
  const list = actions.find(isOpen);
  return html`
    <nav aria-label="Actions" class="relative z-20 shrink-0 bg-surface/90 px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur">
      ${list && html`
        <div role="group" aria-label=${list.label}
          class="absolute bottom-full left-1/2 mb-2 grid max-h-[50dvh] w-max max-w-[calc(100vw-1rem)] -translate-x-1/2 grid-cols-4 gap-1 overflow-y-auto rounded-ui bg-surface/95 p-1.5 shadow-xl ring-1 ring-line">
          ${list.choices?.map((c) => html`
            <button key=${c.label} type="button" aria-pressed=${c.active === true}
              class=${c.active ? 'flex min-h-tap min-w-tap items-center justify-center gap-1 rounded-ui bg-accent px-2 text-sm font-semibold text-white' : 'flex min-h-tap min-w-tap items-center justify-center gap-1 rounded-ui bg-surface-2 px-2 text-sm text-neutral-100 active:bg-neutral-700'}
              onClick=${() => { c.onTap(); if (list.open === undefined) setOpenId(''); }}>
              ${c.color && html`<span class="size-2.5 shrink-0 rounded-full" style=${{ background: c.color }}></span>`}${c.label}
            </button>
          `)}
        </div>
      `}
      <div class="mx-auto flex max-w-md items-stretch justify-center gap-1">
        ${actions.map((a) => {
          const on = a.active === true || isOpen(a);
          return html`
            <button key=${a.id} type="button" data-bar=${a.id} aria-pressed=${on} aria-expanded=${a.choices?.length ? isOpen(a) : undefined}
              class=${`${on ? `${BUTTON} text-accent-text` : `${BUTTON} text-neutral-100 active:bg-surface-2`}${ring === a.id ? ' ring-2 ring-accent-text' : ''}`}
              onClick=${() => {
                if (a.choices?.length && a.open === undefined) setOpenId(openId === a.id ? '' : a.id);
                else a.onTap?.();
              }}>
              <span class=${on ? 'relative flex h-7 w-12 items-center justify-center rounded-full bg-accent text-white' : 'relative flex h-7 w-12 items-center justify-center rounded-full'}>
                <${Icon} name=${a.icon} class="size-5" />
                ${a.badge && html`<span class="absolute -top-1 right-1 min-w-4 rounded-full bg-neutral-100 px-1 text-[10px] leading-4 font-bold text-neutral-950">${a.badge}</span>`}
              </span>
              <span class="line-clamp-2 max-w-full text-center break-words">${a.label}</span>
            </button>
          `;
        })}
      </div>
    </nav>
  `;
}
