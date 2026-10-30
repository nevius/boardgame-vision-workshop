// Debug page for engine/warp.js (warp.html): shows the shapes OpenCV finds and each one straightened,
// how long OpenCV took to load and how long one search takes. Try photos, the test pictures or the camera.
import { loadOpenCV, openCVLoadTime } from './engine/libs.js';
import { openCamera, closeCamera, grabFrame, loadPhoto } from './engine/camera.js';
import { replayPhotos } from './engine/replay.js';
import { findBoard, findCards, straighten, drawQuads, setManualCorners, getManualCorners } from './engine/warp.js';
import { tapCorners } from './engine/corners.js';
import { mountBusy } from './ui/busy-plain.js';

mountBusy(); // loads and slow steps show at the top (issue #134)

/** Debug page: elements by id, loosely typed. @type {(id: string) => any} */
const $ = (id) => document.getElementById(id);
const canvas = $('view');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const status = $('status');
const video = $('camera');
let frame = null;     // the picture being looked at
let live = false;
let busy = false;     // true while tapping corners: the camera loop waits
let tests = [];
let testIndex = -1;

$('mode').addEventListener('change', () => frame && show(frame));
$('photo-input').addEventListener('change', async () => { stopCamera(); show(await loadPhoto($('photo-input').files[0])); });
$('test-button').addEventListener('click', async () => {
  stopCamera();
  if (tests.length === 0) tests = await replayPhotos('test');
  testIndex = (testIndex + 1) % tests.length;
  show(await loadPhoto(tests[testIndex]), tests[testIndex].split('/').pop());
});
$('camera-button').addEventListener('click', () => (live ? stopCamera() : startCamera()));
$('tap-button').addEventListener('click', async () => {
  if (!frame) return;
  busy = true;
  ctx.putImageData(frame, 0, 0);
  status.textContent = 'Tap the four corners of the board on the picture.';
  const corners = await tapCorners(canvas);
  setManualCorners(corners);
  $('clear-button').hidden = false;
  $('mode').value = 'board';
  busy = false;
  show(frame);
});
$('clear-button').addEventListener('click', () => {
  setManualCorners(null);
  $('clear-button').hidden = true;
  if (frame) show(frame);
});

await loadOpenCV();
status.textContent = `OpenCV.js loaded in ${openCVLoadTime()} ms. Load a photo, the test pictures or start the camera.`;

// Find, draw the outlines, and straighten every shape found.
async function show(picture, label = '') {
  frame = picture;
  canvas.width = frame.width;
  canvas.height = frame.height;
  ctx.putImageData(frame, 0, 0);
  const start = performance.now();
  const cards = $('mode').value === 'cards';
  const quads = cards ? await findCards(frame) : [await findBoard(frame)].filter(Boolean);
  const ms = Math.round(performance.now() - start);
  drawQuads(ctx, quads);
  const how = !cards && getManualCorners() ? 'tapped by hand' : `search ${ms} ms`;
  status.textContent = `${label} ${frame.width}×${frame.height}: found ${quads.length} (${how}). OpenCV load: ${openCVLoadTime()} ms.`;
  const images = await Promise.all(quads.map((q) => straighten(frame, q)));
  $('straight').replaceChildren(...images.map((image) => {
    const out = document.createElement('canvas');
    out.width = image.width;
    out.height = image.height;
    out.getContext('2d').putImageData(/** @type {ImageData} */ (image), 0, 0);
    return out;
  }));
}

async function startCamera() {
  try {
    await openCamera(video);
  } catch (err) {
    status.textContent = err.message;
    return;
  }
  live = true;
  $('camera-button').textContent = 'Stop camera';
  while (live) {
    if (!busy && video.readyState >= 2) await show(grabFrame(video));
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

function stopCamera() {
  if (!live) return;
  live = false;
  closeCamera(video);
  $('camera-button').textContent = 'Start camera';
}
