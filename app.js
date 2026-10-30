// @ts-check
// The page: picks the game from the URL hash (#set, #qwirkle, ...), loads games/<game>.js and runs
// detect → solve → draw on every picture: live camera frames, dropped photos, or photos from replay/<game>/.
// All pictures are ImageData and go through the same showFrame() below.
// Live camera: the <video> shows the picture; the canvas on top holds only the game's drawing. detect() runs on a
// smaller copy, a few times per second, and only when the picture changed (Speed setting, engine/speed.js).
// The buttons and layout are Preact components in ui/; this file holds the work and calls show() to redraw them.
// A game's own buttons, info chip and picture-in-picture box come from engine/actions.js (onGameUi below).
import { render, createRef } from 'preact';
import { html } from 'htm/preact';
import { App } from './ui/App.js';
import { games, defaultGame } from './games/list.js';
import { findSolutionGames, flagsFromHash, gameFromHash, solutionFromHash, solutionHash } from './engine/route.js';
import { drawHands } from './ui/HandLayer.js';
import { openCamera, closeCamera, resizeCamera, grabFrame, loadPhoto, savePhoto, photoName } from './engine/camera.js';
import { runGame, replayPhotos, isPhoto } from './engine/replay.js';
import * as engine from './engine/index.js';
import { captureConsole, logLines, clearLog, onLog } from './engine/debug.js';
import { benchReport, benchRows, benchText, recordFrame, recordStep, recordDetect, recordSpeed, resetBench, fpsOf } from './engine/bench.js';
import { speedSettings, analysisSize, mapPoint, rateLimiter, changeDetector, greyThumb, autoSwitch, detectNow, loadSpeed, saveSpeed, THUMB, IDLE_MS } from './engine/speed.js';
import { getManualCorners } from './engine/warp.js';
import { setTap } from './engine/details.js';
import { canvasPoint } from './engine/geometry.js';
import { setStepsOn, startSteps, finishSteps, getScores, foundArea, recordStep as recordPicture } from './engine/steps.js';
import { foundBox, zoomTo, pinch, viewCss, NONE } from './ui/view-rules.js';
import { gameTitle } from './ui/picker-rules.js';
import { listKnobs, setKnob, resetKnobs, useGameKnobs } from './engine/knobs.js';
import { readBrowser } from './engine/device.js';
import { startOffline, applyUpdate, clearCache } from './engine/offline.js';
import { onGameUi, clearGameUi, gameUi } from './engine/actions.js';
import { afterGameSwitch, switchKind } from './ui/switch-rules.js';
import { setAnchorLive, unlockAll, anchorStatus, onAnchor } from './engine/anchor.js';
import { SIZE_KEY, USE_KEY, countUse, readUse, toRemember } from './ui/sheet-rules.js';
import { HINT_KEY, HINTS, readSeen } from './ui/hint-rules.js';
import { foundSomething, READING, MOVE_DONE_MS } from './ui/mode-rules.js';
import { busy, currentBusy, onBusy, startBusy, nextPaint, latestWins } from './engine/busy.js';
import { TRACKS, checkGame, checkedPhotos, readPhotos } from './engine/learn.js';

captureConsole(); // first, so the Log panel sees everything after this line

// localStorage can throw (private mode, blocked storage): then nothing is remembered.
const storage = (() => { try { return globalThis.localStorage; } catch { return undefined; } })();
/** @param {string} key @returns {string | null} */
const storageGet = (key) => { try { return storage?.getItem(key) ?? null; } catch { return null; } };
let speed = loadSpeed(storage); // { choice: 'auto' | 'saver' | 'full', autoSaver }

/** @type {import('preact').RefObject<HTMLCanvasElement>} */
const canvasRef = createRef();
/** @type {import('preact').RefObject<HTMLVideoElement>} */
const videoRef = createRef();
/** @type {import('preact').RefObject<HTMLCanvasElement>} */
const handRef = createRef();

/** @type {import('./ui/CheckPanel.js').CheckView} */
const NO_CHECK = { file: '', running: false, results: null, lesson: '', note: '' };

/** @type {import('./ui/App.js').UiState} */
const ui = {
  games, game: defaultGame, solution: false, hasSolution: false, status: 'Loading…', statusId: 0, busy: currentBusy(), stateText: '', sheet: 'closed', sheetLast: storage?.getItem(SIZE_KEY) ?? 'half', sheetUse: {}, gameUi: gameUi(), panel: '', bench: null, log: [],
  fill: storage?.getItem('board-vision.fill') !== '0', speed: speed.choice, paused: '', locked: false, frozen: false,
  searching: true, hand: false, moveDone: false, photo: '',
  steps: false, stepOpen: '', stepList: [], stepScores: [], knobs: listKnobs(), live: false, hasPicture: false, hasReplay: false, canSave: false, canNext: false, canTap: false, manualCorners: false, cornerTaps: true, canHands: true, dragging: false, hints: readSeen(storageGet(HINT_KEY)),
  showHands: false, update: false, check: NO_CHECK, cameraHelp: null,
};

