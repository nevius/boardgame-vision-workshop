// @ts-check
// The picture: fills the whole screen above the bottom bar, edge to edge, under the see-through top bar (issue #163).
// The camera picture fills it (cut on two sides, no black bars), unless "Fit" is set in the More sheet. Photos fit
// whole and start zoomed to the found board (ui/view-rules.js); two fingers zoom them.
// Live camera: the <video> shows the picture itself; the canvas on top is see-through and holds only what the
// game draws. The canvas has the size of the picture detect() got and the same shape and fit as the video,
// so the drawing lands on the right spot. Photos: the canvas shows the photo and the drawing; the video is empty.
// engine/geometry.js canvasPoint maps taps to the right canvas pixel either way.
// No picture yet (also right after a game switch): the game picker (issue #152), a card per game with a small
// picture and what you need (ui/picker-rules.js), the current game marked. Camera and Sample photos are in the
// bottom bar (owner 30.10.). The picker sits a bit above the middle: a third of the free space above it, two
// thirds below (owner 30.10.); the top padding keeps it clear of the status chip and the notch.
import { html } from 'htm/preact';
import { gameCards } from './picker-rules.js';

/**
 * @param {{
 *   canvasRef: import('preact').RefObject<HTMLCanvasElement>,
 *   videoRef: import('preact').RefObject<HTMLVideoElement>,
 *   dragging: boolean,
 *   fill: boolean,
 *   empty: boolean,
 *   games: string[],
 *   game: string,
 *   onPick: (name: string) => void,
 *   paused: string,
 *   onContinue: () => void,
 * }} props
 */
export function CameraView({ canvasRef, videoRef, dragging, fill, empty, games, game, onPick, paused, onContinue }) {
  return html`
    <div class=${dragging ? 'absolute inset-0 bg-neutral-950 outline-3 -outline-offset-8 outline-sky-400 outline-dashed' : 'absolute inset-0 bg-neutral-950'}>
      <video ref=${videoRef} muted playsinline class=${fill ? 'pointer-events-none absolute inset-0 h-full w-full object-cover' : 'pointer-events-none absolute inset-0 h-full w-full object-contain'}></video>
      <canvas ref=${canvasRef} width="640" height="480" class=${empty ? 'invisible absolute inset-0 block h-full w-full' : fill ? 'absolute inset-0 block h-full w-full touch-none object-cover' : 'absolute inset-0 block h-full w-full touch-none object-contain'}></canvas>
      ${empty && !paused && html`
        <div class="absolute inset-0 flex flex-col overflow-y-auto px-3 pt-[calc(env(safe-area-inset-top)+5rem)] pb-3">
          <div class="grow" aria-hidden="true"></div>
          <h2 class="pb-2 text-sm font-semibold text-neutral-300">Pick a game</h2>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-3" data-picker>
            ${gameCards(games).map((c) => html`
              <button type="button" key=${c.name} data-game=${c.name} aria-pressed=${c.name === game} onClick=${() => onPick(c.name)}
                class=${c.name === game ? 'flex min-h-tap flex-col overflow-hidden rounded-ui bg-surface text-left ring-2 ring-accent-text' : 'flex min-h-tap flex-col overflow-hidden rounded-ui bg-surface text-left ring-1 ring-line active:bg-surface-2'}>
                <img src=${c.picture} alt="" width="240" height="160" loading="lazy" class="aspect-[2/1] w-full object-cover" />
                <span class="px-2 pt-1.5 text-sm font-semibold text-neutral-100">${c.title}</span>
                <span class="px-2 pb-2 text-xs text-neutral-400">${c.needs}</span>
              </button>
            `)}
          </div>
          <div class="grow-[2]" aria-hidden="true"></div>
        </div>
      `}
      ${paused && html`
        <button type="button" class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-neutral-100" onClick=${onContinue}>
          <span class="rounded-ui bg-accent px-5 py-3 text-base font-semibold text-white">Tap to continue</span>
          <span class="px-6 text-center text-sm text-neutral-300">${paused}</span>
        </button>
      `}
    </div>
  `;
}
