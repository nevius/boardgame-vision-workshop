// @ts-check
// The Steps view (issue #103): the pictures of each stage of the vision pipeline, for the frame that ran last:
// camera → edges → found board → straightened → tiles. The engine blocks (engine/warp.js, engine/tiles.js) record
// their own stages, so every game gets the view without extra code; a game may add its own with engine.showStep.
// Nothing is recorded while the view is off, so it costs nothing then. Pure code: no canvas, works in Node tests.
//
//   engine.showStep('ink', inkImage);                                  // a picture of your own
//   engine.showStep('cells', board, { boxes: [{ x, y, width, height }] }); // with boxes drawn on it
//   engine.showStep('rules', card, { lines: ['hue 352° → red'] });     // with text under the large picture

/** @typedef {{ x: number, y: number }} Point */
/** @typedef {{ x: number, y: number, width: number, height: number }} Box */
/** @typedef {{ width: number, height: number, data: Uint8ClampedArray }} Picture  ImageData or the same fields */
/**
 * One stage. The page draws `quads` (outlines, the first one green) and `boxes` on top of the picture, and `lines`
 * (short text: what was measured, which rule or reference decided) under it when it is shown large.
 * @typedef {{ name: string, image: Picture, quads?: Point[][], boxes?: Box[], lines?: string[] }} Step
 */
/** @typedef {{ quads?: Point[][], boxes?: Box[], lines?: string[] }} Marks */
/** @typedef {{ label: string, score: number }} Ranked  a name and its cosine similarity (0..1) */
/**
 * One tile the few-shot recognition named (engine/fewshot.js), for the last stage "scores".
 * `top`: the best 3 names, best first; `label`: the name that won; `image`: the tile (classify only);
 * `backend`: 'GPU' or 'CPU' for the Image Embedder, null for own numbers (matchTile); `ms`: embed time of this tile.
 * @typedef {{ top: Ranked[], label: string, image?: Picture, backend: string | null, ms: number | null }} TileScore
 */

let on = false;
/** @type {Map<string, Step>} */
let current = new Map(); // the frame that runs now
/** @type {Step[]} */
let shown = [];          // the last finished frame
/** @type {TileScore[]} */
let currentScores = [];
/** @type {TileScore[]} */
let shownScores = [];
/** @type {Point[][] | null} */
let found = null;        // where this frame found the board or the cards (kept even while the view is off)

/** Turns the view on or off. Off forgets all pictures. @param {boolean} value */
export function setStepsOn(value) {
  on = value;
  current = new Map();
  shown = [];
  currentScores = [];
  shownScores = [];
}

/** True while the view is open (then the blocks record). */
export function stepsOn() {
  return on;
}

/** A new frame starts: its stages are collected from here on. */
export function startSteps() {
  current = new Map();
  currentScores = [];
  found = null;
}

/**
 * Where the last frame found its board (stage "found board": the first outline) or its cards (stage "found cards":
 * all outlines), in picture pixels; null when nothing was found. Kept even while the Steps view is off: the page
 * zooms a photo to it (ui/view-rules.js, owner 30.10.).
 * @returns {Point[][] | null}
 */
export function foundArea() {
  return found;
}

/**
 * Keeps the picture of one stage for this frame. The same name again replaces it (the last one wins),
 * but keeps its place in the order. `image` may be a function, so a costly picture is only made while on.
 * @param {string} name @param {Picture | (() => Picture)} image @param {Marks} [marks]
 */
export function recordStep(name, image, marks = {}) {
  if (name === 'found board' && marks.quads?.[0]) found = [marks.quads[0]];
  if (name === 'found cards' && marks.quads?.length) found = marks.quads;
  if (!on) return;
  const picture = typeof image === 'function' ? image() : image;
  if (!picture || !(picture.width > 0) || !(picture.height > 0)) return;
  current.set(name, { name, image: picture, ...marks });
}

/**
 * The frame is done: its stages become the ones shown. Returns them. A stage this frame did not record keeps
 * its last picture: on live video an anchored card (engine/anchor.js) is often only tracked, not read again,
 * and then only "camera" is new.
 */
export function finishSteps() {
  if (!on) return shown;
  const merged = new Map(shown.map((step) => [step.name, step]));
  for (const [name, step] of current) merged.set(name, step);
  shown = [...merged.values()];
  if (currentScores.length) shownScores = currentScores; // like a stage: a frame without tiles keeps the last

  return shown;
}

/** The stages shown now (the last picture of each), in the order they first ran. @returns {Step[]} */
export function getSteps() {
  return shown;
}

/** Keeps the scores of one tile for this frame (engine/fewshot.js calls it). @param {TileScore} entry */
export function recordScore(entry) {
  if (on) currentScores.push(entry);
}

/** The tiles of the last frame that had any, in the order they were named. @returns {TileScore[]} */
export function getScores() {
  return shownScores;
}

/**
 * For games (engine.showStep): show a picture of your own as a stage, e.g. the ink of a cell.
 * @param {string} name @param {Picture} image @param {Marks} [marks]
 */
export function showStep(name, image, marks) {
  recordStep(name, image, marks);
}

/**
 * A one-channel picture (an OpenCV mask: 0 = black, 255 = white) as RGBA pixels.
 * @param {ArrayLike<number>} gray @param {number} width @param {number} height @returns {Picture}
 */
export function grayToPicture(gray, width, height) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = gray[i];
    data[i * 4 + 3] = 255;
  }
  if (typeof ImageData !== 'undefined') return new ImageData(data, width, height);
  return { width, height, data };
}
