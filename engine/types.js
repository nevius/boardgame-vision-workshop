// @ts-check
// Types for the game contract, written as JSDoc so editors can give hints. There is no code here.
// A game file uses them like this:
//   /** @type {import('../engine/types.js').GameConfig} */
//   export const config = { title: 'My game' };

/**
 * Settings of a game. The page shows "title". A game may add its own fields.
 * @typedef {object} GameConfig
 * @property {string} title       Name shown on the page.
 * @property {boolean} [hands]    false turns off "hand gone = move done"; detect() then runs whenever the picture changes.
 * @property {boolean} [cornerTaps] false hides "Tap corners" (the game finds its board another way).
 * @property {number} [analysisSize] Live camera: long side (px) of the picture detect() gets, if the game needs
 *   more than the Speed setting gives (default 960, Saver 720). Photos always come in full size.
 * @property {number} [maxRate]   Live camera: detect() runs per second, if the game needs more (default 5, Saver 2).
 * @property {Record<string, number>} [benchTargets] Benchmark targets in ms for the game's own steps (recordStep),
 *   e.g. { 'ubongo pieces': 500 }, or to change a default ('detect default': 400). Defaults: engine/bench.js TARGETS.
 * @property {import('./knobs.js').Knob[]} [knobs] Numbers of your own with a slider in the Steps view (issue #105),
 *   e.g. [{ name: 'inkLimit', label: 'Ink limit', value: 0.2, min: 0, max: 1, step: 0.01 }]. Read with engine.knob('inkLimit').
 */

/**
 * The shared helpers a game gets as its "engine" argument (everything engine/index.js exports).
 * @typedef {typeof import('./index.js')} Engine
 */

/**
 * A picture: the camera frame or a photo. Same shape as the browser's ImageData.
 * @typedef {{ width: number, height: number, data: Uint8ClampedArray }} Frame
 */

/**
 * What a games/<game>.js file exports.
 * @typedef {object} Game
 * state and move must be plain JSON: objects, arrays, strings, numbers, true/false, null.
 * @property {GameConfig} config
 * @property {(frame: Frame, engine: Engine) => any} detect       Picture → state (plain JSON). May be async.
 * @property {(state: any) => any} solve                          State → move (plain JSON) or null.
 * @property {(ctx: CanvasRenderingContext2D, state: any, move: any) => void} draw  Paint the answer.
 * @property {(state: any) => any} [steady]  Optional, live video only: gets each detect() result and returns
 *   a steadier state (for example by votes over the last frames). detect() itself stays one frame.
 */

export {};
