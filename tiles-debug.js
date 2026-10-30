// Page for engine/tiles.js and engine/fewshot.js (tiles.html): cut a picture into tiles, tap a tile to name it
// (it becomes a reference, saved in this browser), see every tile's best label, export the references as JSON
// for games/<game>.refs.json. Shows which backend the Image Embedder uses and the ms per tile.
import { openCamera, closeCamera, grabFrame, loadPhoto } from './engine/camera.js';
import { findBoard, findCards, straighten } from './engine/warp.js';
import { cutTiles, cropImage } from './engine/tiles.js';
import {
  embed, matchTile, embedderInfo, loadReferences, saveReferences, referencesToJSON, referencesFromJSON,
} from './engine/fewshot.js';
import { fakeBoard, splitReferences } from './tests/fake-tiles.js';
import { mountBusy } from './ui/busy-plain.js';

mountBusy(); // loads and slow steps show at the top (issue #134)

/** Debug page: elements by id, loosely typed. @type {(id: string) => any} */
const $ = (id) => document.getElementById(id);
const canvas = $('view');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const status = $('status');
const video = $('camera');
let frame = null;     // the picture being looked at
let tiles = [];       // [{ image, embedding }] in reading order
let refs = [];        // the references of the current set
let live = false;
let lastName = '';
const setName = () => $('set-name').value.trim() || 'default';

$('set-name').value = location.hash.slice(1) || 'default';
$('set-name').addEventListener('change', openSet);
for (const id of ['mode', 'rows', 'cols', 'margin']) $(id).addEventListener('change', () => frame && show(frame));
$('photo-input').addEventListener('change', async () => { stopCamera(); show(await loadPhoto($('photo-input').files[0])); });
$('camera-button').addEventListener('click', () => (live ? takePicture() : startCamera()));
$('selftest-button').addEventListener('click', selfTest);
$('undo-button').addEventListener('click', () => { refs.pop(); refsChanged(); });
$('clear-button').addEventListener('click', () => {
  if (refs.length && confirm(`Remove all ${refs.length} references of "${setName()}"?`)) { refs = []; refsChanged(); }
});
$('export-button').addEventListener('click', () => {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([referencesToJSON(refs)], { type: 'application/json' }));
  link.download = `${setName()}.refs.json`;
  link.click();
  URL.revokeObjectURL(link.href);
});
$('import-input').addEventListener('change', async () => {
  try {
    refs = referencesFromJSON(await $('import-input').files[0].text());
    await refsChanged();
    status.textContent = `Imported ${refs.length} references.`;
  } catch (err) {
    status.textContent = `Could not import: ${err.message}`;
  }
  $('import-input').value = '';
});

await openSet();

// Load the saved references of the named set (they survive a reload).
async function openSet() {
  refs = await loadReferences(setName());
  showRefs();
  showTiles();
}

// References changed: save them, show them, label the tiles again.
async function refsChanged() {
  const saved = await saveReferences(setName(), refs);
  if (!saved) status.textContent = 'Could not save in this browser (private mode?). Use Export JSON.';
  showRefs();
  showTiles();
}

// Picture → board or cards → tiles → embeddings.
async function show(picture) {
  frame = picture;
  canvas.width = frame.width;
  canvas.height = frame.height;
  ctx.putImageData(frame, 0, 0);
  const mode = $('mode').value;
  const grid = { rows: +$('rows').value || 1, cols: +$('cols').value || 1, margin: +$('margin').value || 0 };
  let images;
  if (mode === 'cards') {
    status.textContent = 'Looking for cards…';
    const cards = await findCards(frame);
    images = await Promise.all(cards.map((c) => straighten(frame, c)));
  } else {
    let board = frame;
    if (mode === 'board') {
      status.textContent = 'Looking for the board…';
      // A print sheet from print.html (black frame): cut the frame away, so only the cells remain.
      const framed = await findBoard(frame, { minArea: 0.05, darkFrame: true });
      const corners = framed ?? await findBoard(frame);
      if (corners) board = await straighten(frame, corners, framed ? 540 : undefined, framed ? 540 : undefined);
      if (framed) board = cropImage(board, { x: 14, y: 14, width: 512, height: 512 });
    }
    images = cutTiles(board, grid).flat();
  }
  status.textContent = `${images.length} tiles. Reading them…`;
  tiles = [];
  for (const image of images) tiles.push({ image, embedding: await embed(image) });
  status.textContent = `${tiles.length} tiles. Tap a tile to name it.`;
  showTiles();
}

