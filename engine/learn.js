// @ts-check
// The learning-track checker's rules (issues #148, #149): one result per TODO, green or what is wrong.
// Shared by `pnpm learn <game>` (scripts/learn.js, Node) and "Check my game" in the app (ui/CheckPanel.js), so both
// give the same result. Pure: no DOM, no files; the caller opens the photos. Lessons: workshop/learn/<game>.md.
import { runGame, compareTruth } from './replay.js';

/**
 * One TODO's result. wrong: what failed, each with the photo it came from (when it came from one).
 * @typedef {{ todo: number, ok: boolean, text: string, name?: string, summary?: string, wrong?: { text: string, photo?: string }[] }} TodoResult
 */
/** @typedef {{ photo: string, cells: (string | null)[][], truth: any, state?: any, error?: string }} PhotoRead */

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

/**
 * The result in one shape: the first line "TODO n: <summary> ✓/✗", then up to 5 of the wrong lines.
 * @param {number} todo @param {string} summary @param {{ text: string, photo?: string }[]} wrong @param {boolean} ok
 * @returns {TodoResult}
 */
function result(todo, summary, wrong, ok) {
  const head = `TODO ${todo}: ${summary} ${wrong.length ? '✗' : '✓'}`;
  return { todo, ok, summary, wrong, text: [head, ...wrong.slice(0, 5).map((w) => `  ${w.text}`)].join('\n') };
}

// TODO 1 (Tic-Tac-Toe): every cell of every photo read as in its truth file.
/** @param {PhotoRead[]} reads @returns {TodoResult} */
export function checkCells(reads) {
  const wrong = [];
  let total = 0;
  for (const { photo, cells, truth } of reads) {
    /** @type {string[][]} */ (truth).forEach((row, r) => row.forEach((want, c) => {
      total++;
      const got = cells?.[r]?.[c];
      if (got !== want) wrong.push({ photo, text: `${photo} row ${r + 1} col ${c + 1}: read ${JSON.stringify(got ?? null)}, expected ${JSON.stringify(want)}` });
    }));
  }
  return result(1, `${total - wrong.length}/${total} cells`, wrong, total > 0 && wrong.length === 0);
}

// Positions for TODO 2. want: 'best' = any move as good as the best one; null = solve must return null.
/** @type {{ name: string, cells: (string | null)[][], want: 'best' | null }[]} */
export const POSITIONS = [
  { name: 'empty board', cells: [['', '', ''], ['', '', ''], ['', '', '']], want: 'best' },
  { name: 'X wins now', cells: [['X', 'X', ''], ['O', 'O', ''], ['', '', '']], want: 'best' },
  { name: 'O must block', cells: [['X', '', ''], ['', 'X', ''], ['O', '', '']], want: 'best' },
  { name: 'O to move after X in a corner', cells: [['X', '', ''], ['', '', ''], ['', '', '']], want: 'best' },
  { name: 'X has won', cells: [['X', 'X', 'X'], ['O', 'O', ''], ['', '', '']], want: null },
  { name: 'full board, draw', cells: [['X', 'O', 'X'], ['X', 'O', 'O'], ['O', 'X', 'X']], want: null },
  { name: 'a cell not read yet', cells: [['X', null, ''], ['', '', ''], ['', '', '']], want: null },
];

// TODO 2 (Tic-Tac-Toe): solve() returns a legal move for the right player that is as good as the best one.
/** @param {(state: any) => any} solve @param {PhotoRead[]} reads @returns {TodoResult} */
export function checkSolve(solve, reads = []) {
  const cases = [
    ...POSITIONS.map((p) => ({ ...p, photo: undefined })),
    ...reads.map((r) => ({ name: r.photo, photo: r.photo, cells: r.truth, want: /** @type {'best'} */ ('best') })),
  ];
  const wrong = [];
  for (const { name, photo, cells, want } of cases) {
    let move;
    try {
      move = solve({ corners: null, cells: cells.map((/** @type {any[]} */ row) => [...row]) });
    } catch (err) {
      wrong.push({ photo, text: `${name}: solve threw ${err.message}` });
      continue;
    }
    const problem = want === null ? (move === null ? '' : `expected null, got ${JSON.stringify(move)}`) : moveProblem(cells, move);
    if (problem) wrong.push({ photo, text: `${name}: ${problem}` });
  }
  return result(2, `${cases.length - wrong.length}/${cases.length} positions`, wrong, wrong.length === 0);
}

