// @ts-check
// The mode chip (issue #139), the one status place (issue #163): one chip under the top bar that says what the
// app is doing right now, with an icon: "Looking for the board…" (spins), "Found · 12 cards · 4 sets",
// "Locked · A24", "Frozen · tap ❄ for live", "Hand over board · paused". The words come from ui/mode-rules.js.
// A short one-off message (`flash`: "Benchmark copied.", "Camera on.") replaces the text for FLASH_MS, then the
// mode comes back; there is no toast. Never cut: the text wraps to at most 2 lines, a tap shows all of it.
// While something loads with a known size (engine/busy.js progress), a thin bar along the chip's bottom edge fills.
// Screen readers hear each change (the text sits in a role="status" span inside the button).
import { html } from 'htm/preact';
import { useEffect, useState } from 'preact/hooks';
import { Icon } from './icons.js';

export const FLASH_MS = 2000;

// With `onTap` (a first-run hint shows, ui/hint-rules.js) a tap calls it instead of showing all the text.
/** @param {{ chip: import('./mode-rules.js').Chip, flash?: string, flashId?: number, progress?: number | null, onTap?: () => void }} props */
export function Chip({ chip, flash = '', flashId = 0, progress = null, onTap }) {
  const [shownId, setShownId] = useState(-1);
  const [full, setFull] = useState(false);
  useEffect(() => {
    if (!flash) return undefined;
    setShownId(flashId);
    const timer = setTimeout(() => setShownId(-1), FLASH_MS);
    return () => clearTimeout(timer);
  }, [flashId]);
  // Errors and paused stay in front of a flash: they tell the user what to do.
  const flashing = Boolean(flash) && shownId === flashId && chip.tone !== 'error' && chip.tone !== 'hold';
  const text = flashing ? flash : chip.text;
  const tone = flashing ? 'idle' : chip.tone;
  const spin = !flashing && (tone === 'busy' || tone === 'search');
  const color = {
    busy: 'bg-surface-2 text-neutral-100',
    search: 'bg-warn text-neutral-950',
    found: 'bg-ok text-neutral-950', // dark text: white on green is only 3.8:1 (issue #154)
    hold: 'bg-accent text-white',
    idle: 'bg-surface-2 text-neutral-100',
    error: 'bg-error text-white',
  }[tone];
  return html`
    <button type="button" data-tone=${tone} aria-expanded=${full} onClick=${() => (onTap ? onTap() : setFull(!full))}
      class="-my-2 flex min-h-11 max-w-full min-w-0 items-center text-left">
      <span class=${`relative flex min-h-7 overflow-hidden max-w-full min-w-0 items-start gap-1.5 rounded-2xl px-2.5 py-1 text-xs font-medium ${color}`}>
        <${Icon} name=${flashing ? 'circle-dot' : chip.icon} class=${spin ? 'mt-px size-3.5 shrink-0 animate-spin motion-reduce:animate-none' : 'mt-px size-3.5 shrink-0'} />
        <span role="status" aria-live="polite" class=${full ? 'break-words' : 'line-clamp-2 break-words'}>${text}</span>
        ${progress !== null && !flashing && html`<span class="absolute bottom-0 left-0 h-0.5 bg-accent-text" style=${{ width: `${Math.round(progress * 100)}%` }}></span>`}
      </span>
    </button>
  `;
}
