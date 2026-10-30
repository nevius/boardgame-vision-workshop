// Replay runner: runs a game's detect() and solve() on every photo in replay/<game>/ and prints
// one JSON line per photo. Lets you (or your AI tool) check a change without a phone.
//
// Run:   pnpm install           (once, for the image decoders)
//        node replay/run.js <game>          e.g. node replay/run.js _blank
//        node replay/run.js set/test-images --solution   a sub-folder, with solutions/set.js instead of games/set.js
//
// Each line: {"photo": "...", "state": {...}, "move": ..., "check": "ok" | "differs" | "no expected state", "ms": ...}
// "check" compares with <photo>.json next to the photo, if there is one. Exit code 1 if any photo differs.
// Or a <photo>.truth.json with what is on the photo; each game is compared in its own way (compareTruth in
// engine/replay.js):
// - card games (a list of cards with their features, in reading order) add a "score": cards found / cards on
//   the photo, and features read right / all features;
// - grid games (a list of rows, e.g. Sudoku, Tic-Tac-Toe): "wrong" lists the cells that differ;
// - an object, e.g. {"grid": [...], "pieces": [...]}: only those keys of the state are compared; "wrong" lists
//   the keys that differ.
// A replay/<game>/check.js can add two things: compareTruth(state, truth) → { ok, score?, wrong? } for a truth
// that fits none of these (e.g. Qwirkle: board tiles plus the hand), and checkMove(state, move) to check the
// move too: "solution": "valid" or "not valid" (then check is "differs").
// Also keeps replay/<game>/index.json (the photo list the page reads) up to date.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isPhoto, expectedName, sameState, runGame, compareTruth } from '../engine/replay.js';
import * as engine from '../engine/index.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const where = args.find((a) => !a.startsWith('--'));
if (!where) {
  console.error('Usage: node replay/run.js <game>[/<sub-folder>] [--solution]   (e.g. _blank)');
  process.exit(2);
}
const game = where.split('/')[0];
const codeFolder = args.includes('--solution') ? 'solutions' : 'games';
const folder = join(root, 'replay', where);
if (!existsSync(folder)) {
  console.error(`No folder replay/${where}/. Put photos there first.`);
  process.exit(2);
}

const photos = readdirSync(folder).filter(isPhoto).sort();
updateIndex(photos);
const code = await import(pathToFileURL(join(root, codeFolder, `${game}.js`)).href);
const checkerFile = join(root, 'replay', game, 'check.js');
const checker = existsSync(checkerFile) ? await import(pathToFileURL(checkerFile).href) : null;
let differs = 0;

for (const photo of photos) {
  const frame = await decode(join(folder, photo));
  const start = performance.now();
  const { state, move } = await runGame(code, frame, engine);
  const ms = Math.round(performance.now() - start);
  const expectedFile = join(folder, expectedName(photo));
  const truthFile = expectedFile.replace(/\.json$/, '.truth.json');
  let check = 'no expected state';
  let score;
  let wrong;
  let solution;
  if (existsSync(expectedFile)) {
    check = sameState(state, JSON.parse(readFileSync(expectedFile, 'utf8'))) ? 'ok' : 'differs';
  } else if (existsSync(truthFile)) {
    const truth = JSON.parse(readFileSync(truthFile, 'utf8'));
    const result = (checker?.compareTruth ?? compareTruth)(state, truth);
    ({ score, wrong } = result);
    check = result.ok ? 'ok' : 'differs';
  }
  if (checker?.checkMove) {
    solution = checker.checkMove(state, move) ? 'valid' : 'not valid';
    if (solution !== 'valid' && check === 'ok') check = 'differs';
  }
  if (check === 'differs') differs++;
  console.log(JSON.stringify({ photo, state, move, check, score, wrong, solution, ms }));
}
if (photos.length === 0) console.error(`No photos (.jpg, .png) in replay/${where}/.`);
process.exit(differs > 0 ? 1 : 0);

// Photo file → { width, height, data } like the browser's ImageData (RGBA bytes).
async function decode(file) {
  const bytes = readFileSync(file);
  try {
    if (/\.png$/i.test(file)) {
      const { PNG } = (await import('pngjs')).default;
      const png = PNG.sync.read(bytes);
      return { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) };
    }
    const jpeg = (await import('jpeg-js')).default;
    const img = jpeg.decode(bytes, { useTArray: true, maxMemoryUsageInMB: 1024 });
    return { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data.buffer) };
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND') {
      console.error('Image decoders missing. Run "pnpm install" once, then try again.');
      process.exit(2);
    }
    throw err;
  }
}

function updateIndex(names) {
  const file = join(folder, 'index.json');
  const text = JSON.stringify(names, null, 2) + '\n';
  if (existsSync(file) && readFileSync(file, 'utf8') === text) return;
  writeFileSync(file, text);
  console.error(`Updated replay/${where}/index.json (${names.length} photos).`);
}
