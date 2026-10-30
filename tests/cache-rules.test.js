// @ts-check
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { strategyFor, deployStamp, swWanted, updateStep } from '../engine/cache-rules.js';
import { VISION_WASM, MODELS } from '../engine/libs.js';

const scope = 'https://x.github.io/board-vision/';
const s = (/** @type {string} */ url, method = 'GET') => strategyFor(method, url, scope);

export function pinnedLibrariesAndModelsAreKeptForGood() {
  const map = JSON.parse(readFileSync('index.html', 'utf8').match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
  for (const url of Object.values(map.imports)) assert.equal(s(url), 'libs', url);
  assert.equal(s(`${VISION_WASM}/vision_wasm_internal.wasm`), 'libs');
  for (const url of Object.values(MODELS)) assert.equal(s(url), 'libs', url);
}

export function unpinnedOrOtherSitesAreLeftAlone() {
  assert.equal(s('https://cdn.jsdelivr.net/npm/preact@latest/dist/preact.module.js'), null);
  assert.equal(s('https://cdn.jsdelivr.net/npm/preact@10/dist/preact.module.js'), null);
  assert.equal(s('https://storage.googleapis.com/other-bucket/x.task'), null);
  assert.equal(s('https://example.com/app.js'), null);
  assert.equal(s('https://x.github.io/other-repo/app.js'), null);
  assert.equal(s(`${scope}app.js`, 'POST'), null);
  assert.equal(s('blob:https://x.github.io/1234'), null);
}

export function ownFilesAreAppOrPhotos() {
  assert.equal(s(scope), 'app');
  assert.equal(s(`${scope}games/set.js`), 'app');
  assert.equal(s(`${scope}style.css`), 'app');
  assert.equal(s(`${scope}replay/set/1.jpg`), 'photos');
  assert.equal(s(`${scope}replay/set/1.JPEG`), 'photos');
  assert.equal(s(`${scope}sw.js`), null);
}

export function stampPrefersLastModified() {
  const h = (/** @type {Record<string, string>} */ o) => ({ get: (/** @type {string} */ k) => o[k] ?? null });
  assert.equal(deployStamp(h({ 'last-modified': 'A', etag: 'B' })), 'A');
  assert.equal(deployStamp(h({ etag: 'B' })), 'B');
  assert.equal(deployStamp(h({}), '123'), '123');
}

export function offOnLocalhostUnlessFlag() {
  assert.equal(swWanted('localhost', false), false);
  assert.equal(swWanted('127.0.0.1', false), false);
  assert.equal(swWanted('localhost', true), true);
  assert.equal(swWanted('x.github.io', false), true);
  assert.equal(swWanted('laptop.tail1234.ts.net', false), false);
  assert.equal(swWanted('laptop.tail1234.ts.net', true), true);
}

export function updateSkipsGoneFilesStopsOnServerTrouble() {
  assert.equal(updateStep(200), 'copy');
  assert.equal(updateStep(404), 'skip');
  assert.equal(updateStep(410), 'skip');
  assert.equal(updateStep(500), 'stop');
  assert.equal(updateStep(503), 'stop');
  assert.equal(updateStep(0), 'stop');
}
