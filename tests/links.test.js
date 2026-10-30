// @ts-check
// Every relative link in the Markdown docs (README.md, AGENTS.md, engine/, replay/, docs/ARCHITECTURE.md, workshop/, workshop/learn/) and on check.html and workshop/slides.html points to a file that exists.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** @param {string} file @param {RegExp} pattern */
function brokenLinks(file, pattern) {
  const text = readFileSync(join(root, file), 'utf8');
  const broken = [];
  for (const [, href] of text.matchAll(pattern)) {
    if (/^(https?:|mailto:|#|data:)/.test(href)) continue;
    const path = href.split('#')[0];
    if (path && !existsSync(join(root, dirname(file), path))) broken.push(`${file} → ${href}`);
  }
  return broken;
}

export function markdownLinksWork() {
  const files = ['README.md', 'AGENTS.md', 'engine/README.md', 'replay/README.md', 'docs/ARCHITECTURE.md',
    ...['workshop', 'workshop/learn'].flatMap((dir) => readdirSync(join(root, dir), { withFileTypes: true }).filter((f) => f.isFile()).map((f) => `${dir}/${f.name}`))];
  assert.deepEqual(files.flatMap((f) => brokenLinks(f, /\]\(([^)\s]+)\)/g)), []);
}

export function checkPageLinksWork() {
  assert.deepEqual(brokenLinks('check.html', /href="([^"]+)"/g), []);
  assert.deepEqual(brokenLinks('workshop/index.html', /(?:href|src)="([^"]+)"/g), []);
  assert.deepEqual(brokenLinks('links.html', /(?:href|src)="([^"]+)"/g), []);
}

export function slidesLinksWork() {
  assert.deepEqual(brokenLinks('workshop/slides.html', /(?:href|src)="([^"]+)"/g), []);
}

export function workshopHasAllFiles() {
  assert.ok(existsSync(join(root, 'workshop', 'slides.html')), 'workshop/slides.html is missing');
  for (const f of ['facilitator', 'building-blocks', 'game-checklist', 'announcement']) {
    assert.ok(existsSync(join(root, 'workshop', `${f}.md`)), `workshop/${f}.md is missing`);
  }
}