let name = defaultGame;
/** @type {import('./engine/types.js').Game | null} */
let game = null;
/** @type {ImageData | null} */
let lastFrame = null;  // the last picture shown, without the overlay (for "Save photo")
let live = false;      // true while the camera runs
let cameraRun = 0;     // counts camera starts, so an old frame loop stops for sure
/** @type {(File | string)[]} */
let photos = [];       // replay: Files or URLs
let photoIndex = 0;
let photoRun = 0;      // counts photo loads and game switches, so a slow photo for the game before is not shown
let switchRun = 0;     // counts game switches
/** @type {{ game: string, solution: boolean } | null} */
let loaded = null;     // the game file that runs: game name and solution key
let tapping = false;   // true while the player taps the board corners: the camera loop waits
/** @type {(() => void) | null} */
let stopHands = null;  // "hand gone = move done" is on while this is set (engine/hands.js)
let handsRun = 0;      // counts hand-watch starts, so an old one stops for sure
let detectNext = true; // with hands on: run detect() on the next camera frame
/** @type {ReturnType<typeof setTimeout> | undefined} */
let moveDoneTimer;     // ends "Move done · reading" in the mode chip (MOVE_DONE_MS)
let searching = true;  // nothing found since the last restart: detect() runs on every frame (restartSearch below)
let searchRun = 0;     // counts restarts, so a detect() that began before one cannot end the new search
// The photo zoom (resetView below). Up here: the first game switch runs before that part of the file (issue #201).
let view = NONE;
let zoomedFrame = /** @type {ImageData | null} */ (null); // the photo the zoom belongs to (a knob change keeps it)
/** @type {WakeLockSentinel | null} */
let wakeLock = null;   // keeps the screen on while the live camera runs (where the browser has it)
/** @type {{ state: any, move: any } | null} */
let lastResult = null; // the last { state, move }
/** @type {{ width: number, height: number } | null} */
let cornerSize = null; // the picture size the tapped corners belong to (they move along when it changes)
let limiter = rateLimiter(5);   // detect() per second (Speed setting)
let change = changeDetector();  // skips detect() while the picture stays the same
/** @type {number[]} */
let detectMs = [];              // last detect times on live video, for Auto's rule
/** @type {number[]} */
let shownAt = [];               // times of the last video frames, for Auto's rule
/** @type {string[]} */
let checkUrls = [];             // the sample photos of the last "Check my game" (for its "Open photo")

// Reads one photo and runs the game on it. Taps while one is read do not queue up: only the newest waits.
// run: photoRun when it was asked for; a game switch or a new photo list in between skips it.
const readPhoto = latestWins(async (/** @type {{ index: number, run: number }} */ { index, run }) => {
  if (run !== photoRun) return;
  const photo = photos[index];
  const label = typeof photo === 'string' ? photo.split('/').pop() : photo.name;
  restartSearch(); // a new photo is read from scratch
  show({ photo: `Photo ${index + 1}/${photos.length}`, status: `Photo ${index + 1}/${photos.length}: ${label}` });
  try {
    const frame = await loadPhoto(photo, `Reading photo ${index + 1} of ${photos.length}…`);
    if (run === photoRun) await showFrame(frame);
  } catch (err) {
    if (run === photoRun) show({ status: `Could not open ${label}: ${err.message}` });
  }
});

/** @param {number} seen */
function setHints(seen) {
  try { storage?.setItem(HINT_KEY, String(seen)); } catch { /* not remembered */ }
  show({ hints: seen });
}

