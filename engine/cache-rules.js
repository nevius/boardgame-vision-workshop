// @ts-check
// Which cache a URL goes into (issue #136). Pure rules, shared by sw.js (the service worker) and the tests.
//  'libs'   pinned files that never change: jsDelivr URLs with an exact version, the MediaPipe model files.
//           Fetched once, then always from the device.
//  'photos' sample and replay photos on our own site: kept once opened, refreshed in the background.
//  'app'    every other file on our own site (HTML, JS, CSS, games/, engine/, ui/): kept per deploy version.
//  null     anything else (camera, other sites, POST): the service worker leaves it alone.

/** Names of the caches; the prefix lets "Clear cache" find all of them. */
export const PREFIX = 'board-vision-';
export const LIBS_CACHE = `${PREFIX}libs`;
export const PHOTOS_CACHE = `${PREFIX}photos`;
export const META_CACHE = `${PREFIX}meta`;
export const APP_PREFIX = `${PREFIX}app-`;

const PHOTO = /\.(jpe?g|png|webp|heic)$/i;
// An exact version in a jsDelivr path: "@10.29.8", "@4.12.0-release.1". Not "@latest" or "@10".
const JSDELIVR_PINNED = /^\/(npm|gh)\/(@[^/@]+\/)?[^/@]+@\d+\.\d+\.\d+[^/]*\//;
// MediaPipe models: the version is a folder in the path (".../float16/1/hand_landmarker.task").
const MODEL_PINNED = /^\/mediapipe-models\/.+\/\d+\/[^/]+$/;

/**
 * @param {string} method  request method
 * @param {string} url  full request URL
 * @param {string} scope  the service worker's scope (the site folder), e.g. "https://x.github.io/board-vision/"
 * @returns {'libs' | 'photos' | 'app' | null}
 */
export function strategyFor(method, url, scope) {
  if (method !== 'GET') return null;
  let u;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.hostname === 'cdn.jsdelivr.net') return JSDELIVR_PINNED.test(u.pathname) ? 'libs' : null;
  if (u.hostname === 'storage.googleapis.com') return MODEL_PINNED.test(u.pathname) ? 'libs' : null;
  if (!url.startsWith(scope)) return null;
  if (u.pathname.endsWith('/sw.js')) return null;
  return PHOTO.test(u.pathname) ? 'photos' : 'app';
}

/**
 * The deploy version of the site, from the response headers of its start page. GitHub Pages gives every file a
 * new Last-Modified on each deploy. Falls back to the ETag, then to the given text (a hash of the page).
 * @param {{ get(name: string): string | null }} headers
 * @param {string} [fallback]
 */
export function deployStamp(headers, fallback = '') {
  return headers.get('last-modified') || headers.get('etag') || fallback;
}

/**
 * During an update, what to do with one app file the old cache holds, from the server's answer.
 * 'copy' = store it in the new cache. 'skip' = the new deploy has no such file (404, 410): leave it out, so a
 * renamed or deleted file never blocks updates. 'stop' = server trouble (5xx, anything else): try next time.
 * A network failure (offline) throws in fetch and stops the update too.
 * @param {number} status  HTTP status of the fresh download
 * @returns {'copy' | 'skip' | 'stop'}
 */
export function updateStep(status) {
  if (status >= 200 && status < 300) return 'copy';
  if (status === 404 || status === 410) return 'skip';
  return 'stop';
}

/**
 * Whether the page should use the service worker. Off on a local dev server (live reload) unless switched on,
 * also through `tailscale serve` (`*.ts.net`), the phone test without deploy.
 * @param {string} hostname  location.hostname
 * @param {boolean} flag  `?sw=1` in the address, or switched on earlier (localStorage)
 */
export function swWanted(hostname, flag) {
  const local = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname.endsWith('.local')
    || hostname.endsWith('.ts.net');
  return !local || flag;
}