// Every tile with its best label. Tap → name it → it becomes a reference.
function showTiles() {
  $('tiles').replaceChildren(...tiles.map((tile) => {
    const match = matchTile(tile.embedding, refs);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tile';
    button.append(toCanvas(tile.image), match ? `${match.label} ${match.score.toFixed(2)}` : '?');
    button.addEventListener('click', () => {
      const label = prompt('Name of this tile (for example "queen" or "empty"):', match?.label ?? lastName);
      if (!label?.trim()) return;
      lastName = label.trim();
      refs.push({ label: lastName, embedding: tile.embedding, thumb: thumbnail(tile.image) });
      refsChanged();
    });
    return button;
  }));
  showBackend();
}

function showRefs() {
  const counts = {};
  for (const ref of refs) counts[ref.label] = (counts[ref.label] ?? 0) + 1;
  const list = Object.entries(counts).map(([label, n]) => `${label} ×${n}`).join(', ');
  $('ref-summary').textContent = refs.length
    ? `${refs.length} references in "${setName()}" (saved in this browser): ${list}. About 3 per name is enough.`
    : `No references in "${setName()}" yet.`;
  $('refs').replaceChildren(...refs.map((ref) => {
    const box = document.createElement('div');
    box.className = 'tile';
    if (ref.thumb) {
      const img = document.createElement('img');
      img.src = ref.thumb;
      box.append(img);
    }
    box.append(ref.label);
    return box;
  }));
}

function showBackend() {
  const { backend, msPerTile } = embedderInfo();
  $('backend').textContent = backend
    ? `Embedder: ${backend === 'GPU' ? 'GPU' : 'CPU (WASM)'} · ${msPerTile} ms per tile`
    : 'Embedder: not loaded yet.';
}

// Self-test (the "Done when" check, with the real model): a drawn board with three kinds of tiles.
// 3 tiles per kind become references; every other tile must get the right name. Does not touch your set.
async function selfTest() {
  stopCamera();
  status.textContent = 'Self-test: loading the Image Embedder…';
  try {
    const { image, labels } = fakeBoard();
    const picture = new ImageData(image.data, image.width, image.height);
    canvas.width = picture.width;
    canvas.height = picture.height;
    ctx.putImageData(picture, 0, 0);
    const cut = cutTiles(picture, labels.length, labels[0].length, 0.08);
    const { references, rest } = splitReferences(labels, 3);
    const testRefs = [];
    for (const { label, row, col } of references) testRefs.push({ label, embedding: await embed(cut[row][col]) });
    let right = 0;
    const shown = [];
    for (const { label, row, col } of rest) {
      const match = matchTile(await embed(cut[row][col]), testRefs);
      if (match.label === label) right++;
      const box = document.createElement('div');
      box.className = match.label === label ? 'tile' : 'tile wrong';
      box.append(toCanvas(cut[row][col]), `${match.label} ${match.score.toFixed(2)}`);
      shown.push(box);
    }
    $('tiles').replaceChildren(...shown);
    showBackend();
    const verdict = right === rest.length ? 'PASS' : 'FAIL';
    status.textContent = `Self-test ${verdict}: ${right} of ${rest.length} tiles named right with 3 references per kind.`;
    document.title = `selftest ${verdict} ${right}/${rest.length} ${embedderInfo().backend} ${embedderInfo().msPerTile}ms`;
  } catch (err) {
    status.textContent = `Self-test failed: ${err.message}`;
    document.title = `selftest ERROR ${err.message}`;
    console.error(err);
  }
}

async function startCamera() {
  try {
    await openCamera(video);
  } catch (err) {
    status.textContent = err.message;
    return;
  }
  live = true;
  $('camera-button').textContent = 'Take picture';
  status.textContent = 'Point at the board, then press Take picture.';
  while (live) {
    if (video.readyState >= 2) {
      const picture = grabFrame(video);
      canvas.width = picture.width;
      canvas.height = picture.height;
      ctx.putImageData(picture, 0, 0);
    }
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

function takePicture() {
  const picture = grabFrame(video);
  stopCamera();
  show(picture);
}

function stopCamera() {
  if (!live) return;
  live = false;
  closeCamera(video);
  $('camera-button').textContent = 'Start camera';
}

function toCanvas(image) {
  const out = document.createElement('canvas');
  out.width = image.width;
  out.height = image.height;
  out.getContext('2d').putImageData(image, 0, 0);
  return out;
}

// A small JPEG of a tile (data URL), so the reference list shows what was named.
function thumbnail(image) {
  const small = document.createElement('canvas');
  const scale = 48 / Math.max(image.width, image.height);
  small.width = Math.max(1, Math.round(image.width * scale));
  small.height = Math.max(1, Math.round(image.height * scale));
  small.getContext('2d').drawImage(toCanvas(image), 0, 0, small.width, small.height);
  return small.toDataURL('image/jpeg', 0.7);
}
