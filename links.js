// @ts-check
// The "All pages" page (links.html, issues #172, #179). Two parts:
//   On this site: every *.html page and every app address (game × flag, finished versions, cards, the launcher's
//                 demos). Opens here, works offline once cached. No GitHub link.
//   On GitHub:    the Markdown docs, lessons and game source files. Needs internet; collapsed at the bottom.
// Pages come from pages.json (node scripts/pages-index.js builds it; a test keeps it current), games from
// games/list.js, flags from engine/route.js and demos from workshop/launcher.js, so nothing here is typed by hand.
// The pure part (which link each entry opens) is tested in tests/pages.test.js.
import { DEMO, DEMOS } from './workshop/launcher.js';
import { FLAGS } from './engine/route.js';

/**
 * One link. path: the exact address, shown in small mono text. demo: opens the owner's demo site.
 * modes: the smaller links under a game (its flags).
 * @typedef {{ title: string, about: string, href: string, path: string, demo?: boolean, modes?: Entry[] }} Entry
 */
/** @typedef {import('./scripts/pages-index.js').PagesIndex} PagesIndex */

/**
 * An app address. Finished versions need solutions/: without it on this site (the participant copy) they open the
 * owner's demo site (issue #125) and are marked as such.
 * @param {string} hash @param {boolean} finished @param {boolean} local
 * @returns {{ href: string, path: string, demo: boolean }}
 */
function route(hash, finished, local) {
  const demo = finished && !local;
  return { href: demo ? `${DEMO}${hash}` : `./${hash}`, path: demo ? `${DEMO}${hash}` : hash, demo };
}

/**
 * The Play entries: one per game (the starter), with every flag from engine/route.js under it, and where a finished
 * version exists, it and its replay photos. Ubongo also gets one address per known card.
 * @param {string[]} games @param {string[]} solutions @param {string[]} cards @param {boolean} local
 * @returns {Entry[]}
 */
export function playEntries(games, solutions, cards, local) {
  /** @param {string} title @param {string} hash @param {boolean} finished */
  const mode = (title, hash, finished = false) => ({ title, about: '', ...route(hash, finished, local) });
  return games.map((g) => ({
    title: g,
    about: g === '_blank' ? 'The empty starter: copy it for your own game' : 'Starter: the game file you edit',
    ...route(`#${g}`, false, local),
    modes: [
      ...FLAGS.map((f) => mode(f.split('=')[0], `#${g}&${f}`)),
      ...(g === 'ubongo' ? cards.map((c) => mode(`card ${c}`, `#${g}&card=${c}`)) : []),
      ...(solutions.includes(g) ? [mode('finished', `#${g}&solution`, true), mode('finished, replay', `#${g}&solution&replay`, true)] : []),
    ],
  }));
}

/** The launcher's demo buttons (they all use the finished games). @param {boolean} local @returns {Entry[]} */
export function demoEntries(local) {
  return DEMOS.map((d) => ({ title: d.label, about: d.about, ...route(d.hash, true, local) }));
}

/**
 * Part 1, "On this site": the HTML pages by category, the games and the demos. Markdown never goes here.
 * @param {PagesIndex} index @param {string[]} games @param {boolean} local
 * @returns {[string, Entry[]][]}
 */
export function siteSections(index, games, local) {
  /** @param {string} category @returns {Entry[]} */
  const pages = (category) => index.pages.filter((p) => p.category === category && p.path.endsWith('.html'))
    .map((p) => ({ title: p.title, about: p.about, href: p.path, path: p.path }));
  /** @type {[string, Entry[]][]} */
  const sections = [
    ['Play', [...pages('Play'), ...playEntries(games, index.solutions, index.cards, local)]],
    ['Workshop', pages('Workshop')],
    ['Demos', demoEntries(local)],
    ['Debug / tools', pages('Debug')],
    ['Other', [...pages('Docs'), ...pages('Other')]],
  ];
  return sections.filter(([, entries]) => entries.length);
}