const actions = {
  // Device cache (issue #136): "New version · reload" (next to the mode chip) and "Clear cache" in the ⋯ sheet.
  update: () => { applyUpdate(); },
  // Reload in the ⋯ sheet (issue #196: no F5 in the installed app): takes a waiting new version, then reloads.
  reload: () => { applyUpdate(); },
  clearCache: () => { clearCache().then(() => show({ status: 'Cache cleared. The next start downloads everything again.' })); },
  pick: (/** @type {string} */ value) => { location.hash = value; },
  // First-run hints (issue #152): a tap on the chip shows the next one; how many were seen is remembered.
  hint: () => { setHints(Math.min(ui.hints + 1, HINTS.length)); },
  hintsAgain: () => { setHints(0); show({ sheet: 'closed' }); },
  closeHelp: () => { show({ cameraHelp: null }); },
  // The small key in the ⋯ sheet: the same game again, finished version on or off.
  solution: () => { location.hash = solutionHash(name, !ui.solution); },
  camera: () => (live ? stopCamera() : startCamera()),
  // Live: the full camera picture (detect() gets a smaller one).
  save: () => (live ? savePhoto(grabFrame(video), photoName(name)) : lastFrame && savePhoto(lastFrame, photoName(name))),
  photos: (/** @type {File[]} */ files) => files.length > 0 && showPhotos(files),
  replay: async () => {
    show({ cameraHelp: null }); // "Use sample photos instead" in the camera help
    const urls = await busy('Finding sample photos…', () => replayPhotos(name)).catch(() => []);
    if (urls.length === 0) show({ status: `No photos in replay/${name}/ (see replay/README.md).` });
    else showPhotos(urls);
  },
  // Each tap moves on at once; while a photo is still being read, only the newest one waits (latest wins).
  next: () => {
    photoIndex = (photoIndex + 1) % photos.length;
    setTap(null); // the tapped tile was on the photo before
    show({ status: `Photo ${photoIndex + 1}/${photos.length}…` }); // feedback at once, also while one is read
    readPhoto({ index: photoIndex, run: photoRun });
  },
  corners: () => (ui.manualCorners ? forgetCorners() : tapCorners()),
  // The Steps view (engine/steps.js): small pictures of each stage of the last frame, over the picture.
  steps: async () => {
    setStepsOn(!ui.steps);
    show({ steps: !ui.steps, stepOpen: '', stepList: [], stepScores: [] });
    change.reset();
    detectNext = true;
    if (!live && lastFrame) await showFrame(lastFrame);
  },
  // A knob slider in the Steps view (engine/knobs.js): the new value, then the picture is read again.
  knob: (/** @type {string} */ knobName, /** @type {number} */ value) => {
    setKnob(knobName, value);
    knobsChanged();
  },
  resetKnobs: () => {
    resetKnobs();
    knobsChanged();
  },
  // A tab of the sheet: Controls, State, Benchmark or Log. The sheet stays as it is (a swipe up makes it taller).
  panel: (/** @type {'' | 'state' | 'bench' | 'log' | 'check'} */ name) => {
    show({ panel: name, bench: currentBench(), log: logLines() });
  },
  // The sheet's new height. An open height is remembered in this browser (More opens there next time).
  // On opening, the tiles are ordered by how often this game used them; they stay put while the sheet is open.
  sheet: (/** @type {import('./ui/sheet-rules.js').SheetSize} */ size) => {
    const keep = toRemember(size);
    if (keep) try { storage?.setItem(SIZE_KEY, keep); } catch { /* not remembered */ }
    const use = ui.sheet === 'closed' ? readUse(storageGet(USE_KEY))[ui.game] ?? {} : ui.sheetUse;
    show({ sheet: size, sheetLast: keep ?? ui.sheetLast, sheetUse: use });
  },
  // A tile in the sheet was tapped: one more use for this game (remembered in this browser).
  used: (/** @type {string} */ id) => {
    try { storage?.setItem(USE_KEY, countUse(storageGet(USE_KEY), ui.game, id)); } catch { /* not remembered */ }
  },
  // "Check my game" (issue #149): the sample photos through the game file that runs now, per TODO, the same rules as
  // `pnpm learn` (engine/learn.js). Opens the Check panel of the sheet; the busy indicator shows the progress.
  check: async () => {
    show({ panel: 'check', sheet: ui.sheet === 'full' ? 'full' : 'half' });
    if (!game || ui.check.running) return;
    if (live) stopCamera(); // the camera loop would run the same game file at the same time
    const code = game;
    const run = switchRun;
    const track = TRACKS[name];
    const lesson = track?.lesson ?? '';
    show({ check: { file: `${ui.solution ? 'solutions' : 'games'}/${name}.js`, running: true, results: null, lesson, note: '' } });
    const job = startBusy('Checking my game…');
    const corners = getManualCorners();
    engine.setManualCorners(null); // tapped corners belong to one picture; pnpm learn has none either
    try {
      const urls = checkedPhotos(name, await replayPhotos(name)); // the same photos as pnpm learn
      /** @type {(state: any, truth: any) => any} */
      let compare;
      if (!track) compare = (await import(`./replay/${name}/check.js`).catch(() => null))?.compareTruth;
      const open = async (/** @type {string} */ url) => {
        const response = await fetch(url.replace(/\.[^.]+$/, '.truth.json'), { cache: 'no-store' }).catch(() => null);
        if (!response?.ok) return null;
        const truth = await response.json();
        return { frame: await loadPhoto(url, `Checking ${url.split('/').pop()}…`), truth };
      };
      const onPhoto = async (/** @type {number} */ i, /** @type {number} */ n) => {
        job.label(`Checking photo ${i + 1} of ${n}…`);
        job.progress(i / n);
        await nextPaint(); // the page paints between photos, so it never looks stuck
      };
      const reads = await readPhotos(code, urls, open, engine, onPhoto);
      if (run !== switchRun) return;
      checkUrls = urls;
      const results = reads.length ? checkGame(name, code, reads, compare) : [];
      const note = reads.length ? '' : `No sample photo of ${name} has a truth file (replay/${name}/<photo>.truth.json).`;
      const green = results.filter((r) => r.ok).length;
      const word = results[0]?.todo === 0 ? 'checks' : 'TODOs';
      show({ check: { ...ui.check, running: false, results, note }, status: results.length ? `Check: ${green} of ${results.length} ${word} green.` : 'Check: no truth files.' });
    } catch (err) {
      if (run === switchRun) show({ check: { ...ui.check, running: false, note: `Check failed: ${err.message}` } });
      console.error(err);
    } finally {
      if (!getManualCorners()) engine.setManualCorners(corners);
      job.done();
    }
  },
  // "Open photo" in the Check panel: that sample photo, with the Steps view on, to see where it goes wrong.
  openChecked: (/** @type {string} */ photo) => {
    const index = checkUrls.findIndex((url) => url.split('/').pop() === photo);
    if (index < 0) return;
    if (!ui.steps) {
      setStepsOn(true);
      show({ steps: true, stepOpen: '', stepList: [], stepScores: [] });
    }
    show({ sheet: 'closed' });
    showPhotos(checkUrls, index);
  },
  // Copies the benchmark as plain text (to paste into a chat). Stays on the phone: only the clipboard.
  copyBench: () => {
    const { report, rows } = currentBench();
    if (!navigator.clipboard) return show({ status: 'Copy did not work here.' });
    navigator.clipboard.writeText(benchText(report, rows))
      .then(() => show({ status: 'Benchmark copied.' }), () => show({ status: 'Copy did not work here.' }));
  },
  resetBench: () => { resetBench(); show({ bench: currentBench() }); },
  clearLog: () => clearLog(),
  // Drop photos anywhere on the page.
  drop: (/** @type {File[]} */ files) => {
    const pictures = files.filter((f) => isPhoto(f.name) || f.type.startsWith('image/'));
    if (pictures.length > 0) showPhotos(pictures);
  },
  drag: (/** @type {boolean} */ on) => show({ dragging: on }),
  // The picture (camera or photo) fills the screen (cut on two sides) or fits whole. Remembered in this browser.
  fill: () => {
    try { storage?.setItem('board-vision.fill', ui.fill ? '0' : '1'); } catch { /* not remembered */ }
    show({ fill: !ui.fill, status: ui.fill ? hint('fit', 'Fit.', 'Fit: shows the whole picture, with dark bars at the sides.') : 'Fill screen.' });
  },
  // Speed: Auto · Saver · Full (engine/speed.js). Picking Auto again gives the phone a fresh try.
  speed: (/** @type {import('./engine/speed.js').SpeedChoice} */ choice) => {
    speed = { choice, autoSaver: choice === 'auto' ? false : speed.autoSaver };
    saveSpeed(storage, speed);
    applySpeed();
    show({ speed: choice, status: `Speed: ${choice}${live ? ` (${settings().mode})` : ''}.` });
  },
  // "Tap to continue" after the camera stopped by itself.
  resume: () => startCamera(),
  // Search again (issue #139): forget the anchored card or board (engine/anchor.js) and read the picture fresh.
  search: async () => {
    unlockAll();
    restartSearch();
    show({ locked: false, status: hint('search', 'Searching again.', 'Search again: forgets the locked board and reads the picture fresh.') });
    if (!live && lastFrame) await showFrame(lastFrame);
  },
  // The hand skeleton on the live picture (ui/HandLayer.js). The hand check runs either way; its status is in the mode chip.
  hands: () => {
    show({ showHands: !ui.showHands, status: ui.showHands ? 'Hands hidden.' : hint('hands', 'Hands shown.', 'Show hands: draws the hand the camera sees. The board is read only when no hand is over it.') });
    clearHands();
  },
  // Freeze picture: keep this picture, solve it in full size and show the result still. Tap again: live again.
  freeze: async () => {
    if (ui.frozen) return startCamera();
    if (!live || video.readyState < 2) return show({ status: 'The camera is not ready yet.' });
    const still = grabFrame(video);
    stopCamera();
    show({ frozen: true, status: hint('freeze', 'Frozen.', 'Frozen: the picture stands still, you can put the phone down. Tap ❄ again for live.') });
    await showFrame(still);
  },
};

