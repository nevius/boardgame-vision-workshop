// @ts-check
// The Steps view (issue #103, engine/steps.js): while it is on (tile "Steps" in the ⋯ sheet), a strip of small
// labelled pictures at the top of the picture, one per stage of the vision pipeline: camera, edges, found board,
// straightened, tiles. They follow the live picture. A tap on one shows it large; another tap makes it small again.
// The strip ends with "scores" when the game names tiles by few-shot (engine.classify / engine.matchTile, issue #104):
// tap it, then tap a tile to see its 3 best names with their similarity as bars.
// The last button "knobs" (engine/knobs.js, issue #105) opens sliders at the bottom: move one and the stages follow.
// A stage may carry `lines` (issue #159): short text under its large picture, e.g. the measured values and the rule
// that named a Set card. `open` (from &steps=<stage>) shows that stage large as soon as it is recorded.
import { html } from 'htm/preact';
import { useEffect, useRef, useState } from 'preact/hooks';

/** @typedef {import('../engine/steps.js').Step} Step */
/** @typedef {import('../engine/steps.js').TileScore} TileScore */
/** @typedef {import('../engine/knobs.js').Knob} Knob */

/** @type {HTMLCanvasElement | null} */
let scratch = null; // holds the full-size picture before it is scaled down

/**
 * Paints one stage into a canvas whose longest side is `size` px: the picture, then its outlines and boxes.
 * Also used by shots.js (slide screenshots, issue #121).
 * @param {HTMLCanvasElement} canvas @param {Step} step @param {number} size
 */
export function paint(canvas, step, size) {
  const { image } = step;
  const scale = Math.min(1, size / Math.max(image.width, image.height));
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  scratch ??= document.createElement('canvas');
  scratch.width = image.width;
  scratch.height = image.height;
  const from = scratch.getContext('2d');
  const ctx = canvas.getContext('2d');
  if (!from || !ctx) return;
  // A stage may hold a plain { width, height, data } picture (engine/steps.js Picture), not an ImageData.
  const pixels = image instanceof ImageData ? image : new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
  from.putImageData(pixels, 0, 0);
  ctx.drawImage(scratch, 0, 0, canvas.width, canvas.height);
  ctx.lineWidth = Math.max(1.5, canvas.width / 150);
  (step.quads ?? []).forEach((quad, i) => {
    ctx.strokeStyle = i === 0 ? '#2e2' : '#fc2';
    ctx.beginPath();
    quad.forEach((p) => ctx.lineTo(p.x * scale, p.y * scale));
    ctx.closePath();
    ctx.stroke();
  });
  ctx.strokeStyle = '#38bdf8';
  for (const b of step.boxes ?? []) ctx.strokeRect(b.x * scale, b.y * scale, b.width * scale, b.height * scale);
}

/** One stage as a canvas. @param {{ step: Step, size: number, class: string }} props */
function StepPicture({ step, size, class: cls }) {
  /** @type {import('preact').RefObject<HTMLCanvasElement>} */
  const ref = useRef(null);
  useEffect(() => { if (ref.current) paint(ref.current, step, size); }, [step, size]);
  return html`<canvas ref=${ref} class=${cls}></canvas>`;
}

/** Which embedder ran, in plain words. @param {string | null} backend */
function backendName(backend) {
  if (backend === 'GPU') return 'Image Embedder on the GPU (WebGPU / WebGL)';
  if (backend === 'CPU') return 'Image Embedder on the CPU (WASM)';
  return 'own numbers (matchTile, e.g. engine.pixelEmbedding)';
}

