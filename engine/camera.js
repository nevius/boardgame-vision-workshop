// Camera and photo input. Every picture ends up as ImageData, so live frames and photos
// go through exactly the same detect → solve → draw pipeline.

import { busy, fetchBytes, nextPaint } from './busy.js';
import { readBrowser } from './device.js';

// Start the back camera (or a laptop webcam) in a <video> element. Returns the video.
// size: the resolution to ask for (Speed setting, engine/speed.js); the camera may give another one.
// Throws an Error whose message is a plain help text, with err.help = cameraHelp() for the help panel.
export async function openCamera(video, size = { width: 1920, height: 1080 }) {
  const secure = globalThis.isSecureContext !== false;
  const device = readBrowser(navigator.userAgent);
  const fail = (/** @type {any} */ err) => Object.assign(new Error(cameraErrorText(err, { secure, device })), { help: cameraHelp(err, { secure, device }) });
  if (!navigator.mediaDevices?.getUserMedia) {
    throw fail({ name: 'NoMediaDevices' });
  }
  // Ask for the back camera in the wished resolution; fall back to any camera if that is refused.
  const wish = { facingMode: { ideal: 'environment' }, width: { ideal: size.width }, height: { ideal: size.height } };
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: wish, audio: false });
  } catch (err) {
    if (err.name !== 'OverconstrainedError') throw fail(err);
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    } catch (err2) {
      throw fail(err2);
    }
  }
  // Continuous autofocus, if the camera offers it (Android Chrome; iPhone focuses by itself).
  const track = stream.getVideoTracks()[0];
  // focusMode is not in the standard types yet, hence the casts.
  const focusModes = /** @type {any} */ (track?.getCapabilities?.())?.focusMode || [];
  if (focusModes.includes('continuous')) {
    await track.applyConstraints({ advanced: [/** @type {any} */ ({ focusMode: 'continuous' })] }).catch(() => {});
  }
  // iPhone Safari only plays inline video when it is muted and marked playsinline.
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', '');
  video.srcObject = stream;
  await video.play();
  return video;
}

// Stop the camera that openCamera() started.
export function closeCamera(video) {
  for (const track of video.srcObject?.getTracks() || []) track.stop();
  video.srcObject = null;
}

// Ask the running camera for another resolution (Speed setting changed). Keeps the old one if refused.
export async function resizeCamera(video, size) {
  const track = video.srcObject?.getVideoTracks?.()[0];
  await track?.applyConstraints({ width: { ideal: size.width }, height: { ideal: size.height } }).catch(() => {});
}

