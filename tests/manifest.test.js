// @ts-check
// The installable app (issue #151): manifest.webmanifest is valid, works under any site folder (relative paths),
// its icons exist in the right sizes, and every page links it. The icons match scripts/icons.js.
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pngjs from 'pngjs';
import { ICONS, drawIcon } from '../scripts/icons.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'manifest.webmanifest'), 'utf8'));
const pages = [...readdirSync(root).filter((f) => f.endsWith('.html')), 'workshop/index.html'];

export function manifestIsInstallable() {
  assert.ok(manifest.name && manifest.short_name);
  assert.equal(manifest.display, 'standalone');
  // Relative: the same file works on the demo site, the participant copy and a local server.
  for (const key of ['id', 'start_url', 'scope']) assert.equal(manifest[key], './', key);
  assert.match(manifest.theme_color, /^#[0-9a-f]{6}$/);
  assert.match(manifest.background_color, /^#[0-9a-f]{6}$/);
}

export function manifestIconsExist() {
  const sizes = manifest.icons.map((/** @type {any} */ i) => `${i.sizes} ${i.purpose}`);
  for (const want of ['192x192 any', '512x512 any', '512x512 maskable']) assert.ok(sizes.includes(want), want);
  for (const icon of manifest.icons) {
    assert.ok(!icon.src.startsWith('/'), `${icon.src} must be relative`);
    const png = pngjs.PNG.sync.read(readFileSync(join(root, icon.src)));
    assert.equal(`${png.width}x${png.height}`, icon.sizes, icon.src);
  }
}

export function iconsMatchTheScript() {
  for (const icon of ICONS) {
    const file = readFileSync(join(root, 'icons', icon.file));
    assert.ok(file.equals(drawIcon(icon.size, icon.board)), `icons/${icon.file} is stale: run node scripts/icons.js`);
  }
}

export function everyPageLinksTheManifest() {
  for (const page of pages) {
    const html = readFileSync(join(root, page), 'utf8');
    const links = [...html.matchAll(/<link rel="(?:manifest|apple-touch-icon)" href="([^"]+)">/g)].map((m) => m[1]);
    assert.equal(links.length, 2, `${page}: manifest and apple-touch-icon links`);
    for (const href of links) assert.ok(existsSync(join(root, dirname(page), href)), `${page} → ${href}`);
    assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes">/, page);
  }
}

// Issue #171, then owner 30.10.: the picture uses the whole screen, up under the clock ("black-translucent"). iOS 26
// softens (blurs) what sits right below the clock, so nothing to read sits there: the top bar has no strip of its
// own and keeps a safe margin from the top.
export function topKeepsASafeMargin() {
  const page = readFileSync(join(root, 'index.html'), 'utf8');
  const bar = readFileSync(join(root, 'ui/TopBar.js'), 'utf8');
  assert.match(page, /apple-mobile-web-app-status-bar-style" content="black-translucent"/);
  assert.match(page, /viewport-fit=cover/);
  assert.match(page, /name="theme-color" content="#171717"/);
  assert.equal(manifest.theme_color, '#171717');
  assert.match(page, /<body class="[^"]*overflow-hidden[^"]*overscroll-none/);
  const header = bar.match(/<header class="([^"]*)"/)?.[1] ?? '';
  assert.match(header, /pt-\[calc\(env\(safe-area-inset-top\)\+1\.75rem\)\]/, 'a safe margin below the clock');
  assert.doesNotMatch(header, /\bbg-/, 'no strip of its own: the picture shows up to the top');
}