// A restart of the search (issue #139): unlock, unfreeze, camera start, game switch, photo switch, Forget corners and
// Search again all come here. The next frame runs detect(), and every frame after it until something is found
// (engine/speed.js detectNow); the mode chip says "Looking for the board…" until then.
function restartSearch() {
  searchRun++;
  searching = true;
  detectNext = true;
  change.reset();
  show({ searching: true });
}

// The first time a button is used, its toast explains it in one line; after that, a short word (remembered).
/** @param {string} key @param {string} short @param {string} first */
function hint(key, short, first) {
  try {
    if (storage?.getItem(`board-vision.hint.${key}`) === '1') return short;
    storage?.setItem(`board-vision.hint.${key}`, '1');
  } catch { /* not remembered */ }
  return first;
}

// The Speed settings that run now, for this game (a game may ask for more: config.analysisSize, config.maxRate).
const settings = () => speedSettings(speed.choice, speed.autoSaver, game?.config);

// New Speed settings take effect: detect rate, camera resolution, hand checks.
function applySpeed() {
  limiter = rateLimiter(settings().rate);
  change.reset();
  detectMs = [];
  if (!live) return;
  resizeCamera(video, settings().camera);
  startHands();
}

// The page went to the background or the phone was locked: stop the camera (it is restarted with a tap).
document.addEventListener('visibilitychange', () => {
  if (document.hidden && live) pause('Paused while the page was in the background.');
});

// The benchmark numbers right now, each next to its target (engine/bench.js).
function currentBench() {
  const report = benchReport({
    device: readBrowser(navigator.userAgent), webgpu: 'gpu' in navigator, game: name, userAgent: navigator.userAgent,
  });
  return { report, rows: benchRows(report, game?.config.benchTargets) };
}