// The current video picture as ImageData, scaled to width × height (default: full size).
// One canvas per size is reused, so live frames do not pile up memory.
const grabCanvases = new Map();
export function grabFrame(video, width = video.videoWidth, height = video.videoHeight) {
  const key = `${width}x${height}`;
  if (!grabCanvases.has(key)) {
    if (grabCanvases.size > 4) grabCanvases.clear(); // sizes change with the phone turned or the Speed setting
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    grabCanvases.set(key, canvas);
  }
  const ctx = grabCanvases.get(key).getContext('2d', { willReadFrequently: true });
  ctx.drawImage(video, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

// Load a photo file or URL (for replay without a camera). Returns ImageData.
// The busy indicator shows label (and the download progress); the page paints once before the decode starts.
export async function loadPhoto(source, label = 'Reading photo…') {
  return busy(label, async (job) => {
    await nextPaint();
    const blob = typeof source === 'string' ? new Blob([await fetchBytes(source, job.progress)], { type: photoType(source) }) : source;
    job.progress(null);
    await nextPaint();
    return decodePhoto(blob);
  });
}

// The picture type from the file name (Safari decodes more reliably with it).
const photoType = (/** @type {string} */ url) => (/\.png$/i.test(url) ? 'image/png' : 'image/jpeg');

/** @param {Blob} blob */
async function decodePhoto(blob) {
  const bitmap = await createImageBitmap(blob); // turns phone photos upright (EXIF)
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

// Save a frame (ImageData) as a JPEG photo. On a phone it lands in Downloads (Android) or Files (iPhone).
export async function savePhoto(frame, fileName) {
  const canvas = document.createElement('canvas');
  canvas.width = frame.width;
  canvas.height = frame.height;
  canvas.getContext('2d').putImageData(frame, 0, 0);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 10000);
}

// File name for a snapshot, e.g. "qwirkle-2026-10-16-142501.jpg".
export function photoName(game, date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `${game}-${day}-${time}.jpg`;
}

// Official help pages the camera help links to (issue #153).
export const HELP_LINKS = {
  ios: { label: 'Apple help: Safari website settings', url: 'https://support.apple.com/guide/iphone/customize-safari-settings-iphb1cb5f1a7/ios' },
  android: { label: 'Google help: camera in Chrome', url: 'https://support.google.com/chrome/answer/2693767?hl=en&co=GENIE.Platform%3DAndroid' },
  desktop: { label: 'Google help: camera in Chrome', url: 'https://support.google.com/chrome/answer/2693767' },
};

/**
 * What to do when the camera does not start (issue #153), for the help panel in the app and the device check.
 * kind: 'insecure' | 'browser' | 'denied' | 'busy' | 'none' | 'other'. title: one short line (also the mode chip).
 * steps: 1–4 plain steps for this phone. link: the official help page, or null.
 * @typedef {{ kind: string, title: string, steps: string[], link: { label: string, url: string } | null }} CameraHelp
 */

/**
 * err.name comes from getUserMedia. secure: false when the page is not on HTTPS or localhost.
 * device: readBrowser() of engine/device.js ({ os, browser }); a laptop when not given.
 * @param {{ name?: string, message?: string } | null | undefined} err
 * @param {{ secure?: boolean, device?: { os: string, browser: string } }} [options]
 * @returns {CameraHelp}
 */
export function cameraHelp(err, { secure = true, device = { os: 'desktop', browser: 'any' } } = {}) {
  const { os } = device;
  if (!secure) {
    return {
      kind: 'insecure', title: 'The camera needs a secure page (https://).', link: null,
      steps: [
        'Open the https:// link of the page (the QR code or the GitHub Pages address).',
        'On a laptop with pnpm dev, use http://localhost instead of a 192.168.x.x address.',
        'Plain http:// addresses never get the camera.',
      ],
    };
  }
  switch (err?.name) {
    case 'NoMediaDevices': // a secure page, but this browser has no camera access (an old browser or an in-app view)
      return {
        kind: 'browser', title: 'This browser has no camera access.', link: null,
        steps: [
          os === 'ios' ? 'Open this page in Safari (iOS 26.4 or later).' : os === 'android' ? 'Open this page in Chrome.' : 'Open this page in a current Chrome, Edge, Firefox or Safari.',
          'Or use Sample photos instead.',
        ],
      };
    case 'NotAllowedError':
    case 'SecurityError':
      return { kind: 'denied', title: 'Camera permission was denied.', steps: deniedSteps(device), link: HELP_LINKS[os] ?? null };
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return {
        kind: 'busy', title: 'The camera is busy.', link: null,
        steps: [
          os === 'desktop' ? 'Close other apps that use the camera (video call, camera app).'
            : 'Close other apps that use the camera: swipe them away in the app switcher (video call, camera app).',
          'Close other browser tabs with this page or a video call.',
          'Tap Try again.',
        ],
      };
    case 'NotFoundError':
    case 'OverconstrainedError':
      return {
        kind: 'none', title: 'No camera found on this device.', link: null,
        steps: ['Use Sample photos, or pick Your photos in the More sheet.', 'On a laptop: plug in a webcam, then tap Try again.'],
      };
    default:
      return {
        kind: 'other', title: `Could not start the camera (${err?.name || 'unknown error'}: ${err?.message || ''}).`, link: null,
        steps: ['Tap Try again.', 'Still not working: reload the page, or use Safari on iPhone / Chrome on Android.'],
      };
  }
}

// The steps to allow the camera again, for this phone. iPhone: per site in Safari, then the Settings app.
// Chrome on iPhone has its own entry in Settings. Android Chrome: the icon left of the address, then the app setting.
function deniedSteps({ os, browser }) {
  if (os === 'ios') {
    const app = browser === 'chrome' ? 'Chrome' : browser === 'firefox' ? 'Firefox' : 'Safari';
    const site = browser === 'safari'
      ? ['In the address bar, tap the page menu (aA or ⋯) → Website Settings → Camera → Allow.']
      : [];
    return [...site, `Or: Settings app → Apps → ${app} → Camera → Allow.`, 'Come back here and tap Try again (reload if it stays blocked).'];
  }
  if (os === 'android') {
    return [
      'Tap the icon left of the address → Permissions (or Site settings) → Camera → Allow.',
      'Still blocked: Android Settings → Apps → Chrome → Permissions → Camera → Allow.',
      'Come back here and tap Try again (reload if it stays blocked).',
    ];
  }
  return ['Click the icon left of the address → Camera → Allow.', 'Then click Try again (reload if it stays blocked).'];
}

// Plain help text for a camera error, as one line (the debug pages show it like this).
export function cameraErrorText(err, options = {}) {
  const help = cameraHelp(err, options);
  return [help.title, ...help.steps].join(' ');
}
