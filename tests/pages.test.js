// @ts-check
// The "All pages" page (links.html, issues #172, #179): pages.json is current, every page has its one line, part 1
// (on this site) has every page and app address and no GitHub link, part 2 has the docs on github.com.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIndex, cardsIn, categoryOf, filesIn, indexHere } from '../scripts/pages-index.js';
import { demoEntries, githubBase, githubEntries, playEntries, siteSections } from '../links.js';
import { FLAGS, flagsFromHash } from '../engine/route.js';
import { games } from '../games/list.js';
import { CARDS } from '../games/ubongo.js';
import { DEMO, DEMOS } from '../workshop/launcher.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const committed = JSON.parse(readFileSync(join(root, 'pages.json'), 'utf8'));

export function pagesJsonIsCurrent() {
  const fresh = indexHere();
  assert.deepEqual(committed.pages, fresh.pages, 'pages.json is out of date: run `node scripts/pages-index.js` and commit pages.json');
  assert.deepEqual(committed.cards, fresh.cards, 'pages.json is out of date: run `node scripts/pages-index.js`');
  // The participant copy has no solutions/ on "main", but keeps the list (those links open the owner's demo).
  if (existsSync(join(root, 'solutions'))) assert.deepEqual(committed.solutions, fresh.solutions, 'pages.json is out of date: run `node scripts/pages-index.js`');
}

export function everyHtmlPageIsListedWithItsLine() {
  const html = filesIn(root).filter((f) => f.endsWith('.html') && f !== 'links.html');
  assert.ok(html.length >= 8);
  assert.deepEqual(html.filter((f) => !committed.pages.some((/** @type {any} */ p) => p.path === f)), []);
  for (const p of committed.pages) {
    assert.ok(p.title && p.about, p.path);
    assert.ok(existsSync(join(root, p.path)), `${p.path} is listed but missing`);
  }
}

export function aNewPageWithoutItsLineFails() {
  const files = ['index.html', 'new.html'];
  const read = (/** @type {string} */ f) => (f === 'new.html' ? '<title>x</title>' : '<title>board-vision</title><meta name="description" content="App">');
  assert.throws(() => buildIndex(files, read), /new\.html: no <meta name="description"/);
}

export function categoriesFromThePath() {
  assert.equal(categoryOf('index.html'), 'Play');
  assert.equal(categoryOf('workshop/slides.html'), 'Workshop');
  assert.equal(categoryOf('workshop/learn/tictactoe.md'), 'Workshop');
  assert.equal(categoryOf('check.html'), 'Workshop');
  assert.equal(categoryOf('warp.html'), 'Debug');
  assert.equal(categoryOf('README.md'), 'Docs');
  assert.equal(categoryOf('something-new.html'), 'Other');
  const where = Object.fromEntries(committed.pages.map((/** @type {any} */ p) => [p.path, p.category]));
  // shots.html is owner only: not in the participant copy.
  for (const page of ['warp.html', 'tiles.html', 'ubongo-pieces.html', 'shots.html']) if (existsSync(join(root, page))) assert.equal(where[page], 'Debug', page);
  for (const page of ['workshop/index.html', 'workshop/slides.html', 'print.html', 'check.html', 'workshop/tasks.md',
    'workshop/game-checklist.md', 'workshop/facilitator.md', 'workshop/learn/tictactoe.md']) assert.equal(where[page], 'Workshop', page);
  for (const page of ['README.md', 'engine/README.md', 'docs/ARCHITECTURE.md']) assert.equal(where[page], 'Docs', page);
}

export function playListsEveryGameAndItsFinishedVersion() {
  const local = playEntries(['_blank', 'set'], ['set'], [], true);
  assert.deepEqual(local.map((e) => e.href), ['./#_blank', './#set']);
  assert.deepEqual(local[1].modes?.map((m) => m.href), [...FLAGS.map((f) => `./#set&${f}`), './#set&solution', './#set&solution&replay']);
  // The participant copy: the finished version opens the owner's demo (marked), the starter stays here.
  const copy = playEntries(['set'], ['set'], [], false)[0].modes ?? [];
  assert.deepEqual(copy.filter((m) => m.demo).map((m) => m.href), [`${DEMO}#set&solution`, `${DEMO}#set&solution&replay`]);
  assert.ok(copy.filter((m) => !m.demo).every((m) => m.href.startsWith('./#set&')));
  // Ubongo gets one address per known card.
  assert.ok(playEntries(['ubongo'], [], ['A24'], true)[0].modes?.some((m) => m.href === './#ubongo&card=A24'));
}

