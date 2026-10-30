// Photo replay: test a game on saved photos instead of the live camera.
// Photos live in replay/<game>/. index.json there lists them (node replay/run.js <game> keeps it up to date).
// Next to a photo, an optional <photo>.json holds the expected state.

// True for file names the replay accepts.
export function isPhoto(name) {
  return /\.(jpe?g|png)$/i.test(name);
}

// "board1.jpg" → "board1.json" (the expected state for that photo).
export function expectedName(photoName) {
  return photoName.replace(/\.[^.]+$/, '.json');
}

// True when two plain-JSON states are the same.
export function sameState(a, b) {
  return JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
}

// Compares cards read from a photo with the truth (both lists in reading order). Every key of a truth card
// is a feature (e.g. color, number). Returns { cards, cardsFound, features, featuresRight, wrong }; wrong
// lists the cards with a mistake: { card (position), read, truth }.
export function scoreCards(read, truth) {
  const score = { cards: truth.length, cardsFound: Math.min(read.length, truth.length), features: 0, featuresRight: 0, wrong: [] };
  truth.forEach((card, i) => {
    const keys = Object.keys(card);
    score.features += keys.length;
    const right = keys.filter((k) => read[i]?.[k] === card[k]).length;
    score.featuresRight += read.length === truth.length ? right : 0;
    if (right < keys.length) score.wrong.push({ card: i, read: read[i] && Object.fromEntries(keys.map((k) => [k, read[i][k]])), truth: card });
  });
  return score;
}

// Compares a state with the truth file of its photo. Returns { ok, score?, wrong? }:
// - a list of cards (objects): scoreCards on state.cards (card games, e.g. Set);
// - a grid (a list of rows): compared with the state key that holds rows of the same size (e.g. Sudoku's
//   grid, Tic-Tac-Toe's cells); wrong lists the cells that differ: { row, col, read, truth };
// - an object, e.g. {"grid": [...], "pieces": [...]}: only those keys are compared; wrong lists the keys that differ.
// A game whose truth fits none of these puts its own compareTruth(state, truth) in replay/<game>/check.js.
export function compareTruth(state, truth) {
  if (Array.isArray(truth) && truth.every(Array.isArray)) {
    const key = Object.keys(state ?? {}).find((k) => Array.isArray(state[k]) && state[k].length === truth.length && state[k].every(Array.isArray));
    const read = key ? state[key] : [];
    const wrong = truth.flatMap((row, r) => row.flatMap((cell, c) => (sameState(read[r]?.[c], cell) ? [] : [{ row: r, col: c, read: read[r]?.[c], truth: cell }])));
    return { ok: wrong.length === 0, wrong };
  }
  if (Array.isArray(truth)) {
    const score = scoreCards(state?.cards ?? [], truth);
    return { ok: score.cardsFound === score.cards && score.featuresRight === score.features, score };
  }
  const wrong = Object.keys(truth).filter((key) => !sameState(state?.[key], truth[key]));
  return { ok: wrong.length === 0, wrong };
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, sortKeys(value[k])]));
  }
  return value;
}

// Runs one frame through a game: detect → solve. Returns { state, move }. Used for live frames and photos.
// record(step, ms) is optional: the page passes engine/bench.js recordStep to time 'detect' and 'solve'.
// steady(state) is optional: on live video the page passes game.steady, which smooths the state over frames.
export async function runGame(game, frame, engine, record = (step, ms) => {}, steady = (state) => state) {
  let start = performance.now();
  const state = steady(await game.detect(frame, engine));
  record('detect', performance.now() - start);
  start = performance.now();
  const move = game.solve(state);
  record('solve', performance.now() - start);
  return { state, move };
}

// In the browser: the photo URLs listed in replay/<game>/index.json (empty list if there is none).
export async function replayPhotos(game, base = 'replay') {
  const list = async (/** @type {string} */ file) => {
    const response = await fetch(`${base}/${game}/${file}`, { cache: 'no-store' }).catch(() => null);
    return response?.ok ? /** @type {string[]} */ (await response.json()) : [];
  };
  // samples.json (optional, owner 30.10.): the real photos from sub-folders, shown first. index.json is kept by
  // replay/run.js for the folder itself.
  return photoNames(await list('samples.json'), await list('index.json')).map((name) => `${base}/${game}/${name}`);
}

// The sample photos of a game, from its samples.json and index.json lists (each name once). pnpm learn and the app's
// "Check my game" both use this, so they check the same photos (issue #149).
export function photoNames(samples, index) {
  return [...new Set([...samples, ...index])].filter(isPhoto);
}
