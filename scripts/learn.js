// @ts-check
// Learning-track checker (issue #148): one line per TODO, green or what is wrong. Lessons: workshop/learn/.
//
// Run:   pnpm learn tictactoe            check once
//        pnpm learn tictactoe --watch    check again on every save of games/tictactoe.js
//        pnpm learn tictactoe --times    minutes from the first run until each TODO first went green
//        add --solution to check solutions/<game>.js instead
// Times stay on this computer, in .learn-times.json (git ignores it). Nothing is uploaded.
import { readdirSync, readFileSync, writeFileSync, existsSync, watch } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { TRACKS, checkGame, checkedPhotos, readPhotos, recordTimes, timesReport } from '../engine/learn.js';

// The rules live in engine/learn.js (the app's "Check my game" uses the same ones, issue #149).
export { checkCells, checkSolve, moveProblem, recordTimes, timesReport, POSITIONS, TRACKS, checkedPhotos } from '../engine/learn.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const timesFile = join(root, '.learn-times.json');

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main(process.argv.slice(2));

/** @param {string[]} args */
async function main(args) {
  const game = args.find((a) => !a.startsWith('--')) ?? '';
  const track = TRACKS[game];
  if (!track) {
    console.error(`Usage: pnpm learn <${Object.keys(TRACKS).join('|')}> [--watch] [--times] [--solution]`);
    process.exit(2);
  }
  const times = existsSync(timesFile) ? JSON.parse(readFileSync(timesFile, 'utf8')) : {};
  if (args.includes('--times')) {
    console.log(timesReport(times[game], track.todos).join('\n'));
    return;
  }
  const file = join(root, args.includes('--solution') ? 'solutions' : 'games', `${game}.js`);
  let round = 0;
  const once = async () => {
    const results = await checkOnce(file, game, round++);
    const all = existsSync(timesFile) ? JSON.parse(readFileSync(timesFile, 'utf8')) : {};
    if (!args.includes('--solution')) writeFileSync(timesFile, JSON.stringify(recordTimes(all, game, results, new Date()), null, 2) + '\n');
    return results;
  };
  const results = await once();
  if (!args.includes('--watch')) process.exit(results.every((r) => r.ok) ? 0 : 1);
  console.log(`\nWatching ${file.slice(root.length + 1)}: save to check again (Ctrl+C stops).`);
  let timer;
  // Watch the folder, not the file: many editors save by writing a new file and renaming it.
  watch(dirname(file), (_, name) => {
    if (name !== basename(file)) return;
    clearTimeout(timer);
    timer = setTimeout(() => once().catch((err) => console.log(`Error: ${err.message}`)), 200);
  });
}

/** @param {string} file @param {string} game @param {number} round */
async function checkOnce(file, game, round) {
  const engine = await import('../engine/index.js');
  const { isPhoto, expectedName, photoNames } = await import('../engine/replay.js');
  let code;
  try {
    code = await import(`${pathToFileURL(file).href}?round=${round}`); // a new URL loads the saved file again
  } catch (err) {
    console.log(`Cannot load ${file.slice(root.length + 1)}: ${err.message}`);
    return [{ todo: 0, ok: false, text: '' }];
  }
  const folder = join(root, 'replay', game);
  const open = async (/** @type {string} */ photo) => {
    const truthFile = join(folder, expectedName(photo).replace(/\.json$/, '.truth.json'));
    if (!existsSync(truthFile)) return null;
    return { frame: await decode(join(folder, photo)), truth: JSON.parse(readFileSync(truthFile, 'utf8')) };
  };
  // The same photo list as the app (samples.json + index.json), so both give the same result.
  const list = (/** @type {string} */ f) => (existsSync(join(folder, f)) ? JSON.parse(readFileSync(join(folder, f), 'utf8')) : []);
  const all = photoNames(list('samples.json'), list('index.json'));
  for (const photo of readdirSync(folder).filter(isPhoto)) {
    if (!all.includes(photo)) console.log(`${photo} is not in index.json and not checked: run node replay/run.js ${game}`);
  }
  const names = checkedPhotos(game, all); // a track may check only some photos (engine/learn.js TRACKS)
  const reads = await readPhotos(code, names, open, engine);
  for (const r of reads) if (r.error) console.log(`${r.photo}: detect threw ${r.error}`);
  const results = checkGame(game, code, reads);
  console.log(`\n${new Date().toLocaleTimeString()}  ${file.slice(root.length + 1)}`);
  for (const r of results) console.log(r.text);
  return results;
}

// Photo file → { width, height, data } like the browser's ImageData (RGBA bytes).
/** @param {string} file */
async function decode(file) {
  const bytes = readFileSync(file);
  if (/\.png$/i.test(file)) {
    const { PNG } = (await import('pngjs')).default;
    const png = PNG.sync.read(bytes);
    return { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) };
  }
  const jpeg = (await import('jpeg-js')).default;
  const img = jpeg.decode(bytes, { useTArray: true, maxMemoryUsageInMB: 1024 });
  return { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data.buffer) };
}
