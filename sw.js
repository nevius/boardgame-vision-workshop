// @ts-check
// The service worker (issue #136): keeps libraries, models, app files and opened photos on the device, so the
// app starts fast and works offline after one visit. Plain code, no library. Rules: engine/cache-rules.js.
// The page side (register, update note, "Clear cache"): engine/offline.js. Overview: docs/ARCHITECTURE.md.
/// <reference lib="webworker" />
import { strategyFor, deployStamp, updateStep, LIBS_CACHE, PHOTOS_CACHE, META_CACHE, APP_PREFIX, PREFIX } from './engine/cache-rules.js';

const sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));
const scope = () => sw.registration.scope;

sw.addEventListener('install', () => { sw.skipWaiting(); });
sw.addEventListener('activate', (event) => { event.waitUntil(sw.clients.claim()); });

sw.addEventListener('fetch', (event) => {
  const req = event.request;
  const kind = strategyFor(req.method, req.url, scope());
  if (!kind || req.cache === 'no-store') return;
  if (kind === 'libs') return event.respondWith(cacheFirst(LIBS_CACHE, req));
  if (kind === 'photos') return event.respondWith(fromCacheRefresh(PHOTOS_CACHE, req, event));
  if (req.mode === 'navigate') event.waitUntil(checkUpdate());
  event.respondWith(appCache().then((name) => networkFirst(name, req)));
});

// App files (HTML, JS, CSS, games/, engine/, ui/): from the network first, the device copy only when the network
// fails or is too slow (offline, bad Wi-Fi). Cache-first here mixed old cached modules with new ones after a
// deploy ("Importing a module script failed" on iPhone). The big files (libraries, models) stay cache-first.
const NETWORK_WAIT_MS = 4000;
/** @param {string} name @param {Request} req */
async function networkFirst(name, req) {
  const cache = await caches.open(name);
  const net = fetch(req).then(async (res) => {
    if (res.ok && res.type === 'basic') await cache.put(req, res.clone());
    return res;
  });
  /** @type {Promise<Response | undefined>} */
  const slow = new Promise((resolve) => setTimeout(() => resolve(undefined), NETWORK_WAIT_MS));
  try {
    const first = await Promise.race([net, slow]);
    if (first) return first;
  } catch {
    // offline: fall through to the device copy
  }
  const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
  return hit || net;
}

// Libraries and models: from the device; the network only the first time.
/** @param {string} name @param {Request} req */
async function cacheFirst(name, req) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) await cache.put(req, res.clone());
  // A plain <script> tag gives an unreadable (opaque) answer: store a CORS copy instead (jsDelivr and the
  // model bucket allow it), so the file is on the device next time too.
  else if (res.type === 'opaque') fetch(req.url, { mode: 'cors' }).then((r) => r.ok && cache.put(req.url, r)).catch(() => null);
  return res;
}

// App files and photos: from the device; the network fills what is missing. Photos are also refreshed in the
// background (they are not tied to a deploy); app files change only through the update note.
/** @param {string} name @param {Request} req @param {FetchEvent | null} refresh */
async function fromCacheRefresh(name, req, refresh) {
  const cache = await caches.open(name);
  const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
  if (hit && !refresh) return hit;
  const net = fetch(req).then(async (res) => {
    if (res.ok && res.type === 'basic') await cache.put(req, res.clone());
    return res;
  });
  if (!hit) return net;
  if (refresh) refresh.waitUntil(net.catch(() => null));
  return hit;
}

// --- Deploy version -------------------------------------------------------------------------------------
// The cache "board-vision-app-<stamp>" holds the app files of one deploy. The stamp comes from the start page
// (deployStamp). A different stamp = a new deploy: every app file is fetched again into a new cache, then the
// page shows "New version · reload". Only the tap switches over, so old and new files never mix.

/** @param {string} key */
async function meta(key) {
  const res = await (await caches.open(META_CACHE)).match(key);
  return res ? res.text() : '';
}
/** @param {string} key @param {string} value */
async function setMeta(key, value) {
  const cache = await caches.open(META_CACHE);
  if (value) await cache.put(key, new Response(value));
  else await cache.delete(key);
}

