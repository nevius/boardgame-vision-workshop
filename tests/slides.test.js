// @ts-check
// The code on the slides is real code (issue #122): every <pre data-code="<file>"> in workshop/slides.html must
// appear, line for line, in that file. Indentation may differ as a whole (the slide drops the common indent).
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const slides = readFileSync(join(root, 'workshop', 'slides.html'), 'utf8');

/** @param {string} html */
const unescape = (html) => html.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

/** Lines without their common indent, and without trailing spaces. @param {string[]} lines */
function dedent(lines) {
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => (l.match(/^ */) ?? [''])[0].length));
  return lines.map((l) => l.slice(indent).trimEnd());
}

/** True when `excerpt` is a run of whole lines in `source`. @param {string} excerpt @param {string} source */
function excerptIn(excerpt, source) {
  const want = dedent(excerpt.split('\n')).join('\n');
  const lines = source.split('\n');
  const n = excerpt.split('\n').length;
  for (let i = 0; i + n <= lines.length; i++) {
    if (dedent(lines.slice(i, i + n)).join('\n') === want) return true;
  }
  return false;
}

/** Every code excerpt on the slides: { file, code }. */
function excerpts() {
  return [...slides.matchAll(/<pre data-code="([^"]+)"><code>([\s\S]*?)<\/code><\/pre>/g)]
    .map(([, file, code]) => ({ file, code: unescape(code) }));
}

export function slideCodeMatchesSource() {
  const list = excerpts();
  assert.ok(list.length >= 4, 'the slides should show real code excerpts');
  for (const { file, code } of list) {
    // The participant export (scripts/export-check.js) has no solutions/ folder: skip those excerpts there.
    // They are still checked in this repo and on the solutions branch.
    if (file.startsWith('solutions/') && !existsSync(join(root, 'solutions'))) continue;
    const lines = code.split('\n').length;
    assert.ok(lines >= 5 && lines <= 12, `${file}: excerpt has ${lines} lines, keep it to 5–12`);
    assert.ok(excerptIn(code, readFileSync(join(root, file), 'utf8')),
      `${file}: the excerpt on workshop/slides.html no longer matches the file. Copy the current lines.\n${code}`);
  }
}

export function everyPreWithSourceHasCode() {
  const empty = (slides.match(/<pre data-code=/g) ?? []).length;
  assert.equal(excerpts().length, empty, 'a <pre data-src> on the slides is empty or not in <code>');
}

export function excerptCheckCatchesDrift() {
  assert.ok(excerptIn('  a();\n  b();', 'x\n    a();\n    b();\ny'));
  assert.ok(!excerptIn('a();\nc();', 'a();\nb();\nc();'));
}

export function slidesHaveSources() {
  assert.match(slides, /<h2>Further reading<\/h2>/);
  for (const url of ['docs.opencv.org', 'image_embedder', 'hand_landmarker', 'arxiv.org/abs/1905.02244', 'requestVideoFrameCallback']) {
    assert.ok(slides.includes(url), `sources slide misses ${url}`);
  }
}

// One numbering for the talk (issue #178): parts A, B, C; no bare "3 ·" headings; numbers never go backwards.
export function slidesUseOneNumbering() {
  const heads = [...slides.matchAll(/<h2>([^<]*)/g)].map(([, h]) => h);
  assert.ok(!heads.some((h) => /^\d+ ·/.test(h)), 'a slide heading still starts with a bare number: use A1, B2, …');
  const nums = heads.map((h) => (h.match(/^([ABC]\d?) ·/) ?? [])[1]).filter(Boolean);
  const parts = nums.map((n) => n[0]);
  assert.deepEqual([...parts].sort(), parts, `talk parts out of order: ${nums.join(' ')}`);
  for (const n of ['A1', 'A2', 'B1', 'B2', 'B3', 'C1', 'C2']) assert.ok(nums.includes(n), `no slide ${n}`);
  assert.match(slides, /<h2>The plan<\/h2>/, 'the agenda slide is missing');
  assert.ok((slides.match(/data-part="B · Recognition"/g) ?? []).length >= 4, 'part B slides need a section header');
}

// iPhone Safari draws markers with fill="context-stroke" as black triangles (issue #178).
export function arrowheadsHaveAFixedColour() {
  assert.ok(!slides.includes('context-stroke'), 'use one <marker> per colour with an explicit fill');
  for (const [m] of slides.matchAll(/<marker[\s\S]*?<\/marker>/g)) assert.match(m, /fill="#[0-9a-f]{6}"/, m);
}