/** The "scores" stage: all named tiles; a tap on one shows its top 3. @param {{ scores: TileScore[], onClose: () => void }} props */
function Scores({ scores, onClose }) {
  const [picked, setPicked] = useState(0);
  const ratio = globalThis.devicePixelRatio || 1;
  const tile = scores[Math.min(picked, scores.length - 1)];
  const index = scores.indexOf(tile);
  return html`
    <div aria-label="Scores" class="absolute inset-x-2 top-[calc(env(safe-area-inset-top)+10rem)] bottom-2 z-10 flex flex-col gap-2 rounded-2xl bg-neutral-950/90 p-2 ring-1 ring-white/15">
      <div class="flex items-center justify-between gap-2">
        <span class="text-sm text-neutral-100">Scores: tap a tile</span>
        <button type="button" onClick=${onClose} class="min-h-11 rounded-lg px-3 text-sm text-sky-300">Close</button>
      </div>
      <div class="flex flex-col gap-1 rounded-lg bg-neutral-900 p-2">
        <span class="text-xs text-neutral-300">Tile ${index + 1}: names it "${tile.label}"</span>
        ${tile.top.map((t) => html`
          <div key=${t.label} class="flex items-center gap-2 text-xs text-neutral-100">
            <span class="w-20 shrink-0 truncate">${t.label}</span>
            <div class="h-3 flex-1 rounded bg-neutral-800">
              <div class=${t.label === tile.label ? 'h-3 rounded bg-sky-500' : 'h-3 rounded bg-neutral-500'}
                style=${{ width: `${Math.max(0, Math.min(1, t.score)) * 100}%` }}></div>
            </div>
            <span class="w-10 shrink-0 text-right tabular-nums">${t.score.toFixed(3)}</span>
          </div>
        `)}
        <span class="text-[10px] text-neutral-400">${backendName(tile.backend)}${tile.ms !== null ? `, ${tile.ms} ms for this tile` : ''}</span>
      </div>
      <div class="flex min-h-0 flex-1 flex-wrap content-start gap-1 overflow-y-auto">
        ${scores.map((s, i) => html`
          <button key=${i} type="button" aria-pressed=${i === index} onClick=${() => setPicked(i)}
            class=${i === index
              ? 'flex min-h-11 min-w-11 flex-col items-center justify-center rounded-lg bg-sky-900/80 p-1 ring-1 ring-sky-400'
              : 'flex min-h-11 min-w-11 flex-col items-center justify-center rounded-lg bg-neutral-800/80 p-1 ring-1 ring-white/10'}>
            ${s.image && html`<${StepPicture} step=${{ name: '', image: s.image }} size=${Math.round(40 * ratio)} class="h-8 w-auto max-w-10 rounded object-contain" />`}
            <span class="text-[10px] leading-tight text-neutral-200">${i + 1}. ${s.label}</span>
          </button>
        `)}
      </div>
    </div>
  `;
}

/** A number as the slider shows it: as many decimals as its step. @param {number} value @param {number} step */
function knobText(value, step) {
  const decimals = step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step)));
  return value.toFixed(decimals);
}

/**
 * The sliders, at the bottom of the picture. Each move goes to onKnob at once (the page reads the picture again).
 * @param {{ knobs: Knob[], onKnob: (name: string, value: number) => void, onReset: () => void, onClose: () => void }} props
 */
function Knobs({ knobs, onKnob, onReset, onClose }) {
  return html`
    <div aria-label="Knobs" class="absolute inset-x-2 bottom-2 z-20 flex max-h-52 flex-col gap-1 overflow-y-auto rounded-2xl bg-neutral-950/90 p-2 ring-1 ring-white/15">
      <div class="flex items-center justify-between gap-2">
        <span class="text-sm text-neutral-100">Knobs: move one, watch the steps</span>
        <div class="flex gap-1">
          <button type="button" onClick=${onReset} class="min-h-11 rounded-lg px-3 text-sm text-sky-300">Reset</button>
          <button type="button" onClick=${onClose} class="min-h-11 rounded-lg px-3 text-sm text-sky-300">Close</button>
        </div>
      </div>
      ${knobs.map((k) => html`
        <label key=${k.name} class="flex min-h-11 items-center gap-2 text-xs text-neutral-100">
          <span class="w-28 shrink-0 leading-tight">${k.label}</span>
          <input type="range" name=${k.name} min=${k.min} max=${k.max} step=${k.step} value=${k.value}
            onInput=${(/** @type {Event} */ e) => onKnob(k.name, Number(/** @type {HTMLInputElement} */ (e.currentTarget).value))}
            class="min-h-11 flex-1 accent-sky-500" />
          <span class="w-12 shrink-0 text-right tabular-nums">${knobText(k.value, k.step)}</span>
        </label>
      `)}
    </div>
  `;
}

/**
 * @param {{ steps: Step[], scores?: TileScore[], knobs?: Knob[], onKnob?: (name: string, value: number) => void,
 *   onResetKnobs?: () => void, open?: string }} props
 */