// Open tabs follow along: the log on every message, the benchmark once a second.
const showing = (/** @type {string} */ tab) => ui.sheet !== 'closed' && ui.panel === tab;
// The game's actions, info chip and picture-in-picture box (engine/actions.js).
onGameUi((gameUi) => show({ gameUi }));
onAnchor((locked) => show({ locked }));
onBusy((busy) => show({ busy })); // the busy indicator (ui/Busy.js)
onLog(() => { if (showing('log')) show({ log: logLines() }); });
setInterval(() => { if (showing('bench')) show({ bench: currentBench() }); }, 1000);

/** Changes what the page shows and redraws it. @param {Partial<import('./ui/App.js').UiState>} patch */
function show(patch) {
  if (patch.status !== undefined) patch = { ...patch, statusId: ui.statusId + 1 }; // a new toast
  Object.assign(ui, patch);
  render(html`<${App} ui=${ui} canvasRef=${canvasRef} videoRef=${videoRef} handRef=${handRef} actions=${actions} />`, document.getElementById('app'));
}

show({});
startOffline({ onUpdateReady: () => show({ update: true }) });
const canvas = canvasRef.current;
const video = videoRef.current;
const ctx = canvas.getContext('2d', { willReadFrequently: true });
// A tap on the picture (engine/details.js): the game shows the name of what is under it. Drawn again only for a
// game whose draw() asked for the tap; Tap corners and a game's own tap handler stay as they are.
canvas.addEventListener('pointerdown', (event) => {
  fingers.set(event.pointerId, fingerAt(event));
  if (fingers.size > 1) return; // a second finger: a pinch, not a tap
  if (tapping || !game || !lastResult) return;
  if (setTap(canvasPoint(event, canvas))) repaint();
});
// Pinch on a photo: two fingers zoom and move it (ui/view-rules.js).
canvas.addEventListener('pointermove', (event) => {
  if (!fingers.has(event.pointerId)) return;
  const before = [...fingers.values()];
  fingers.set(event.pointerId, fingerAt(event));
  if (fingers.size !== 2 || live || tapping) return;
  const after = [...fingers.values()];
  setView(pinch(view, /** @type {[any, any]} */ (before), /** @type {[any, any]} */ (after)));
});
for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
  canvas.addEventListener(type, (event) => { fingers.delete(/** @type {PointerEvent} */ (event).pointerId); });
}
// Which games have a file in solutions/ (none in a copy without that folder).
const solutionGames = await findSolutionGames(games, async (url) => (await fetch(url, { method: 'HEAD', cache: 'no-store' })).ok);
window.addEventListener('hashchange', start);
start();

async function start() {
  name = gameFromHash(location.hash, games, defaultGame);
  // Demo links (workshop/index.html): &hands=show turns the hand skeleton on; &replay or &camera starts below.
  const flags = flagsFromHash(location.hash);
  if (flags.hands && !ui.showHands) show({ showHands: true });
  // &steps=<stage> (the slides' ▶ buttons): the Steps view opens with that stage large once it is recorded.
  if (flags.steps !== null && !ui.steps) {
    setStepsOn(true);
    show({ steps: true, stepOpen: flags.steps, stepList: [], stepScores: [] });
  }
  // #<game>&solution: the finished version from solutions/ (for the workshop owner; not linked anywhere).
  const hasSolution = solutionGames.includes(name);
  const solution = hasSolution && solutionFromHash(location.hash);
  // Another game starts clean (#79). The solution key only swaps the game file: the picture stays (#88).
  const kind = switchKind(loaded, { game: name, solution });
  if (kind === 'none') return;
  loaded = { game: name, solution };
  const run = ++switchRun;
  show({ game: name, solution, hasSolution, check: NO_CHECK, cameraHelp: null, status: `Loading ${gameTitle(name)}${solution ? ' (solution)' : ''}…` });
  game = null;  // the camera loop waits until the new game is loaded (showFrame skips without a game)
  if (kind === 'game') {
    show({ hasReplay: false });
    resetPicture();
    unlockAll(); // an anchored card belongs to the game before
    setStepsOn(ui.steps); // the Steps pictures belong to the game before
    // The sheet's tile order belongs to the new game (the picker sits inside the open sheet).
    show({ stepList: [], stepScores: [], sheetUse: readUse(storageGet(USE_KEY))[name] ?? {} });
  } else {
    lastResult = null; // the answer came from the other file
  }
  let loadFailed = false; // set when the import itself fails (its error then shows in the mode chip)
  try {
    clearGameUi(); // the buttons and chip belong to the game file before
    const file = solution ? `./solutions/${name}.js` : `./games/${name}.js`;
    const load = () => import(file).catch((err) => { loadFailed = true; throw err; });
    game = await busy(`Loading ${gameTitle(name)}…`, load, { delay: 150 }); // the mode chip says "Loading <name>…"
    if (run !== switchRun) return; // the key was tapped again while this file loaded
    useGameKnobs(game.config.knobs); // this game's own knobs; all knobs back to their defaults
    show({ knobs: listKnobs() });
    delete canvas.dataset.drawnBy; // a game's own tap handler checks this, so it stays quiet after a switch
    // A game with config.cornerTaps = false finds its board itself: no "Tap corners", old taps forgotten.
    const cornerTaps = game.config.cornerTaps !== false;
    if (!cornerTaps && ui.manualCorners) engine.setManualCorners(null);
    show({ cornerTaps, manualCorners: cornerTaps && ui.manualCorners });
    show({ canHands: game.config.hands !== false }); // config.hands = false: no hand watching, no "Show hands"
    show({ status: `${game.config.title}${solution ? ' (solution)' : ''}: ready.` });
    restartSearch(); // the new game file searches from scratch
    if (live) applySpeed(); // this game's detect rate, and detect() runs on the next frame
    else if (kind === 'solution') await readAgain();
  } catch (err) {
    game = null;
    // A failed import already says "Loading <name> failed: …" in the mode chip (engine/busy.js): no second message.
    show({ status: loadFailed ? '' : `Could not load ${gameTitle(name)}: ${err.message}` });
    console.error(err);
  }
  if (kind !== 'game') return;
  // The empty screen offers the game's sample photos, when replay/<game>/ has some.
  const urls = await replayPhotos(name).catch(() => []);
  if (switchRun === run) show({ hasReplay: urls.length > 0 });
  if (switchRun === run && flags.replay && game && urls.length > 0) showPhotos(urls);
  else if (switchRun === run && flags.camera && game && !live) startCamera();
}

