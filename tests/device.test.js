import assert from 'node:assert/strict';
import { readBrowser, browserCheck, olderThan, resultText, installHint, isInstalled } from '../engine/device.js';

const iphone = (v) => `Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${v} Mobile/15E148 Safari/604.1`;
const android = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
const samsung = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36';
const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

export function readsBrowsers() {
  assert.deepEqual(readBrowser(iphone('26.4')), { os: 'ios', browser: 'safari', version: '26.4' });
  assert.equal(readBrowser(android).browser, 'chrome');
  assert.equal(readBrowser(samsung).browser, 'other');
  assert.equal(readBrowser(mac).os, 'desktop');
}

export function comparesVersions() {
  assert.equal(olderThan('26.3', '26.4'), true);
  assert.equal(olderThan('26.10', '26.4'), false);
  assert.equal(olderThan('27.0', '26.4'), false);
  assert.equal(olderThan('18.6', '26.4'), true);
}

export function givesPlainFixes() {
  assert.match(browserCheck(iphone('18.6')).fix, /Update iOS to 26.4/);
  assert.equal(browserCheck(iphone('26.4')).ok, true);
  assert.match(browserCheck(samsung).fix, /Use Chrome on Android/);
  assert.equal(browserCheck(android).ok, true);
  assert.equal(browserCheck(mac).ok, true);
}

export function writesResultText() {
  const text = resultText([{ name: 'WebGPU', ok: true, text: 'available', ms: 12 }, { name: 'Camera', ok: false, text: 'refused' }], 'UA');
  assert.match(text, /OK   WebGPU: available \(12 ms\)/);
  assert.match(text, /FAIL Camera: refused/);
}

export function givesOneInstallLinePerPlatform() {
  assert.match(installHint(iphone('26.4')).text, /Add to Home Screen/);
  assert.match(installHint(android).text, /Install app/);
  assert.match(installHint(mac).text, /address bar/);
  assert.match(installHint(iphone('26.4'), true).text, /installed/);
  for (const ua of [iphone('26.4'), android, mac]) assert.equal(installHint(ua).ok, true);
}

export function knowsWhenInstalled() {
  const media = (on) => () => ({ matches: on });
  assert.equal(isInstalled({ matchMedia: media(true), navigator: {} }), true);
  assert.equal(isInstalled({ matchMedia: media(false), navigator: { standalone: true } }), true);
  assert.equal(isInstalled({ matchMedia: media(false), navigator: {} }), false);
}
