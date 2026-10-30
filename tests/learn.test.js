// @ts-check
// The learning-track checker (scripts/learn.js) and the lean starters of the tracks (issue #148).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkCells, checkSolve, moveProblem, recordTimes, timesReport, POSITIONS } from '../scripts/learn.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const truth = [['X', '', 'O'], ['', 'X', ''], ['', '', '']];

export function cellsAllRightIsGreen() {
  const r = checkCells([{ photo: 'a.jpg', cells: truth, truth }]);
  assert.equal(r.ok, true);
  assert.equal(r.text, 'TODO 1: 9/9 cells ✓');
}

export function cellsNamesPhotoAndCell() {
  const cells = [['X', '', null], ['', 'X', ''], ['', '', '']];
  const r = checkCells([{ photo: 'a.jpg', cells, truth }]);
  assert.equal(r.ok, false);
  assert.match(r.text, /^TODO 1: 8\/9 cells ✗\n {2}a\.jpg row 1 col 3: read null, expected "O"$/);
}

export function cellsWithoutBoardFail() {
  assert.equal(checkCells([{ photo: 'a.jpg', cells: [], truth }]).ok, false);
}

export function moveJudgeAcceptsOnlyBestMoves() {
  const cells = [['X', 'X', ''], ['O', 'O', ''], ['', '', '']];
  assert.equal(moveProblem(cells, { row: 0, col: 2, player: 'X' }), '');
  assert.match(moveProblem(cells, { row: 2, col: 2, player: 'X' }), /not the best move/);
  assert.match(moveProblem(cells, { row: 0, col: 0, player: 'X' }), /not an empty cell/);
  assert.match(moveProblem(cells, { row: 0, col: 2, player: 'O' }), /X is to move/);
  assert.equal(moveProblem([['', '', ''], ['', '', ''], ['', '', '']], { row: 0, col: 1, player: 'X' }), ''); // every opening draws
}

export function solveCheckStates() {
  assert.equal(checkSolve(() => null).ok, false);
  const throws = checkSolve(() => { throw new Error('boom'); });
  assert.match(throws.text, /solve threw boom/);
  const perfect = checkSolve(perfectSolve, [{ photo: 'a.jpg', cells: truth, truth }]);
  assert.equal(perfect.ok, true, perfect.text);
  assert.equal(perfect.text, `TODO 2: ${POSITIONS.length + 1}/${POSITIONS.length + 1} positions ✓`);
}

export function timesKeepFirstGreen() {
  const t0 = new Date('2026-10-29T10:00:00Z');
  const t1 = new Date('2026-10-29T10:12:00Z');
  const t2 = new Date('2026-10-29T10:30:00Z');
  let times = recordTimes({}, 'tictactoe', [{ todo: 1, ok: false, text: '' }], t0);
  times = recordTimes(times, 'tictactoe', [{ todo: 1, ok: true, text: '' }], t1);
  times = recordTimes(times, 'tictactoe', [{ todo: 1, ok: true, text: '' }, { todo: 2, ok: true, text: '' }], t2);
  assert.deepEqual(timesReport(times.tictactoe, 2), ['TODO 1: green after 12 min', 'TODO 2: green after 30 min']);
  assert.deepEqual(timesReport(undefined, 2), ['No times yet: run the checker once.']);
}

// The track starters stay lean: whole-line // comments at most 20 % of the non-blank lines.
export function trackStartersWithinCommentBudget() {
  for (const file of ['games/tictactoe.js', 'games/set.js']) {
    const lines = readFileSync(join(root, file), 'utf8').split('\n').filter((l) => l.trim());
    const share = lines.filter((l) => l.trim().startsWith('//')).length / lines.length;
    assert.ok(share <= 0.2, `${file}: ${Math.round(share * 100)} % comment lines, keep it at most 20 %`);
  }
}