// The name of the current app cache; the first visit makes one (once, even when many requests ask at once).
/** @type {Promise<string> | null} */
let naming = null;
async function appCache() {
  const current = await meta('current');
  if (current) return current;
  naming ??= newAppCache().finally(() => { naming = null; });
  return naming;
}
async function newAppCache() {
  const stamp = await fetchStamp().catch(() => '');
  const name = APP_PREFIX + (stamp || 'first');
  await setMeta('current', name);
  return name;
}

async function fetchStamp() {
  const res = await fetch(scope(), { cache: 'no-cache' });
  if (!res.ok) return '';
  const text = deployStamp(res.headers) ? '' : await res.text();
  return deployStamp(res.headers, text ? String(hash(text)) : '');
}

/** Small text hash (FNV-1a), only for servers without Last-Modified or ETag. @param {string} text */
function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

let checking = null;
function checkUpdate() {
  checking ??= findUpdate().catch(() => null).finally(() => { checking = null; });
  return checking;
}

async function findUpdate() {
  const current = await appCache();
  const stamp = await fetchStamp();
  if (!stamp) return;
  const name = APP_PREFIX + stamp;
  if (current === APP_PREFIX + 'first') {
    // First visit without a stamp (offline start): adopt the files under the real name.
    await copyCache(current, name, false);
    await setMeta('current', name);
    await caches.delete(current);
    return;
  }
  if (name === current || name === await meta('next')) return;
  // New deploy: fetch every app file again into the new cache. Files the new deploy no longer has are left out;
  // offline or server trouble = try next time (updateStep).
  try {
    await copyCache(current, name, true);
  } catch (err) {
    await caches.delete(name);
    throw err;
  }
  await setMeta('next', name);
  tell({ type: 'update-ready' });
}

/** @param {string} from @param {string} to @param {boolean} fresh  fetch from the network instead of copying */
async function copyCache(from, to, fresh) {
  const old = await caches.open(from);
  const next = await caches.open(to);
  for (const req of await old.keys()) {
    const res = fresh ? await fetch(req.url, { cache: 'no-cache' }) : await old.match(req);
    if (!res) continue;
    const step = updateStep(res.status);
    if (step === 'skip') continue;
    if (step === 'stop') throw new Error(`update: ${res.status} ${req.url}`);
    await next.put(req, res);
  }
}

async function applyUpdate() {
  const next = await meta('next');
  if (!next) return;
  await setMeta('current', next);
  await setMeta('next', '');
  for (const key of await caches.keys()) if (key.startsWith(APP_PREFIX) && key !== next) await caches.delete(key);
}

/** @param {any} msg */
async function tell(msg) {
  for (const client of await sw.clients.matchAll({ type: 'window' })) client.postMessage(msg);
}

// --- Messages from the page (engine/offline.js) ----------------------------------------------------------
sw.addEventListener('message', (event) => {
  const msg = event.data || {};
  const reply = (/** @type {any} */ data) => event.source?.postMessage(data);
  if (msg.type === 'hello') event.waitUntil(meta('next').then((next) => { if (next) reply({ type: 'update-ready' }); }));
  if (msg.type === 'apply-update') event.waitUntil(applyUpdate().then(() => reply({ type: 'updated' })));
  if (msg.type === 'warm') event.waitUntil(warm(msg.urls || []).then(() => reply({ type: 'warmed' })));
  if (msg.type === 'clear') event.waitUntil(clearAll().then(() => reply({ type: 'cleared' })));
});

// Files the page loaded before the service worker took over (the first visit): store them now.
/** @param {string[]} urls */
async function warm(urls) {
  const app = await appCache();
  for (const url of urls) {
    const kind = strategyFor('GET', url, scope());
    if (!kind) continue;
    const cache = await caches.open(kind === 'libs' ? LIBS_CACHE : kind === 'photos' ? PHOTOS_CACHE : app);
    if (await cache.match(url)) continue;
    try {
      const res = await fetch(url, { mode: kind === 'libs' ? 'cors' : 'same-origin' });
      if (res.ok) await cache.put(url, res);
    } catch { /* offline or blocked: the next visit tries again */ }
  }
}

async function clearAll() {
  for (const key of await caches.keys()) if (key.startsWith(PREFIX)) await caches.delete(key);
}