// A game switch starts clean (issue #79): the old game's photos, frozen picture, answer and drawing are gone.
// The live camera keeps running; else the new game starts on the empty screen.
function resetPicture() {
  resetView();
  setTap(null);
  photos = [];
  photoIndex = 0;
  photoRun++;   // a photo still loading for the game before is not shown
  show({ photo: '' });
  lastResult = null;
  lastFrame = null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  show(afterGameSwitch(live));
}

// The one pipeline: picture → detect → solve → draw.
// picture: false on live video, where the <video> shows the picture and the canvas only the drawing.
/** @param {ImageData} frame @param {boolean} [picture] */
async function showFrame(frame, picture = true) {
  if (!game) return;
  lastFrame = frame;
  if (picture) lastResult = null; // a tap while detect() runs must not draw the last photo's result on this one
  if (canvas.width !== frame.width || canvas.height !== frame.height) {
    canvas.width = frame.width;
    canvas.height = frame.height;
  }
  fitCorners(frame);
  if (picture) ctx.putImageData(frame, 0, 0);
  startSteps();
  recordPicture('camera', frame);
  const run = searchRun;
  // A photo or a still picture: "Reading the picture…" fades in when detect() takes longer than 150 ms, and the
  // page paints once first (the CSS fade-in runs even while detect() keeps the page busy). Live video: no label.
  // The mode chip says "Reading the picture…" at once (it reads this job, ui/mode-rules.js).
  const job = picture && !live ? startBusy(READING, { delay: 150 }) : null;
  if (job) await nextPaint();
  if (!game) return job?.done(); // the game was switched during that frame
  try {
    // Live video only: a game may smooth its state over the last frames (game.steady, see engine/types.js).
    const steady = live && game.steady ? game.steady : undefined;
    const { state, move } = await runGame(game, frame, engine, recordStep, steady);
    lastResult = { state, move };
    // Found → searching ends; lost again on live video → "Looking for the board…" and every frame again.
    if (run === searchRun) searching = !foundSomething(state);
    if (!picture) ctx.clearRect(0, 0, canvas.width, canvas.height); // the old drawing stays until the new one is ready
    // A lost anchored card fades out (engine/anchor.js).
    ctx.globalAlpha = live ? anchorStatus().opacity : 1;
    try { game.draw(ctx, state, move); } finally { ctx.globalAlpha = 1; }
    show({ stateText: JSON.stringify({ state, move }, null, 2), canTap: true, stepList: finishSteps(), stepScores: getScores(), searching });
    if (picture && !live && ui.photo && run === searchRun) zoomToFound(frame); // photos only, not a frozen camera picture
    job?.done();
  } catch (err) {
    job?.fail(`Error in ${name}: ${err.message}`);
    show({ stateText: `Error in ${name}: ${err.message}`, canTap: true, stepList: finishSteps(), stepScores: getScores() });
    console.error(err);
  }
}

// Owner 30.10.: a photo starts zoomed to what the game found (the board or the cards), the whole of it, as big as it
// fits (ui/view-rules.js). Nothing found: the whole photo. Two fingers then zoom and move it. The live camera is
// never zoomed. The zoom is a CSS transform on the picture, so canvasPoint still maps taps to the right pixel.
/** @param {import('./ui/view-rules.js').View} next */
function setView(next) {
  view = next;
  canvas.style.transformOrigin = '0 0';
  canvas.style.transform = live ? '' : viewCss(view);
}
/** @param {ImageData} frame */
function zoomToFound(frame) {
  if (zoomedFrame === frame) return; // the same photo again (knobs, Steps): keep what the player zoomed to
  zoomedFrame = frame;
  setView(zoomTo(foundBox(foundArea(), frame), frame, { width: canvas.clientWidth, height: canvas.clientHeight }));
}
function resetView() {
  zoomedFrame = null;
  setView(NONE);
}
/** @type {Map<number, { x: number, y: number }>} */
const fingers = new Map();
/** @param {PointerEvent} e */
const fingerAt = (e) => {
  const box = /** @type {HTMLElement} */ (canvas.parentElement).getBoundingClientRect();
  return { x: e.clientX - box.left, y: e.clientY - box.top };
};