// Each TODO in a track starter links its lesson section, and that section exists.
export function trackTodosLinkTheirLesson() {
  for (const [game, todos] of /** @type {[string, number][]} */ ([['tictactoe', 2], ['set', 7]])) {
    const code = readFileSync(join(root, `games/${game}.js`), 'utf8');
    const lesson = readFileSync(join(root, `workshop/learn/${game}.md`), 'utf8');
    for (let n = 1; n <= todos; n++) {
      assert.match(code, new RegExp(`// TODO ${n}: .*workshop/learn/${game}\\.md#todo-${n}`), `${game} TODO ${n}`);
      assert.ok(lesson.includes(`<a id="todo-${n}"></a>`), `${game}: lesson section todo-${n} missing`);
    }
  }
}

// A plain minimax player, only for the test above.
/** @param {{ cells: (string | null)[][] }} state */
function perfectSolve(state) {
  const flat = state.cells.flat();
  if (flat.includes(null)) return null;
  const player = flat.filter((m) => m === 'X').length === flat.filter((m) => m === 'O').length ? 'X' : 'O';
  const won = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]
    .some(([a, b, c]) => flat[a] && flat[a] === flat[b] && flat[a] === flat[c]);
  if (won) return null;
  for (let i = 0; i < 9; i++) {
    if (flat[i] !== '') continue;
    const move = { row: Math.floor(i / 3), col: i % 3, player };
    if (moveProblem(state.cells, move) === '') return move;
  }
  return null;
}

// "Check my game" (issue #149) and pnpm learn share engine/learn.js: same photos, same results.
export async function readPhotosRunsDetectOnPhotosWithTruth() {
  const { readPhotos, checkGame } = await import('../engine/learn.js');
  const code = {
    detect: (/** @type {any} */ frame) => { if (frame === 'bad') throw new Error('boom'); return { cells: frame }; },
    solve: perfectSolve,
  };
  const frames = { 'replay/tictactoe/a.jpg': truth, 'replay/tictactoe/b.jpg': 'bad' };
  const open = async (/** @type {string} */ url) => (url in frames ? { frame: frames[url], truth } : null);
  const seen = [];
  const reads = await readPhotos(code, ['replay/tictactoe/a.jpg', 'replay/tictactoe/b.jpg', 'replay/tictactoe/c.jpg'], open, {}, (i, n) => { seen.push(`${i}/${n}`); });
  assert.deepEqual(seen, ['0/3', '1/3', '2/3']);
  assert.deepEqual(reads.map((r) => [r.photo, r.error ?? '']), [['a.jpg', ''], ['b.jpg', 'boom']]);
  const [todo1, todo2] = checkGame('tictactoe', code, reads);
  assert.equal(todo1.name, 'X or O');
  assert.equal(todo1.ok, false);
  assert.equal(todo1.summary, '9/18 cells');
  assert.equal(todo1.wrong?.[0].photo, 'b.jpg');
  assert.equal(todo2.name, 'best move');
  assert.equal(todo2.ok, true, todo2.text);
}

// A game without a track: one line, photos read as in their truth file, with the failing photo named.
export async function gameWithoutTrackCountsPhotos() {
  const { checkGame } = await import('../engine/learn.js');
  const grid = [[1, 2], [3, 4]];
  const reads = [
    { photo: 'a.jpg', cells: [], state: { grid }, truth: grid },
    { photo: 'b.jpg', cells: [], state: { grid: [[1, 2], [3, 5]] }, truth: grid },
  ];
  const [r] = checkGame('sudoku', {}, reads);
  assert.equal(r.todo, 0);
  assert.equal(r.ok, false);
  assert.equal(r.summary, '1/2 photos');
  assert.deepEqual(r.wrong, [{ photo: 'b.jpg', text: 'b.jpg: row 2 col 2: read 5, expected 4' }]);
  assert.match(r.text, /^Photos: 1\/2 photos ✗/);
}

// The app shows the TODO names of every track, and each track's lesson exists.
export function everyTrackHasNamesAndLesson() {
  return import('../engine/learn.js').then(({ TRACKS }) => {
    for (const [game, t] of Object.entries(TRACKS)) {
      assert.equal(t.names.length, t.todos, game);
      assert.ok(readFileSync(join(root, t.lesson), 'utf8').includes('<a id="todo-1"></a>'), t.lesson);
    }
  });
}

