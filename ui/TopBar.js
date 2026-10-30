// @ts-check
// The top bar (issue #163): never needed during play (the thumb stays at the bottom). No strip of its own: the
// picture uses the whole screen, up under the phone's clock (owner 30.10.). Installed on an iPhone, iOS softens
// (blurs) whatever sits right below the clock, so the status place keeps a safe margin from the top: the mode chip
// (ui/Chip.js) with "Photo n/m" and the "solution" badge, and after a deploy a small "New version · reload" button.
// The game name and "All pages" are at the top of More (ui/Sheet.js, owner 30.10.).
import { html } from 'htm/preact';
import { Icon } from './icons.js';
import { Chip } from './Chip.js';

/**
 * @param {{
 *   photo: string, solution: boolean,
 *   chip: import('./mode-rules.js').Chip, flash: string, flashId: number, progress: number | null, update: boolean, onUpdate: () => void,
 *   onChip?: () => void,
 * }} props
 */
export function TopBar(props) {
  return html`
    <header class="pointer-events-none absolute inset-x-0 top-0 z-20 flex min-w-0 flex-wrap items-start gap-2 pt-[calc(env(safe-area-inset-top)+1.75rem)] pr-[max(0.5rem,env(safe-area-inset-right))] pl-[max(0.5rem,env(safe-area-inset-left))]">
        <div class="pointer-events-auto min-w-0">
          <${Chip} chip=${props.chip} flash=${props.flash} flashId=${props.flashId} progress=${props.progress} onTap=${props.onChip} />
        </div>
        ${props.solution && html`<span class="mt-1 shrink-0 rounded-md bg-warn px-1.5 text-xs font-semibold text-neutral-950">solution</span>`}
        ${props.photo && html`<span class="mt-1.5 shrink-0 rounded-md bg-surface/80 px-1.5 text-xs text-neutral-200">${props.photo}</span>`}
        ${props.update && html`
          <button type="button" onClick=${props.onUpdate}
            class="pointer-events-auto relative flex h-7 shrink-0 items-center gap-1 rounded-full bg-accent px-2.5 text-xs font-medium text-white after:absolute after:-inset-2 after:content-[''] active:bg-accent-strong">
            <${Icon} name="rotate-ccw" class="size-3.5" />New version · reload
          </button>`}
    </header>
  `;
}