// '' when move is a best move for the player to move on cells, else what is wrong with it.
/** @param {(string | null)[][]} cells @param {any} move */
export function moveProblem(cells, move) {
  const flat = /** @type {string[]} */ (cells.flat());
  const player = flat.filter((m) => m === 'X').length === flat.filter((m) => m === 'O').length ? 'X' : 'O';
  if (!move) return `expected a move for ${player}, got ${JSON.stringify(move)}`;
  if (move.player !== player) return `player ${JSON.stringify(move.player)}, but ${player} is to move`;
  const i = move.row * 3 + move.col;
  if (!(move.row >= 0 && move.row < 3 && move.col >= 0 && move.col < 3) || flat[i] !== '') return `row ${move.row}, col ${move.col} is not an empty cell`;
  const score = (/** @type {number} */ j) => { flat[j] = player; const s = -value(flat, player === 'X' ? 'O' : 'X'); flat[j] = ''; return s; };
  const best = Math.max(...flat.flatMap((m, j) => (m === '' ? [score(j)] : [])));
  return score(i) >= best ? '' : `row ${move.row}, col ${move.col} is not the best move (${outcome(best)} is possible, this ${outcome(score(i))})`;
}

/** @param {number} s */
const outcome = (s) => (s > 0 ? 'a win' : s < 0 ? 'a loss' : 'a draw');

// Minimax value for the player to move: > 0 win, 0 draw, < 0 loss (only the sign is used for "best").
/** @param {string[]} flat @param {string} player @returns {number} */
function value(flat, player) {
  if (LINES.some(([a, b, c]) => flat[a] && flat[a] === flat[b] && flat[a] === flat[c])) return -1;
  let best = -Infinity;
  for (let i = 0; i < 9; i++) {
    if (flat[i] !== '') continue;
    flat[i] = player;
    best = Math.max(best, -value(flat, player === 'X' ? 'O' : 'X'));
    flat[i] = '';
  }
  return best === -Infinity ? 0 : best;
}

// A game without a track (no TODOs): one line, how many photos are read as in their truth file.
// compare: replay/<game>/check.js compareTruth when the game has one, else engine/replay.js compareTruth.
/** @param {PhotoRead[]} reads @param {(state: any, truth: any) => any} [compare] @returns {TodoResult[]} */
export function checkTruth(reads, compare = compareTruth) {
  const wrong = [];
  for (const { photo, state, truth, error } of reads) {
    if (error) { wrong.push({ photo, text: `${photo}: detect threw ${error}` }); continue; }
    const r = compare(state, truth);
    if (r.ok) continue;
    const cells = Array.isArray(r.wrong) && r.wrong[0]?.row !== undefined
      ? r.wrong.slice(0, 3).map((/** @type {any} */ w) => `row ${w.row + 1} col ${w.col + 1}: read ${JSON.stringify(w.read ?? null)}, expected ${JSON.stringify(w.truth)}`).join('; ')
      : Array.isArray(r.wrong) && r.wrong.length && typeof r.wrong[0] === 'string' ? `${r.wrong.join(', ')} differ`
        : r.score ? `${r.score.featuresRight}/${r.score.features} features right` : 'not as in the truth file';
    wrong.push({ photo, text: `${photo}: ${cells}` });
  }
  const res = result(1, `${reads.length - wrong.length}/${reads.length} photos`, wrong, reads.length > 0 && wrong.length === 0);
  return [{ ...res, todo: 0, name: 'Photos read as in their truth file', text: res.text.replace(/^TODO 1: /, 'Photos: ') }];
}

// Set TODO 1–4: one feature of every card, on photos where the done code found as many cards as the truth has.
// Cards are compared in reading order. A photo with a different card count is named but not counted (finding
// cards is done code, still being fixed in issue #124).
const PLURAL = { color: 'colours', number: 'numbers', shape: 'shapes', fill: 'fills' };
/** @param {number} todo @param {'color' | 'number' | 'shape' | 'fill'} feature @param {PhotoRead[]} reads @returns {TodoResult} */
export function checkFeature(todo, feature, reads) {
  const wrong = [];
  const notes = [];
  let total = 0;
  for (const { photo, state, truth, error } of reads) {
    if (error) { wrong.push({ photo, text: `${photo}: detect threw ${error}` }); continue; }
    const cards = state?.cards ?? [];
    if (cards.length !== truth.length) {
      notes.push(`${photo}: ${cards.length} of ${truth.length} cards found, not counted (finding cards is done code, #124)`);
      continue;
    }
    truth.forEach((/** @type {any} */ want, /** @type {number} */ i) => {
      total++;
      const got = cards[i][feature] ?? null;
      if (got !== want[feature]) wrong.push({ photo, text: `${photo} card ${i + 1}: read ${JSON.stringify(got)}, expected ${JSON.stringify(want[feature])}` });
    });
  }
  const r = result(todo, `${total - wrong.length}/${total} ${PLURAL[feature]}`, wrong, total > 0 && wrong.length === 0);
  return notes.length ? { ...r, text: [r.text, ...notes.map((n) => `  ${n}`)].join('\n') } : r;
}