export function Steps({ steps, scores = [], knobs = [], onKnob = () => {}, onResetKnobs = () => {}, open = '' }) {
  const [big, setBig] = useState(open);
  const [knobsOpen, setKnobsOpen] = useState(false);
  const knobsShown = knobsOpen && knobs.length > 0;
  // Scores and sliders would cover each other: opening one closes the other. A large picture moves up instead.
  const pick = (/** @type {string} */ value) => {
    setBig(value);
    if (value === 'scores') setKnobsOpen(false);
  };
  const toggleKnobs = () => {
    if (!knobsOpen && big === 'scores') setBig('');
    setKnobsOpen(!knobsOpen);
  };
  const large = steps.find((s) => s.name === big);
  const ratio = globalThis.devicePixelRatio || 1;
  return html`
    <div aria-label="Steps" class="absolute inset-x-0 top-[calc(env(safe-area-inset-top)+5rem)] z-10 flex gap-1.5 overflow-x-auto px-2 pb-1">
      ${steps.length === 0 && html`<p class="rounded-full bg-neutral-900/65 px-3 py-1 text-xs text-neutral-300">Steps: waiting for the next picture…</p>`}
      ${steps.map((step, i) => html`
        <button key=${step.name} type="button" aria-pressed=${step.name === big} onClick=${() => pick(step.name === big ? '' : step.name)}
          class=${step.name === big
            ? 'flex min-h-11 shrink-0 flex-col items-center gap-0.5 rounded-lg bg-sky-900/80 p-1 ring-1 ring-sky-400'
            : 'flex min-h-11 shrink-0 flex-col items-center gap-0.5 rounded-lg bg-neutral-900/70 p-1 ring-1 ring-white/10'}>
          <${StepPicture} step=${step} size=${Math.round(64 * ratio)} class="h-12 w-auto max-w-20 rounded object-contain" />
          <span class="text-[10px] leading-tight text-neutral-200">${i + 1}. ${step.name}</span>
        </button>
      `)}
      ${scores.length > 0 && html`
        <button type="button" aria-pressed=${big === 'scores'} onClick=${() => pick(big === 'scores' ? '' : 'scores')}
          class=${big === 'scores'
            ? 'flex min-h-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg bg-sky-900/80 p-1 ring-1 ring-sky-400'
            : 'flex min-h-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg bg-neutral-900/70 p-1 ring-1 ring-white/10'}>
          <span class="flex h-12 items-center px-2 text-sm tabular-nums text-sky-300">${scores.length} tiles</span>
          <span class="text-[10px] leading-tight text-neutral-200">${steps.length + 1}. scores</span>
        </button>
      `}
      ${knobs.length > 0 && html`
        <button type="button" aria-pressed=${knobsShown} onClick=${toggleKnobs}
          class=${knobsShown
            ? 'flex min-h-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg bg-sky-900/80 p-1 ring-1 ring-sky-400'
            : 'flex min-h-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg bg-neutral-900/70 p-1 ring-1 ring-white/10'}>
          <span class="flex h-12 items-center px-2 text-sm text-sky-300">${knobs.length} sliders</span>
          <span class="text-[10px] leading-tight text-neutral-200">knobs</span>
        </button>
      `}
    </div>
    ${knobsShown && html`<${Knobs} knobs=${knobs} onKnob=${onKnob} onReset=${onResetKnobs} onClose=${() => setKnobsOpen(false)} />`}
    ${big === 'scores' && scores.length > 0 && html`<${Scores} scores=${scores} onClose=${() => pick('')} />`}
    ${large && html`
      <button type="button" aria-label=${`${large.name}: tap to make small`} onClick=${() => setBig('')}
        class=${knobsShown
          ? 'absolute inset-x-2 top-[calc(env(safe-area-inset-top)+10rem)] bottom-56 z-10 flex flex-col items-center justify-center gap-1 rounded-2xl bg-neutral-950/85 p-2 ring-1 ring-white/15'
          : 'absolute inset-x-2 top-[calc(env(safe-area-inset-top)+10rem)] bottom-2 z-10 flex flex-col items-center justify-center gap-1 rounded-2xl bg-neutral-950/85 p-2 ring-1 ring-white/15'}>
        <${StepPicture} step=${large} size=${Math.round(720 * ratio)} class="min-h-0 max-w-full flex-1 object-contain" />
        <span class="text-sm text-neutral-100">${large.name}</span>
        ${large.lines?.length ? html`
          <span class="max-h-[40%] w-full overflow-y-auto text-left font-mono text-[11px] leading-snug text-neutral-200">
            ${large.lines.map((line, i) => html`<span key=${i} class="block">${line}</span>`)}
          </span>
        ` : null}
      </button>
    `}
  `;
}