// A knob moved: show the new values and run the pipeline again. Live: on the next camera frame. A photo or a
// frozen picture: right away; while a run is busy, once more after it (a slider sends many values).
let knobRun = false;
let knobAgain = false;
async function knobsChanged() {
  show({ knobs: listKnobs() });
  if (live) {
    change.reset();
    detectNext = true;
    return;
  }
  if (knobRun) {
    knobAgain = true;
    return;
  }
  knobRun = true;
  try {
    do {
      knobAgain = false;
      if (lastFrame) await showFrame(lastFrame);
    } while (knobAgain);
  } finally {
    knobRun = false;
  }
}

// After the solution key (not live): the new game file reads the picture on screen once.
// Photo, photo number, frozen picture and tapped corners stay as they were.
async function readAgain() {
  if (lastFrame) await showFrame(lastFrame);
}

// Tapped corners belong to one picture size. When detect() gets another size (Speed setting, a photo after
// the camera), they move along, so they stay on the same spot of the board.
/** @param {{ width: number, height: number }} frame */
function fitCorners(frame) {
  const corners = getManualCorners();
  if (!corners || !cornerSize || (cornerSize.width === frame.width && cornerSize.height === frame.height)) return;
  engine.setManualCorners(corners.map((/** @type {{ x: number, y: number }} */ p) => mapPoint(p, cornerSize, frame)));
  cornerSize = { width: frame.width, height: frame.height };
}

// Fallback when the board is not found: tap its four corners. engine.findBoard then returns them.
async function tapCorners() {
  if (!lastFrame || tapping) return;
  tapping = true;
  if (canvas.width !== lastFrame.width || canvas.height !== lastFrame.height) {
    canvas.width = lastFrame.width;
    canvas.height = lastFrame.height;
  }
  ctx.putImageData(lastFrame, 0, 0); // live: the picture stands still while you tap
  show({ status: 'Tap the four corners of the board.', canTap: false, sheet: 'closed' }); // the whole board free
  engine.setManualCorners(await engine.tapCorners(canvas));
  cornerSize = { width: canvas.width, height: canvas.height };
  restartSearch();
  show({ status: 'Using the tapped corners. "Forget corners" searches again.', manualCorners: true, canTap: true });
  tapping = false;
  if (!live) await showFrame(lastFrame);
}

async function forgetCorners() {
  engine.setManualCorners(null);
  restartSearch();
  show({ manualCorners: false });
  if (!live && lastFrame) await showFrame(lastFrame);
}

async function startCamera() {
  setTap(null);
  show({ status: 'Starting camera…', paused: '', cameraHelp: null });
  const job = startBusy('Starting camera…'); // the mode chip says "Starting camera…" until the picture comes
  try {
    await openCamera(video, settings().camera);
    job.done();
  } catch (err) {
    job.done();
    // The camera help panel (issue #153) has the steps for this phone; the mode chip says the short line.
    show({ status: err.help?.title ?? err.message, cameraHelp: err.help ?? null });
    return;
  }
  live = true;
  setAnchorLive(true);
  keepAwake();
  photos = [];
  lastResult = null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  restartSearch();
  applySpeed(); // also starts the hand check; until it is loaded, detect() runs whenever the picture changes
  resetView(); // the live camera is never zoomed
  show({ live: true, photo: '', hasPicture: true, frozen: false, canNext: false, canSave: true, status: `Camera on (${video.videoWidth}×${video.videoHeight}).` });
  // The video plays by itself. On each new video frame the loop decides if detect() runs:
  // at most `rate` times per second, only when the picture changed (or hands say a move is done).
  // The next frame waits until detect() is done, so a slow phone never stacks up work.
  const run = ++cameraRun;
  while (live && run === cameraRun) {
    await nextVideoFrame();
    if (!live || run !== cameraRun) break;
    recordFrame();
    shownAt.push(performance.now());
    if (shownAt.length > 31) shownAt.shift();
    if (!tapping && video.readyState >= 2) await liveFrame();
  }
}

// Resolves on the next video frame (requestVideoFrameCallback where the browser has it), else the next screen refresh.
// A stalled video (Safari stops frame callbacks at times, e.g. around fullscreen) must not stop the loop for good:
// after FRAME_WAIT_MS it goes on anyway and the old callback is cancelled.
const FRAME_WAIT_MS = 500;
function nextVideoFrame() {
  return new Promise((resolve) => {
    if (!('requestVideoFrameCallback' in video)) return requestAnimationFrame(() => resolve(undefined));
    const timer = setTimeout(() => { video.cancelVideoFrameCallback(id); resolve(undefined); }, FRAME_WAIT_MS);
    const id = video.requestVideoFrameCallback(() => { clearTimeout(timer); resolve(undefined); });
  });
}