const SET_FEATURES = ['color', 'number', 'shape', 'fill'];
/** @param {any} a @param {any} b @param {any} c */
function realSet(a, b, c) {
  return SET_FEATURES.every((f) => a[f] != null && b[f] != null && c[f] != null && new Set([a[f], b[f], c[f]]).size !== 2);
}
const card = (/** @type {number} */ number, /** @type {string} */ color, /** @type {string} */ shape, /** @type {string} */ fill) => ({ corners: [], color, number, shape, fill });

// Triples for Set TODO 5, each with the answer.
export const TRIPLES = [
  { name: 'all four features different', cards: [card(1, 'red', 'diamond', 'solid'), card(2, 'green', 'oval', 'striped'), card(3, 'purple', 'squiggle', 'empty')] },
  { name: 'three the same, number different', cards: [card(1, 'red', 'oval', 'solid'), card(2, 'red', 'oval', 'solid'), card(3, 'red', 'oval', 'solid')] },
  { name: 'shape: two ovals and a diamond', cards: [card(1, 'red', 'oval', 'solid'), card(2, 'green', 'oval', 'striped'), card(3, 'purple', 'diamond', 'empty')] },
  { name: 'colour: two red and a green', cards: [card(1, 'red', 'oval', 'solid'), card(1, 'red', 'diamond', 'solid'), card(1, 'green', 'squiggle', 'solid')] },
  { name: 'a feature not read (null)', cards: [card(1, 'red', 'oval', null), card(2, 'red', 'oval', null), card(3, 'red', 'oval', null)] },
].map((t) => ({ ...t, want: realSet(t.cards[0], t.cards[1], t.cards[2]) }));

// Set TODO 5: isSet(a, b, c) on fixed triples, then on every triple of cards of the photos' truth files.
/** @param {any} isSet @param {PhotoRead[]} reads @returns {TodoResult} */
export function checkIsSet(isSet, reads = []) {
  if (typeof isSet !== 'function') return result(5, '0 triples: export function isSet(a, b, c) is missing', [{ text: 'isSet is not exported' }], false);
  const cases = [...TRIPLES];
  for (const { photo, truth } of reads) {
    for (let i = 0; i < truth.length; i++) for (let j = i + 1; j < truth.length; j++) for (let k = j + 1; k < truth.length; k++) {
      const cards = [truth[i], truth[j], truth[k]];
      cases.push({ name: `${photo} cards ${i + 1}, ${j + 1}, ${k + 1}`, cards, want: realSet(cards[0], cards[1], cards[2]) });
    }
  }
  const wrong = [];
  for (const { name, cards, want } of cases) {
    let got;
    try { got = isSet(...cards.map((c) => ({ ...c }))); } catch (err) { wrong.push({ text: `${name}: isSet threw ${err.message}` }); continue; }
    if (Boolean(got) !== want) wrong.push({ text: `${name}: got ${JSON.stringify(got)}, expected ${want}` });
  }
  return result(5, `${cases.length - wrong.length}/${cases.length} triples`, wrong, wrong.length === 0);
}

/** @param {any[]} cards @returns {number[][]} */
function allSets(cards) {
  const sets = [];
  for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) for (let k = j + 1; k < cards.length; k++) {
    if (realSet(cards[i], cards[j], cards[k])) sets.push([i, j, k]);
  }
  return sets;
}
/** @param {any} move */
const setsKey = (move) => JSON.stringify((move?.sets ?? []).map((/** @type {number[]} */ s) => [...s].sort((a, b) => a - b)).sort((/** @type {number[]} */ a, /** @type {number[]} */ b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]));

// Boards for Set TODO 6 (the photos' truth files are added). want: every set, or null when there is none.
export const BOARDS = [
  { name: 'no cards', cards: [] },
  { name: 'three cards, no set', cards: TRIPLES[2].cards },
  { name: 'three cards, one set', cards: TRIPLES[0].cards },
  { name: 'a card not read yet', cards: [...TRIPLES[0].cards.slice(0, 2), card(3, 'purple', 'squiggle', null)] },
];

