// @ts-check
// When the camera does not start (issue #153): a short panel at the bottom of the picture, above the bottom bar.
// What happened, 1–4 steps for this phone (engine/camera.js cameraHelp, the same texts as the device check),
// a link to the official help page, then "Try again" and "Use sample photos instead". The mode chip says the
// short line; this panel is the only place with the full steps (no toast, nothing cut off).
import { html } from 'htm/preact';
import { Icon } from './icons.js';

const BUTTON = 'flex min-h-tap flex-1 items-center justify-center gap-2 rounded-ui px-3 text-sm font-semibold';

/**
 * @param {{ help: import('../engine/camera.js').CameraHelp, hasReplay: boolean, onAgain: () => void, onReplay: () => void, onClose: () => void }} props
 */
export function CameraHelp({ help, hasReplay, onAgain, onReplay, onClose }) {
  return html`
    <section aria-label="Camera help" data-camera-help=${help.kind}
      class="absolute inset-x-2 bottom-2 z-10 max-h-[70%] overflow-y-auto rounded-ui bg-surface p-3 text-sm text-neutral-100 shadow-xl ring-1 ring-line">
      <div class="flex items-start gap-2">
        <${Icon} name="circle-alert" class="mt-0.5 size-5 shrink-0 text-error" />
        <h2 class="min-w-0 flex-1 font-semibold">${help.title}</h2>
        <button type="button" aria-label="Close" class="-mt-2 -mr-2 flex min-h-tap min-w-tap items-center justify-center text-neutral-400" onClick=${onClose}>
          <${Icon} name="x" class="size-5" />
        </button>
      </div>
      <ol class="mt-1 list-decimal space-y-1 pl-6 text-neutral-200">
        ${help.steps.map((step) => html`<li key=${step}>${step}</li>`)}
      </ol>
      ${help.link && html`<a class="mt-1 flex min-h-tap items-center text-accent-text underline" href=${help.link.url} target="_blank" rel="noopener">${help.link.label}</a>`}
      <div class="mt-2 flex gap-2">
        <button type="button" data-help="again" class=${`${BUTTON} bg-accent text-white active:bg-accent-strong`} onClick=${onAgain}>
          <${Icon} name="rotate-ccw" class="size-4" />Try again
        </button>
        ${hasReplay && html`<button type="button" data-help="replay" class=${`${BUTTON} bg-surface-2 text-neutral-100 active:bg-neutral-700`} onClick=${onReplay}>
          <${Icon} name="folder-open" class="size-4" />Use sample photos instead
        </button>`}
      </div>
    </section>
  `;
}