/**
 * The GitHub address of this repo: from a GitHub Pages address (owner.github.io/repo/), else the owner's repo
 * (the demo site's, for a local server).
 * githubBase('https://owner.github.io/repo/links.html') → 'https://github.com/owner/repo/blob/main/'
 * @param {string} here the page's own address
 */
export function githubBase(here) {
  const m = here.match(/^https:\/\/([\w-]+)\.github\.io\/([\w.-]+)\//) ?? DEMO.match(/^https:\/\/([\w-]+)\.github\.io\/([\w.-]+)\//);
  return m ? `https://github.com/${m[1]}/${m[2]}/blob/main/` : '';
}

/**
 * Part 2, "On GitHub": every Markdown page from pages.json, then each game's source file.
 * @param {PagesIndex} index @param {string[]} games @param {string} here the page's own address
 * @returns {Entry[]}
 */
export function githubEntries(index, games, here) {
  const base = githubBase(here);
  return [
    ...index.pages.filter((p) => p.path.endsWith('.md')).map((p) => ({ title: p.title, about: p.about, path: p.path })),
    ...games.map((g) => ({ title: `games/${g}.js`, about: 'The game file (source code)', path: `games/${g}.js` })),
  ].map((e) => ({ ...e, href: `${base}${e.path}` }));
}

// ---------------------------------------------------------------- the page (browser only)

if (typeof document !== 'undefined' && document.getElementById('sections')) page();

/**
 * One link row: name, line, path in mono, an "owner demo" or "GitHub ↗" tag, and the smaller mode links.
 * @param {Entry} e @param {string} [tag]
 */
function row(e, tag) {
  const link = document.createElement('a');
  link.className = 'demo';
  link.href = e.href;
  const name = document.createElement('strong');
  name.textContent = e.title;
  const t = tag ?? (e.demo ? 'owner demo' : '');
  if (t) {
    const small = document.createElement('em');
    small.className = 'tag';
    small.textContent = t;
    name.append(' ', small);
  }
  link.append(name);
  if (e.about) link.append(Object.assign(document.createElement('span'), { textContent: e.about }));
  link.append(Object.assign(document.createElement('code'), { textContent: e.path }));
  if (!e.modes?.length) return [link];
  const modes = document.createElement('div');
  modes.className = 'modes';
  for (const m of e.modes) {
    const a = document.createElement('a');
    a.href = m.href;
    a.append(Object.assign(document.createElement('span'), { textContent: m.demo ? `${m.title} · owner demo` : m.title }));
    a.append(Object.assign(document.createElement('code'), { textContent: m.path }));
    modes.append(a);
  }
  return [link, modes];
}

async function page() {
  const main = /** @type {HTMLElement} */ (document.getElementById('sections'));
  const status = /** @type {HTMLElement} */ (document.getElementById('status'));
  try {
    const { games } = await import('./games/list.js');
    /** @type {PagesIndex} */
    const index = await fetch('pages.json', { cache: 'no-store' }).then((r) => r.json());
    const local = await fetch(`solutions/${index.solutions[0] ?? 'ubongo'}.js`, { method: 'HEAD', cache: 'no-store' }).then((r) => r.ok, () => false);
    status.remove();
    const site = document.createElement('h2');
    site.textContent = 'On this site';
    main.append(site, Object.assign(document.createElement('p'), { className: 'note', textContent: 'Opens here; works offline once loaded.' }));
    for (const [name, entries] of siteSections(index, games, local)) {
      const box = document.createElement('div');
      box.className = 'demos';
      for (const e of entries) box.append(...row(e));
      main.append(Object.assign(document.createElement('h3'), { textContent: name }), box);
    }
    // Part 2: collapsed, at the bottom.
    const github = document.createElement('details');
    github.className = 'github';
    github.innerHTML = '<summary>On GitHub ↗ <span>docs, lessons, source; opens github.com, needs internet</span></summary>';
    const box = document.createElement('div');
    box.className = 'demos';
    for (const e of githubEntries(index, games, location.href)) box.append(...row(e, 'GitHub ↗'));
    github.append(box);
    main.append(github);
  } catch (err) {
    status.textContent = `Could not load the list: ${err.message || err}`;
  }
}