// Set TODO 6: solve(state) returns { sets } with every set (any order), or null when there is none.
/** @param {(state: any) => any} solve @param {PhotoRead[]} reads @returns {TodoResult} */
export function checkSets(solve, reads = []) {
  const cases = [...BOARDS, ...reads.map((r) => ({ name: r.photo, cards: r.truth.map((/** @type {any} */ c) => ({ corners: [], ...c })) }))];
  const wrong = [];
  for (const { name, cards } of cases) {
    const want = allSets(cards);
    let move;
    try { move = solve({ cards: cards.map((c) => ({ ...c })) }); } catch (err) { wrong.push({ text: `${name}: solve threw ${err.message}` }); continue; }
    if (!want.length) { if (move !== null) wrong.push({ text: `${name}: expected null (no set), got ${JSON.stringify(move)}` }); continue; }
    if (!Array.isArray(move?.sets)) { wrong.push({ text: `${name}: expected { sets: [...] } with ${want.length} set${want.length === 1 ? '' : 's'}, got ${JSON.stringify(move)}` }); continue; }
    if (setsKey(move) !== setsKey({ sets: want })) wrong.push({ text: `${name}: found ${move.sets.length} sets, expected ${want.length}: ${JSON.stringify(want)}` });
  }
  return result(6, `${cases.length - wrong.length}/${cases.length} boards`, wrong, wrong.length === 0);
}

// Set TODO 7: steady(state) on a row of live frames. Each case is a card far outside any picture (so it never meets
// a real card of the live camera); frames: its read in each frame; want: what steady must show after the last frame.
export const FRAME_CASES = [
  { name: 'the same read every frame', reads: Array(10).fill('red'), want: 'red' },
  { name: 'one wrong read after 9 good ones', reads: [...Array(9).fill('red'), 'green'], want: 'red' },
  { name: 'red and green take turns', reads: Array.from({ length: 10 }, (_, i) => (i % 2 ? 'green' : 'red')), want: null },
];
/** @param {any} steady @returns {TodoResult} */
export function checkSteady(steady) {
  if (typeof steady !== 'function') return result(7, '0 cases: export function steady(state) is missing', [{ text: 'steady is not exported' }], false);
  const wrong = [];
  FRAME_CASES.forEach(({ name, reads, want }, n) => {
    const at = 1e6 * (n + 1) + Math.round(Math.random() * 1e5); // a new place each time: no votes from an earlier check
    const corners = [{ x: at, y: at }, { x: at + 300, y: at }, { x: at + 300, y: at + 200 }, { x: at, y: at + 200 }];
    let shown;
    try {
      for (const color of reads) {
        const state = { cards: [{ corners, color, number: 2, shape: 'oval', fill: 'solid' }] };
        shown = steady(JSON.parse(JSON.stringify(state)));
      }
    } catch (err) { wrong.push({ text: `${name}: steady threw ${err.message}` }); return; }
    const c = shown?.cards?.[0];
    if (!c || shown.cards.length !== 1) wrong.push({ text: `${name}: expected 1 card back, got ${JSON.stringify(shown?.cards?.length ?? shown)}` });
    else if ((c.color ?? null) !== want) wrong.push({ text: `${name}: shows color ${JSON.stringify(c.color ?? null)}, expected ${JSON.stringify(want)}` });
    else if (c.number !== 2 || JSON.stringify(c.corners) !== JSON.stringify(corners)) wrong.push({ text: `${name}: the other features or the corners changed` });
  });
  return result(7, `${FRAME_CASES.length - wrong.length}/${FRAME_CASES.length} frame rows`, wrong, wrong.length === 0);
}

/** @param {any} code @param {PhotoRead[]} reads */
function checkSet(code, reads) {
  return [
    checkFeature(1, 'color', reads), checkFeature(2, 'number', reads), checkFeature(3, 'shape', reads), checkFeature(4, 'fill', reads),
    checkIsSet(code.isSet, reads), checkSets(code.solve, reads), checkSteady(code.steady),
  ];
}

/**
 * Each track: how many TODOs, their names (as in the lesson), the lesson file and how to check them.
 * photos (optional): only these sample photos are checked (paths as in samples.json / index.json).
 * @type {Record<string, { todos: number, names: string[], lesson: string, check: (code: any, reads: PhotoRead[]) => TodoResult[], photos?: string[] }>}
 */
