// @ts-check
// The game's picture-in-picture box (engine/actions.js setPip), top left, under the status chip (owner 30.10.): small, a tap makes it big, another
// tap small again. The game paints into its square canvas; a turning one is painted on every screen refresh
// (not with reduced motion). In the big box a finger drag sideways calls pip.drag (e.g. to turn a 3D view).
import { html } from 'htm/preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from './icons.js';

/** @param {{ pip: import('../engine/actions.js').Pip }} props */
export function Pip({ pip }) {
  const [big, setBig] = useState(false);
  /** @type {import('preact').RefObject<HTMLCanvasElement>} */
  const ref = useRef(null);
  /** @type {import('preact').RefObject<{ x: number, moved: boolean } | null>} */
  const drag = useRef(null);
  /** @type {import('preact').RefObject<() => void>} */
  const paintNow = useRef(() => {});
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const size = canvas.clientWidth * (globalThis.devicePixelRatio || 1);
    canvas.width = canvas.height = Math.round(size);
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    const still = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;
    let frame = 0;
    const paint = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pip.draw(ctx, canvas.width);
      if (pip.turning && !still) frame = requestAnimationFrame(paint);
    };
    paintNow.current = () => { cancelAnimationFrame(frame); paint(); };
    paint();
    return () => cancelAnimationFrame(frame);
  }, [pip, big]);
  const handlers = {
    onPointerDown: (/** @type {PointerEvent} */ e) => { drag.current = { x: e.clientX, moved: false }; },
    onPointerMove: (/** @type {PointerEvent} */ e) => {
      const d = drag.current;
      if (!d || !big || !pip.drag || !ref.current) return;
      const dx = (e.clientX - d.x) / ref.current.clientWidth;
      if (Math.abs(dx) < 0.02 && !d.moved) return;
      d.moved = true;
      d.x = e.clientX;
      pip.drag(dx);
      paintNow.current?.();
    },
    onPointerUp: () => {
      if (drag.current && !drag.current.moved) setBig(!big);
      drag.current = null;
    },
    onPointerCancel: () => { drag.current = null; },
  };
  return html`
    <div role="button" tabIndex="0" aria-label=${big ? `${pip.label}: tap to make small` : `${pip.label}: tap to make big`}
      onKeyDown=${(/** @type {KeyboardEvent} */ e) => { if (e.key === 'Enter' || e.key === ' ') setBig(!big); }}
      class=${big
        ? 'absolute top-[calc(env(safe-area-inset-top)+4.5rem)] left-2 z-10 aspect-square w-[min(70vw,24rem)] touch-none overflow-hidden rounded-2xl bg-neutral-900/85 shadow-xl ring-1 ring-white/15 backdrop-blur-sm'
        : 'absolute top-[calc(env(safe-area-inset-top)+4.5rem)] left-2 z-10 aspect-square w-24 touch-none overflow-hidden rounded-2xl bg-neutral-900/55 shadow-lg ring-1 ring-white/15 backdrop-blur-sm'}
      ...${handlers}>
      <canvas ref=${ref} class="block size-full"></canvas>
      <span class="pointer-events-none absolute top-1 right-1 rounded-full bg-neutral-900/60 p-0.5 text-neutral-200">
        <${Icon} name=${big ? 'shrink' : 'expand'} class="size-3.5" />
      </span>
    </div>
  `;
}