// One video frame: maybe detect(). The drawing from the last detect() stays on the canvas in between.
async function liveFrame() {
  const now = performance.now();
  const mode = settings();
  if (!limiter.ready(now)) return;
  // A 64×48 grey thumbnail says if anything moved since the last change.
  const moving = change.update(greyThumb(grabFrame(video, THUMB.width, THUMB.height)), now);
  if (change.still(now) > IDLE_MS) return pause('Nothing changed for 2 minutes: camera off to save battery.');
  // Searching: every frame. Found: with the hand check on, detect() only after a move; else when the picture moved.
  // An anchored card (engine/anchor.js) is only tracked inside the game's detect(): cheap, so it may run each time.
  if (!detectNow({ searching: searching && !ui.hand, detectNext, hands: Boolean(stopHands), skip: mode.skip, moving, hasResult: Boolean(lastResult) })) return;
  detectNext = false;
  const size = analysisSize(video.videoWidth, video.videoHeight, mode.long);
  recordSpeed({ mode: mode.mode, analysis: `${size.width}×${size.height}` });
  const start = performance.now();
  await showFrame(grabFrame(video, size.width, size.height), false);
  recordDetect();
  detectMs.push(performance.now() - start);
  if (detectMs.length > 13) detectMs.shift();
  // Auto: a slow phone switches to Saver by itself and says so once. The first 3 runs load models: not counted.
  if (speed.choice === 'auto' && !speed.autoSaver && autoSwitch({ detectMs: detectMs.slice(3), screenFps: fpsOf(shownAt) })) {
    speed = { choice: 'auto', autoSaver: true };
    saveSpeed(storage, speed);
    applySpeed();
    show({ status: 'Saver mode on: your phone was getting slow.' });
  }
}

// The camera stops by itself (page hidden, nothing changed for long). "Tap to continue" starts it again.
/** @param {string} reason */
function pause(reason) {
  stopCamera();
  show({ paused: reason, status: reason });
}

// "Hand gone = move done": a hand over the board pauses detect(); when it is gone, detect() runs once.
// Off when the game sets config.hands = false. If the model cannot load, detect() runs on every frame.
async function startHands() {
  stopHands?.();
  stopHands = null;
  detectNext = true;
  const run = ++handsRun;
  if (!game || game.config.hands === false) return;
  try {
    const stop = await engine.watchHand(video, () => {
      detectNext = true;
      // The mode chip says "Move done · reading" for a moment, then the result (issue #145).
      clearTimeout(moveDoneTimer);
      show({ hand: false, moveDone: true });
      moveDoneTimer = setTimeout(() => show({ moveDone: false }), MOVE_DONE_MS);
    }, {
      onChange: (busy) => { // the mode chip says "Hand over board · paused"
        if (busy) { clearTimeout(moveDoneTimer); show({ hand: true, moveDone: false }); }
      },
      onHands: (hands) => {
        if (ui.showHands && handRef.current && run === handsRun) drawHands(handRef.current, hands, video.videoWidth, video.videoHeight);
      },
      fps: settings().hands,
    });
    if (live && run === handsRun) stopHands = stop;
    else stop();
  } catch (err) {
    if (run === handsRun) show({ status: `Hand check off (${err.message}). Reading every frame.` });
    console.error(err);
  }
}

// No hand on the layer (camera off, or "Show hands" switched).
function clearHands() {
  if (handRef.current) drawHands(handRef.current, [], handRef.current.width, handRef.current.height);
}

// The screen stays on while the live camera runs (Screen Wake Lock API; nothing happens where it is missing).
async function keepAwake() {
  try {
    const lock = await navigator.wakeLock?.request('screen');
    if (lock && live && !wakeLock) wakeLock = lock;
    else lock?.release();
  } catch { /* not allowed here (low battery, no user tap): the screen may turn off as before */ }
}

// Draws the last result again on the same picture (after a tap on it), without reading the picture again.
function repaint() {
  if (!game || !lastResult) return;
  if (live) ctx.clearRect(0, 0, canvas.width, canvas.height);
  else if (lastFrame && lastFrame.width === canvas.width && lastFrame.height === canvas.height) ctx.putImageData(lastFrame, 0, 0);
  else if (video.readyState >= 2) ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  else return;
  ctx.globalAlpha = live ? anchorStatus().opacity : 1;
  try { game.draw(ctx, lastResult.state, lastResult.move); } catch (err) { console.error(err); } finally { ctx.globalAlpha = 1; }
}

function stopCamera() {
  // Keep the last picture with the drawing on it, as with a photo (and in full size for Save photo, Tap corners).
  if (video.readyState >= 2 && game) {
    lastFrame = grabFrame(video);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    try { if (lastResult) game.draw(ctx, lastResult.state, lastResult.move); } catch (err) { console.error(err); }
  }
  live = false;
  setAnchorLive(false);
  stopHands?.();
  stopHands = null;
  handsRun++;
  clearHands();
  wakeLock?.release().catch(() => {});
  wakeLock = null;
  closeCamera(video);
  clearTimeout(moveDoneTimer);
  show({ live: false, locked: false, hand: false, moveDone: false, status: 'Camera off.' });
}

/** @param {(File | string)[]} list @param {number} [start] the photo to show first */
function showPhotos(list, start = 0) {
  setTap(null);
  if (live) stopCamera();
  if (ui.frozen) show({ frozen: false });
  photos = list;
  photoIndex = start;
  show({ canNext: photos.length > 1, canSave: true, hasPicture: true });
  readPhoto({ index: start, run: ++photoRun });
}
