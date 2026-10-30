// @ts-check
// ubongo-pieces.html: the 16 real Ubongo pieces (PIECES in games/ubongo.js) as turnable 3D models (engine/iso.js),
// each next to its piece on the owner's photo, with ✓ / ✗. The answers become one line to copy into a comment.
import { PIECES } from './games/ubongo.js';
import { isoPolygons, fitView, drawPolygons } from './engine/iso.js';

const PAINT = { red: '#ef4444', yellow: '#facc15', green: '#14b8a6', blue: '#3b82f6' };
const PHOTO = 'replay/ubongo/pieces/all-16-top.jpg';
/** @type {Record<string, '✓' | '✗' | '?'>} */
const answers = Object.fromEntries(Object.keys(PIECES).map((name) => [name, '?']));
const list = /** @type {HTMLElement} */ (document.getElementById('pieces'));
const result = /** @type {HTMLTextAreaElement} */ (document.getElementById('result'));

const photo = new Image();
photo.src = PHOTO;
photo.onload = () => document.querySelectorAll('canvas[data-photo]').forEach((c) => drawPhoto(/** @type {HTMLCanvasElement} */ (c)));

for (const [name, piece] of Object.entries(PIECES)) {
  const box = document.createElement('div');
  box.className = 'tile';
  const model = document.createElement('canvas');
  model.width = 160;
  model.height = 160;
  const crop = document.createElement('canvas');
  crop.width = 160;
  crop.height = 160;
  crop.dataset.photo = piece.photo.join(',');
  for (const c of [model, crop]) Object.assign(c.style, { width: '140px', height: '140px' });
  const title = document.createElement('p');
  title.textContent = `${piece.name} (${name}): ${piece.about}${piece.confirmed ? '' : ' (not confirmed yet)'}`;
  const yes = button('✓', () => answer(name, '✓', box));
  const no = button('✗', () => answer(name, '✗', box));
  box.append(title, model, crop, yes, no);
  list.append(box);
  let angle = 0.5;
  const turn = () => drawModel(model, piece, angle);
  turn();
  // Drag across the model to turn it (one width = one full turn).
  let start = /** @type {{ x: number, angle: number } | null} */ (null);
  model.style.touchAction = 'none';
  model.addEventListener('pointerdown', (e) => { start = { x: e.clientX, angle }; model.setPointerCapture(e.pointerId); });
  model.addEventListener('pointermove', (e) => {
    if (!start) return;
    angle = start.angle + ((e.clientX - start.x) / model.clientWidth) * 2 * Math.PI;
    turn();
  });
  model.addEventListener('pointerup', () => { start = null; });
}
showResult();

/** @param {string} label @param {() => void} onClick */
function button(label, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

/** @param {string} name @param {'✓' | '✗'} value @param {HTMLElement} box */
function answer(name, value, box) {
  answers[name] = value;
  box.style.outline = value === '✓' ? '3px solid #22c55e' : '3px solid #ef4444';
  showResult();
}

function showResult() {
  result.value = `Ubongo pieces: ${Object.entries(answers).map(([name, a]) => `${name} ${a}`).join(', ')}`;
}

/** @param {HTMLCanvasElement} canvas @param {import('./games/ubongo.js').Piece} piece @param {number} angle */
function drawModel(canvas, piece, angle) {
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const cubes = piece.cubes.map((at) => ({ at, color: PAINT[piece.color] ?? '#ffffff', piece: 0 }));
  const fit = fitView(cubes, undefined, { x: 8, y: 8, width: canvas.width - 16, height: canvas.height - 16 });
  drawPolygons(ctx, isoPolygons(cubes, { angle }), fit);
}

// The piece's part of the photo, scaled to fit the canvas.
/** @param {HTMLCanvasElement} canvas */
function drawPhoto(canvas) {
  const [x, y, w, h] = (canvas.dataset.photo ?? '').split(',').map(Number);
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  const scale = Math.min(canvas.width / w, canvas.height / h);
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(photo, x, y, w, h, (canvas.width - w * scale) / 2, (canvas.height - h * scale) / 2, w * scale, h * scale);
}

document.getElementById('copy-button')?.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(result.value);
  } catch {
    result.select(); // no clipboard access: select the text so it can be copied by hand
  }
});