export function demosAreTheLaunchersButtons() {
  assert.deepEqual(demoEntries(true).map((e) => e.href), DEMOS.map((d) => `./${d.hash}`));
  assert.deepEqual(demoEntries(false).map((e) => e.href), DEMOS.map((d) => `${DEMO}${d.hash}`));
  assert.ok(demoEntries(false).every((e) => e.demo));
}

// Issue #179: every flag documented in engine/route.js ("//   &name …") is in FLAGS (or is &card=, per card).
export function everyRouteFlagIsListed() {
  const documented = [...readFileSync(join(root, 'engine/route.js'), 'utf8').matchAll(/^\/\/ {3}&([\w-]+)/gm)].map((m) => m[1]);
  assert.ok(documented.length >= 5);
  const listed = [...FLAGS.map((f) => f.split('=')[0]), 'card'];
  assert.deepEqual(documented.filter((f) => !listed.includes(f)), []);
  for (const f of FLAGS) assert.notDeepEqual(flagsFromHash(`#set&${f}`), flagsFromHash('#set'), f);
  // The known cards in pages.json are the game's CARDS.
  assert.deepEqual(committed.cards, Object.keys(CARDS));
  assert.deepEqual(cardsIn('x\nexport const CARDS = {\n  A24: [],\n  B3: [[\n    "#"]],\n};\n'), ['A24', 'B3']);
}

// Issue #179: part 1 has every page and app address of this checkout, and nothing from GitHub.
export function onThisSiteCoversEveryPath() {
  for (const local of [true, false]) {
    const entries = siteSections(committed, games, local).flatMap(([, list]) => list.flatMap((e) => [e, ...(e.modes ?? [])]));
    const hrefs = entries.map((e) => e.href);
    assert.deepEqual(hrefs.filter((h) => /github\.com|\.md$/.test(h)), [], 'no GitHub link in part 1');
    assert.ok(entries.every((e) => e.path && (e.demo ? !local && e.href.startsWith(DEMO) : !e.href.startsWith('http'))));
    const shown = new Set(entries.map((e) => e.path.replace(DEMO, '')));
    const want = [
      ...filesIn(root).filter((f) => f.endsWith('.html') && f !== 'links.html'),
      ...games.flatMap((g) => [`#${g}`, ...FLAGS.map((f) => `#${g}&${f}`)]),
      ...committed.solutions.filter((g) => games.includes(g)).flatMap((g) => [`#${g}&solution`, `#${g}&solution&replay`]),
      ...Object.keys(CARDS).map((c) => `#ubongo&card=${c}`),
      ...DEMOS.map((d) => d.hash),
    ];
    assert.deepEqual(want.filter((p) => !shown.has(p)), [], `missing in part 1 (local ${local})`);
  }
}

// Issue #179: part 2 holds every Markdown page from pages.json, as github.com links, on both sites.
export function onGitHubHasTheDocs() {
  const md = committed.pages.filter((/** @type {any} */ p) => p.path.endsWith('.md')).map((/** @type {any} */ p) => p.path);
  assert.ok(md.includes('README.md') && md.includes('workshop/learn/tictactoe.md'));
  for (const here of ['https://jannistriestocode.github.io/board-vision/links.html', 'http://127.0.0.1:4000/links.html']) {
    const hrefs = githubEntries(committed, games, here).map((e) => e.href);
    assert.ok(hrefs.every((h) => h.startsWith('https://github.com/jannistriestocode/board-vision/blob/main/')), here);
    for (const p of md) assert.ok(hrefs.some((h) => h.endsWith(`/${p}`)), p);
  }
  assert.equal(githubBase('https://someone.github.io/my-workshop/links.html'), 'https://github.com/someone/my-workshop/blob/main/');
  // Collapsed by default: a <details> without "open".
  const code = readFileSync(join(root, 'links.js'), 'utf8');
  assert.match(code, /createElement\('details'\)/);
  assert.doesNotMatch(code, /\.open = true|<details open/);
}

export function theAppLinksToIt() {
  // Owner 30.10.: the game name with "All pages ›" at the top of More (the top of the screen stays free).
  assert.match(readFileSync(join(root, 'ui/Sheet.js'), 'utf8'), /href="links\.html"/);
  assert.doesNotMatch(readFileSync(join(root, 'ui/TopBar.js'), 'utf8'), /href="links\.html"/);
  assert.doesNotMatch(readFileSync(join(root, 'ui/App.js'), 'utf8'), /label: 'All pages'/, 'one way there: the link in the sheet');
  assert.match(readFileSync(join(root, 'workshop/index.html'), 'utf8'), /href="\.\.\/links\.html"/);
}
