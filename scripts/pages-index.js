// @ts-check
// Builds pages.json, the list behind the "All pages" page (links.html, issue #172), from the files themselves:
// every *.html page (title from <title>, one line from <meta name="description">), the workshop lessons and the
// main docs (Markdown: title from the first "# " heading), the games that have a finished version (solutions/) and
// the known Ubongo cards (CARDS in games/ubongo.js, for the #ubongo&card=… links).
//   node scripts/pages-index.js     write pages.json (run it after adding a page; tests/pages.test.js fails until then)
// The games themselves and the demo buttons are not in pages.json: links.html reads games/list.js and the
// launcher's DEMOS directly, so they never go stale.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** @typedef {'Play' | 'Workshop' | 'Debug' | 'Docs' | 'Other'} Category */
/** @typedef {{ path: string, title: string, category: Category, about: string }} Page */
/** @typedef {{ pages: Page[], solutions: string[], cards: string[] }} PagesIndex */

/** The order of the sections on links.html. */
export const CATEGORIES = /** @type {Category[]} */ (['Play', 'Workshop', 'Debug', 'Docs', 'Other']);

// Category from the path: workshop/ → Workshop, these debug pages → Debug, the rest → Other. Overrides first.
const OVERRIDE = /** @type {Record<string, Category>} */ ({
  'index.html': 'Play',
  'check.html': 'Workshop',
  'print.html': 'Workshop',
  'README.md': 'Docs',
  'engine/README.md': 'Docs',
  'docs/ARCHITECTURE.md': 'Docs',
});
const DEBUG = ['warp.html', 'tiles.html', 'ubongo-pieces.html', 'shots.html'];
// The Markdown files listed (the docs; every .md in workshop/ and workshop/learn/ is added by itself).
const DOCS = ['README.md', 'engine/README.md', 'docs/ARCHITECTURE.md'];
// Better names or lines than the file gives, where it has none.
const TITLE = /** @type {Record<string, string>} */ ({ 'index.html': 'The app', 'README.md': 'README' });
const ABOUT = /** @type {Record<string, string>} */ ({
  'workshop/announcement.md': 'The workshop announcement text (German), for the facilitator.',
  'workshop/game-checklist.md': 'A checklist: does a board game fit the app?',
  'workshop/facilitator.md': 'How to run the 2.5 h workshop: timing, demo script, setup.',
});
// Not listed: the "All pages" page itself.
const SKIP = ['links.html'];

/** @param {string} path @returns {Category} */
export function categoryOf(path) {
  if (OVERRIDE[path]) return OVERRIDE[path];
  if (path.startsWith('workshop/')) return 'Workshop';
  if (DEBUG.includes(path)) return 'Debug';
  return 'Other';
}

/** @param {string} text */
const plain = (text) => text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim();

/** Title and one line from an HTML page. @param {string} path @param {string} text */
function fromHtml(path, text) {
  const title = text.match(/<title>([^<]*)<\/title>/)?.[1].trim();
  const about = text.match(/<meta name="description" content="([^"]*)"/)?.[1].trim();
  if (!title) throw new Error(`${path}: no <title>`);
  if (!about) throw new Error(`${path}: no <meta name="description" content="…"> (one line what the page is)`);
  return { title: title.replace(/^board-vision\s*[:·]\s*/, ''), about };
}

/**
 * Title and one line from a Markdown file: "# Title (who it is for)" → the title without the brackets, and the
 * first sentence of the first plain paragraph as the one line.
 * @param {string} path @param {string} text
 */
function fromMarkdown(path, text) {
  const lines = text.split('\n');
  const heading = lines.find((l) => l.startsWith('# '));
  if (!heading) throw new Error(`${path}: no "# " heading`);
  const title = heading.slice(2).replace(/\s+\([^)]*\)$/, '');
  const start = lines.findIndex((l) => /^[A-Za-z0-9[`]/.test(l));
  const end = lines.findIndex((l, i) => i > start && !l.trim());
  let about = plain(start < 0 ? '' : lines.slice(start, end < 0 ? undefined : end).join(' ')).split(/(?<=\.)\s/)[0];
  if (about.length > 110) about = `${about.slice(0, 110).replace(/\s+\S*$/, '')} …`;
  return { title: plain(title), about };
}

/**
 * The index from a list of file paths ("/" separated, from the repo root) and a way to read them. Pure apart from
 * `read`, so the export (scripts/export.js) can build it from the participant copy's files too.
 * @param {string[]} files @param {(path: string) => string} read
 * @returns {PagesIndex}
 */
export function buildIndex(files, read) {
  const wanted = files.filter((f) => !SKIP.includes(f) && (f.endsWith('.html') || DOCS.includes(f) || /^workshop\/(learn\/)?[^/]+\.md$/.test(f)));
  const pages = wanted.map((path) => {
    const found = path.endsWith('.html') ? fromHtml(path, read(path)) : fromMarkdown(path, read(path));
    const title = TITLE[path] ?? found.title;
    return { path, title: title[0].toUpperCase() + title.slice(1), category: categoryOf(path), about: ABOUT[path] ?? found.about };
  });
  // By category, then pages before Markdown, then by path.
  const md = (/** @type {Page} */ p) => Number(p.path.endsWith('.md'));
  pages.sort((a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || md(a) - md(b) || a.path.localeCompare(b.path));
  const solutions = files.map((f) => f.match(/^solutions\/([\w-]+)\.js$/)?.[1]).filter((g) => g !== undefined).sort();
  return { pages, solutions, cards: cardsIn(files.includes('games/ubongo.js') ? read('games/ubongo.js') : '') };
}

/**
 * The card names in "export const CARDS = { A24: …, B03: … };" of a game file (read as text, so no game code runs).
 * @param {string} text @returns {string[]}
 */
export function cardsIn(text) {
  const body = text.split('export const CARDS = {')[1]?.split('\n};')[0] ?? '';
  return [...body.matchAll(/^ {2}(\w+):/gm)].map((m) => m[1]);
}

/** Every file below the repo root, without dot folders and node_modules. @param {string} dir @returns {string[]} */
export function filesIn(dir, base = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name.startsWith('.') || e.name === 'node_modules') return [];
    const full = join(dir, e.name);
    return e.isDirectory() ? filesIn(full, base) : [full.slice(base.length + 1).split('\\').join('/')];
  });
}

/** The index of this checkout. */
export function indexHere() {
  return buildIndex(filesIn(root), (path) => readFileSync(join(root, path), 'utf8'));
}

/** @param {PagesIndex} index */
export const toJson = (index) => `${JSON.stringify(index, null, 2)}\n`;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(join(root, 'pages.json'), toJson(indexHere()));
  console.log('pages.json written');
}
