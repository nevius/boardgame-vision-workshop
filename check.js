// check.html: checks the device and loads every library and model once (fills the browser cache).
// Each check gives { name, ok, text, fix?, ms? } and becomes one green or red line.
import { browserCheck, installHint, isInstalled, resultText } from './engine/device.js';
import { loadVision, loadOpenCV, MODELS, LIBRARY_FILES } from './engine/libs.js';
import { httpsCheck, cameraCheck, webgpuCheck, wasmCheck, storageCheck, loadModel } from './engine/checks.js';
import { startOffline, warm, clearCache, cacheReport, askPersist, applyUpdate } from './engine/offline.js';
import { mountBusy } from './ui/busy-plain.js';
import { downloadRows, withNote } from './ui/download-rows.js';
import { defaultGame } from './games/list.js';

mountBusy(); // loads and slow steps show at the top (issue #134)

const list = document.getElementById('checks');
const summary = document.getElementById('summary');
const againButton = /** @type {HTMLButtonElement} */ (document.getElementById('again-button'));
const copyButton = /** @type {HTMLButtonElement} */ (document.getElementById('copy-button'));
const resultBox = document.getElementById('result');
const clearButton = /** @type {HTMLButtonElement} */ (document.getElementById('clear-button'));
let results = [];
const offline = startOffline();

againButton.addEventListener('click', run);
// Reload (issue #196: no F5 in a full-screen app): takes a waiting new version first.
document.getElementById('reload-button')?.addEventListener('click', () => { applyUpdate(); });
clearButton.addEventListener('click', async () => {
  clearButton.disabled = true;
  await clearCache();
  clearButton.textContent = 'Cache cleared';
});
copyButton.addEventListener('click', copyResult);
run();

async function run() {
  againButton.disabled = true;
  copyButton.disabled = true;
  list.textContent = '';
  results = [];
  summary.textContent = 'Checking…';

  add({ name: 'Browser', ...browserCheck(navigator.userAgent) });
  add({ name: 'Install', ...installHint(navigator.userAgent, isInstalled(window)) });
  add(httpsCheck());
  await step('Camera', cameraCheck);
  await step('WebGPU', webgpuCheck);
  add(wasmCheck());
  await step('Storage', storageCheck);
  // The big files download side by side, with MB and time left per file (issue #162); then each one starts.
  const files = downloadRows(list, LIBRARY_FILES);
  const file = (name) => files.get(name);
  await step('OpenCV.js', async () => { const d = await file('OpenCV.js').ready; await loadOpenCV(); return withNote({ ok: true, text: 'loaded' }, d); }, file('OpenCV.js').line);
  await step('MediaPipe WASM', async () => { const d = await file('MediaPipe WASM').ready; await loadVision(); return withNote({ ok: true, text: 'loaded' }, d); }, file('MediaPipe WASM').line);
  await step('Image Embedder model', async () => { const d = await file('Image Embedder model').ready; return withNote(await loadModel('ImageEmbedder', MODELS.imageEmbedder, d.bytes), d); }, file('Image Embedder model').line);
  await step('Hand Landmarker model', async () => { const d = await file('Hand Landmarker model').ready; return withNote(await loadModel('HandLandmarker', MODELS.handLandmarker, d.bytes), d); }, file('Hand Landmarker model').line);
  await step('On the device', deviceCacheCheck);

  const failed = results.filter((r) => !r.ok).length;
  summary.textContent = failed ? `${failed} problem(s). See the red lines for what to do.` : 'All good. See you at the workshop!';
  summary.className = failed ? 'bad' : 'good';
  againButton.disabled = false;
  copyButton.disabled = false;
}

// Runs one async check, measures its time, turns errors into a red line. line: a download row to finish.
async function step(name, check, line = add({ name, ok: null, text: 'checking…' })) {
  const start = performance.now();
  let result;
  try {
    result = await check();
  } catch (err) {
    result = { ok: false, text: err.message || String(err), fix: 'Reload the page. If it stays red, try another browser or Wi-Fi.' };
  }
  result.ms = Math.round(performance.now() - start);
  show(line, { name, ...result });
}

function add(result) {
  const line = document.createElement('li');
  list.append(line);
  show(line, result);
  return line;
}

function show(line, result) {
  if (result.ok !== null) results.push(result);
  line.className = result.ok === null ? 'wait' : result.ok ? 'good' : 'bad';
  const time = result.ms != null ? ` (${(result.ms / 1000).toFixed(1)} s)` : '';
  line.textContent = `${result.ok === null ? '…' : result.ok ? '✓' : '✗'} ${result.name}: ${result.text}${time}`;
  if (result.steps) line.append(helpPanel(result));
  else if (result.fix) {
    const fix = document.createElement('div');
    fix.className = 'fix';
    fix.textContent = result.fix;
    line.append(fix);
  }
}

// The camera help (issue #153, same texts as the app's panel): the steps for this phone, the official help page,
// "Try again" and "Use sample photos instead" (the app with the first game's sample photos).
function helpPanel(result) {
  const box = document.createElement('div');
  const steps = document.createElement('ol');
  steps.className = 'fix';
  for (const text of result.steps) steps.append(Object.assign(document.createElement('li'), { textContent: text }));
  box.append(steps);
  if (result.link) {
    const link = Object.assign(document.createElement('a'), { href: result.link.url, textContent: result.link.label, target: '_blank', rel: 'noopener' });
    box.append(link);
  }
  const row = document.createElement('div');
  row.className = 'help-actions';
  const again = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Try again' });
  again.addEventListener('click', run);
  const samples = Object.assign(document.createElement('a'), { className: 'button', href: `./#${defaultGame}&replay`, textContent: 'Use sample photos instead' });
  row.append(again, samples);
  box.append(row);
  return box;
}

async function deviceCacheCheck() {
  await offline;
  if (!('serviceWorker' in navigator) || !('caches' in window)) {
    return { ok: false, text: 'no service worker', fix: 'Use Safari or Chrome, not a private window.' };
  }
  const local = !navigator.serviceWorker.controller;
  if (local) return { ok: true, text: 'not active for this load (off on a local dev server and on tailscale serve: add ?sw=1 to turn it on; after a hard reload: reload once)' };
  await warm();
  const kept = await askPersist();
  const r = await cacheReport();
  const keep = kept === null ? '' : kept ? ', kept for good' : ', the browser may clear it (add the page to the home screen)';
  const used = r.usedMb === null ? '' : `, ${r.usedMb} MB`;
  return { ok: true, text: `${r.libs} library and model files, ${r.app} app files, ${r.photos} photos${used}${keep}` };
}

async function copyResult() {
  const text = resultText(results, navigator.userAgent);
  resultBox.textContent = text;
  resultBox.hidden = false;
  try {
    await navigator.clipboard.writeText(text);
    copyButton.textContent = 'Copied';
  } catch {
    copyButton.textContent = 'Select the text below to copy';
  }
}
