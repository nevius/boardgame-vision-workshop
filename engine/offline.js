// @ts-check
// The page side of the device cache (issue #136): starts the service worker (sw.js), shows "New version" when a
// deploy is ready, and offers "Clear cache" and a list of what is stored. Off on localhost and Tailscale unless `?sw=1`.
import { swWanted, PREFIX, LIBS_CACHE, PHOTOS_CACHE, META_CACHE, APP_PREFIX } from './cache-rules.js';

const FLAG = 'board-vision-sw';
let onUpdate = () => {};

/**
 * Starts the service worker. `swUrl` is the path of sw.js from this page ("sw.js" at the site root).
 * @param {{ swUrl?: string, onUpdateReady?: () => void }} [options]
 */
export async function startOffline({ swUrl = 'sw.js', onUpdateReady } = {}) {
  if (!('serviceWorker' in navigator)) return;
  if (onUpdateReady) onUpdate = onUpdateReady;
  const flag = readFlag();
  if (!swWanted(location.hostname, flag)) {
    // Local dev server: no cache in the way of live reload. Remove one left from an earlier `?sw=1`.
    for (const reg of await navigator.serviceWorker.getRegistrations()) await reg.unregister();
    return;
  }
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'update-ready') onUpdate();
  });
  try {
    await navigator.serviceWorker.register(swUrl, { type: 'module', updateViaCache: 'none' });
  } catch (err) {
    console.warn('Service worker not started:', err);
    return;
  }
  const worker = await controller();
  if (!worker) return;
  worker.postMessage({ type: 'hello' });
  warm(worker);
}

function readFlag() {
  const q = new URLSearchParams(location.search).get('sw');
  try {
    if (q === '1') localStorage.setItem(FLAG, '1');
    if (q === '0') localStorage.removeItem(FLAG);
    return localStorage.getItem(FLAG) === '1';
  } catch {
    return q === '1';
  }
}

// The worker that serves this page; on the first visit it takes over a moment after it starts. After a hard
// reload (Shift+Reload) it never takes over this page: null after 3 s, the next normal load is served again.
/** @returns {Promise<ServiceWorker | null>} */
async function controller() {
  await navigator.serviceWorker.ready;
  if (navigator.serviceWorker.controller) return navigator.serviceWorker.controller;
  return new Promise((resolve) => {
    const done = () => resolve(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', done, { once: true });
    setTimeout(done, 3000);
  });
}

/** Sends a message to the worker and waits for its answer. @param {any} msg @param {string} answer */
async function ask(msg, answer) {
  const worker = await controller();
  if (!worker) return null;
  return new Promise((resolve) => {
    const listen = (/** @type {MessageEvent} */ event) => {
      if (event.data?.type !== answer) return;
      navigator.serviceWorker.removeEventListener('message', listen);
      resolve(event.data);
    };
    navigator.serviceWorker.addEventListener('message', listen);
    worker.postMessage(msg);
  });
}

// Files loaded before the worker took over (first visit): the worker stores them too.
/** @param {ServiceWorker} [worker] */
export async function warm(worker) {
  const urls = [location.href.split('#')[0], ...performance.getEntriesByType('resource').map((e) => e.name)];
  if (worker) worker.postMessage({ type: 'warm', urls });
  else if (navigator.serviceWorker?.controller) await ask({ type: 'warm', urls }, 'warmed');
}

/** "New version · reload" (ui/TopBar.js): switch to the new files, then reload the page. */
export async function applyUpdate() {
  if (navigator.serviceWorker?.controller) await ask({ type: 'apply-update' }, 'updated');
  location.reload();
}

/** Deletes everything this site stored in Cache Storage (settings in localStorage stay). */
export async function clearCache() {
  if (!('caches' in window)) return;
  for (const key of await caches.keys()) if (key.startsWith(PREFIX)) await caches.delete(key);
}

/**
 * Whether a URL is already on the device (for a "from device" vs "downloading" note, issue #134).
 * @param {string} url
 */
export async function isOnDevice(url) {
  if (!('caches' in window)) return false;
  return Boolean(await caches.match(url));
}

/**
 * What is stored: files per cache and the total size the browser reports. For check.html.
 * @returns {Promise<{ libs: number, app: number, photos: number, usedMb: number | null, active: boolean }>}
 */
export async function cacheReport() {
  const count = async (/** @type {string} */ name) => (await (await caches.open(name)).keys()).length;
  const keys = 'caches' in window ? await caches.keys() : [];
  // The app cache in use (not a newer one that waits for the update tap).
  const current = keys.includes(META_CACHE) ? await (await (await caches.open(META_CACHE)).match('current'))?.text() : '';
  const app = current && keys.includes(current) ? current : keys.filter((k) => k.startsWith(APP_PREFIX)).at(-1);
  const { usage } = (await navigator.storage?.estimate?.()) || {};
  return {
    libs: keys.includes(LIBS_CACHE) ? await count(LIBS_CACHE) : 0,
    app: app ? await count(app) : 0,
    photos: keys.includes(PHOTOS_CACHE) ? await count(PHOTOS_CACHE) : 0,
    usedMb: usage === undefined ? null : Math.round(usage / 1e6),
    active: Boolean(navigator.serviceWorker?.controller),
  };
}

/** Asks the browser to keep the stored files (not clear them when space is low). @returns {Promise<boolean | null>} */
export async function askPersist() {
  if (!navigator.storage?.persist) return null;
  return (await navigator.storage.persisted()) || navigator.storage.persist();
}

