// @ts-check
// The device checks of check.html, shared with the demo launcher's pre-flight (workshop/index.html, issue #133).
// Each check gives { ok, text, fix? } (the line's name comes from the page). Browser only: they touch the camera,
// storage and models. The pure part (which browser is this) is in device.js.
import { loadVision, VISION_WASM } from './libs.js';
import { cameraHelp } from './camera.js';
import { readBrowser } from './device.js';

export function httpsCheck() {
  if (window.isSecureContext) return { name: 'HTTPS', ok: true, text: 'secure page' };
  return { name: 'HTTPS', ok: false, text: 'not secure', fix: 'Open the page with https:// (the camera needs it).' };
}

// The same help as the app's camera panel (engine/camera.js cameraHelp, issue #153): text = what happened,
// fix = the first step, steps = all of them, link = the official help page.
export async function cameraCheck() {
  const options = { secure: window.isSecureContext, device: readBrowser(navigator.userAgent) };
  if (!navigator.mediaDevices?.getUserMedia) return failed(cameraHelp({ name: 'NoMediaDevices' }, options));
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    for (const track of stream.getTracks()) track.stop();
    return { ok: true, text: 'allowed' };
  } catch (err) {
    return failed(cameraHelp(err, options));
  }
}

/** @param {import('./camera.js').CameraHelp} help */
function failed(help) {
  return { ok: false, text: help.title, fix: help.steps[0], steps: help.steps, link: help.link };
}

// WebGPU is nice to have: without it MediaPipe runs on the CPU (WASM), just slower. So this line stays green.
export async function webgpuCheck() {
  const adapter = await navigator.gpu?.requestAdapter().catch(() => null);
  return adapter ? { ok: true, text: 'available (fast)' } : { ok: true, text: 'not available, WASM fallback is used (slower, fine)' };
}

export function wasmCheck() {
  // The smallest valid WebAssembly module: magic number plus version.
  const ok = typeof WebAssembly === 'object' && WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]));
  return ok
    ? { name: 'WebAssembly', ok: true, text: 'available' }
    : { name: 'WebAssembly', ok: false, text: 'missing', fix: 'Update your browser (iOS 26.4+, current Chrome).' };
}

export async function storageCheck() {
  localStorage.setItem('board-vision-check', '1');
  localStorage.removeItem('board-vision-check');
  const { quota } = (await navigator.storage?.estimate?.()) || {};
  if (quota === undefined) return { ok: true, text: 'works' };
  const mb = Math.round(quota / 1e6);
  if (mb < 100) return { ok: false, text: `only ${mb} MB`, fix: 'Free some space on the device, and do not use a private window.' };
  return { ok: true, text: `works, ${mb} MB free for this site` };
}

// Starts one MediaPipe model, with the GPU if possible, else the CPU. bytes: the model file when the page has
// downloaded it already (pre-flight progress, issue #162); else MediaPipe downloads it from modelUrl.
export async function loadModel(task, modelUrl, bytes) {
  const vision = await loadVision();
  const fileset = await vision.FilesetResolver.forVisionTasks(VISION_WASM);
  const source = bytes ? { modelAssetBuffer: bytes } : { modelAssetPath: modelUrl };
  for (const delegate of ['GPU', 'CPU']) {
    try {
      const model = await vision[task].createFromOptions(fileset, { baseOptions: { ...source, delegate } });
      model.close();
      return { ok: true, text: `loaded, runs on ${delegate}` };
    } catch (err) {
      if (delegate === 'CPU') throw err;
    }
  }
}

// Asks to keep the screen on (Screen Wake Lock API). Returns the lock (release it when done) with the line.
export async function wakeLockCheck() {
  if (!navigator.wakeLock) return { ok: false, text: 'not supported here', fix: 'Set the screen to stay on in the phone settings.' };
  try {
    const lock = await navigator.wakeLock.request('screen');
    return { ok: true, text: 'screen stays on', lock };
  } catch (err) {
    return { ok: false, text: err.message || String(err), fix: 'Turn off low-power mode, or set the screen to stay on in the phone settings.' };
  }
}