export const TRACKS = {
  tictactoe: { todos: 2, names: ['X or O', 'best move'], lesson: 'workshop/learn/tictactoe.md', check: checkTicTacToe },
  // Set photos (owner, 30.10.): the 2 drawn photos and the 4 dark-table owner photos (issue #124). The white-desk
  // photos (issue #202) stay out: there the cards are found from their symbols, a step beyond this track.
  set: {
    todos: 7,
    names: ['colour', 'symbols (number)', 'shape', 'fill', 'is it a set', 'every set', 'steady labels'],
    lesson: 'workshop/learn/set.md',
    check: checkSet,
    photos: ['six-cards.jpg', 'twelve-cards.jpg', 'owner/deck-b-wide.jpg', 'owner/deck-a-wide.jpg', 'owner/deck-a-portrait.jpg', 'owner/deck-b-turned.jpg'],
  },
};

/**
 * The photos a game's check runs on: all of them, or only the track's photos (in the track's order).
 * Works on names (owner/a.jpg) and on URLs (replay/set/owner/a.jpg).
 * @param {string} game @param {string[]} photos @returns {string[]}
 */
export function checkedPhotos(game, photos) {
  const only = TRACKS[game]?.photos;
  if (!only) return photos;
  return only.flatMap((p) => photos.filter((name) => name === p || name.endsWith(`/${p}`)).slice(0, 1));
}

/** @param {any} code @param {PhotoRead[]} reads */
function checkTicTacToe(code, reads) {
  return [checkCells(reads), checkSolve(code.solve, reads)];
}

/**
 * The results for a game: its track's TODOs (with their names), or one line for a game without a track.
 * @param {string} game @param {any} code the game file @param {PhotoRead[]} reads @param {(state: any, truth: any) => any} [compare]
 * @returns {TodoResult[]}
 */
export function checkGame(game, code, reads, compare) {
  const track = TRACKS[game];
  if (!track) return checkTruth(reads, compare);
  return track.check(code, reads).map((r) => ({ ...r, name: track.names[r.todo - 1] }));
}

/**
 * Runs detect() of the game file on each photo that has a truth file. open(photo) gives the picture (ImageData-like)
 * and the truth, or null when the photo has none. onPhoto(i, n) is told before each photo (for the busy indicator).
 * A detect() that throws is kept as an empty read with its error.
 * @param {any} code @param {string[]} photos @param {(photo: string) => Promise<{ frame: any, truth: any } | null>} open
 * @param {any} engine @param {(i: number, n: number) => void | Promise<void>} [onPhoto]
 * @returns {Promise<PhotoRead[]>}
 */
export async function readPhotos(code, photos, open, engine, onPhoto = () => {}) {
  /** @type {PhotoRead[]} */
  const reads = [];
  for (const [i, photo] of photos.entries()) {
    await onPhoto(i, photos.length);
    const opened = await open(photo);
    if (!opened) continue;
    const name = photo.split('/').pop() ?? photo;
    try {
      const { state } = await runGame({ detect: code.detect, solve: () => null }, opened.frame, engine);
      reads.push({ photo: name, cells: state?.cells ?? [], state, truth: opened.truth });
    } catch (err) {
      reads.push({ photo: name, cells: [], state: null, truth: opened.truth, error: err.message });
    }
  }
  return reads;
}

// Keeps the first time each TODO went green. times: { [game]: { start, todo1?, todo2?, … } } (ISO dates).
/** @param {Record<string, Record<string, string>>} times @param {string} game @param {TodoResult[]} results @param {Date} now */
export function recordTimes(times, game, results, now) {
  const mine = { start: now.toISOString(), ...times[game] };
  for (const r of results) if (r.ok && !mine[`todo${r.todo}`]) mine[`todo${r.todo}`] = now.toISOString();
  return { ...times, [game]: mine };
}

// Lines for --times: minutes from the first run until each TODO first went green.
/** @param {Record<string, string> | undefined} mine @param {number} todos */
export function timesReport(mine, todos) {
  if (!mine) return ['No times yet: run the checker once.'];
  const start = Date.parse(mine.start);
  return Array.from({ length: todos }, (_, k) => {
    const at = mine[`todo${k + 1}`];
    return `TODO ${k + 1}: ${at ? `green after ${Math.round((Date.parse(at) - start) / 60000)} min` : 'not green yet'}`;
  });
}