// pnpm learn and the app check the same photos: samples.json first, then index.json, each once (issue #149).
export async function bothSidesUseOnePhotoList() {
  const { photoNames } = await import('../engine/replay.js');
  assert.deepEqual(photoNames(['owner/a.jpg', 'b.jpg'], ['b.jpg', 'c.png', 'notes.txt']), ['owner/a.jpg', 'b.jpg', 'c.png']);
  const learn = readFileSync(join(root, 'scripts/learn.js'), 'utf8');
  const app = readFileSync(join(root, 'app.js'), 'utf8');
  assert.match(learn, /photoNames\(/);
  assert.match(app, /replayPhotos\(name\)/);
}

// Set track (TODO 1–4): one feature per TODO, cards in reading order; a photo with a different card count is named,
// not counted (finding cards is done code, issue #124).
const setTruth = [
  { color: 'red', number: 1, shape: 'oval', fill: 'solid' },
  { color: 'green', number: 2, shape: 'diamond', fill: 'empty' },
];
export async function setFeatureCountsCardsAndSkipsMissedCards() {
  const { checkFeature } = await import('../engine/learn.js');
  const cards = setTruth.map((c) => ({ corners: [], ...c }));
  const ok = checkFeature(1, 'color', [{ photo: 'a.jpg', cells: [], state: { cards }, truth: setTruth }]);
  assert.equal(ok.text, 'TODO 1: 2/2 colours ✓');
  const wrong = checkFeature(3, 'shape', [
    { photo: 'a.jpg', cells: [], state: { cards: [cards[0], { ...cards[1], shape: null }] }, truth: setTruth },
    { photo: 'b.jpg', cells: [], state: { cards: [cards[0]] }, truth: setTruth },
  ]);
  assert.equal(wrong.ok, false);
  assert.match(wrong.text, /^TODO 3: 1\/2 shapes ✗\n {2}a\.jpg card 2: read null, expected "diamond"\n {2}b\.jpg: 1 of 2 cards found, not counted/);
  const none = checkFeature(2, 'number', [{ photo: 'b.jpg', cells: [], state: { cards: [] }, truth: setTruth }]);
  assert.equal(none.ok, false, 'no card counted is not green');
}

// Set TODO 5–7: isSet on triples, solve returns every set, steady keeps labels over frames.
export async function setLogicChecks() {
  const { checkIsSet, checkSets, checkSteady } = await import('../engine/learn.js');
  const reads = [{ photo: 'a.jpg', cells: [], truth: [...setTruth, { color: 'purple', number: 3, shape: 'squiggle', fill: 'striped' }] }];
  assert.equal(checkIsSet(undefined).ok, false);
  assert.match(checkIsSet(() => false).text, /all four features different: got false, expected true/);
  assert.equal(checkSets(() => null, reads).ok, false);
  assert.match(checkSets(() => ({ sets: [[0, 1, 2], [0, 1, 2]] }), reads).text, /found 2 sets, expected 1/);
  assert.match(checkSteady((/** @type {any} */ s) => s).text, /one wrong read after 9 good ones: shows color "green", expected "red"/);
  assert.equal(checkSteady(undefined).ok, false);
}

// The Set track checks only the photos the Set reader gets right today (owner, 30.10.), in names and in URLs.
export async function setTrackChecksOnlyItsPhotos() {
  const { checkedPhotos } = await import('../engine/learn.js');
  const names = ['owner/deck-b-wide.jpg', 'owner/deck-a-wide.jpg', 'owner-white/white-top.jpg', 'six-cards.jpg', 'twelve-cards.jpg'];
  // The dark-table owner photos are in (issue #124), the white desk is not yet (issue #202).
  assert.deepEqual(checkedPhotos('set', names), ['six-cards.jpg', 'twelve-cards.jpg', 'owner/deck-b-wide.jpg', 'owner/deck-a-wide.jpg']);
  assert.deepEqual(checkedPhotos('set', names.map((n) => `replay/set/${n}`)), ['replay/set/six-cards.jpg', 'replay/set/twelve-cards.jpg', 'replay/set/owner/deck-b-wide.jpg', 'replay/set/owner/deck-a-wide.jpg']);
  assert.deepEqual(checkedPhotos('sudoku', ['a.jpg']), ['a.jpg']);
}
