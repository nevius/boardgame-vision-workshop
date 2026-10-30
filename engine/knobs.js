// @ts-check
// Knobs (issue #105): a few named numbers the engine blocks read instead of fixed constants, so you can turn them
// with sliders in the Steps view on the phone and watch a stage change live. Values live in memory only; a reload
// or "Reset" brings back the defaults. Pure code: works in Node tests.
//
//   const low = engine.knob('edgeLow');                          // read a knob (the current slider value)
//   export const config = { title: 'My game',                    // a knob of your own, in your game's config
//     knobs: [{ name: 'inkLimit', label: 'Ink limit', value: 0.2, min: 0, max: 1, step: 0.01 }] };

/**
 * One knob. `value` is the default; the slider goes from `min` to `max` in steps of `step`.
 * @typedef {{ name: string, label: string, value: number, min: number, max: number, step: number }} Knob
 */

/** The engine's own knobs, read by engine/warp.js. @type {Knob[]} */
export const ENGINE_KNOBS = [
  { name: 'edgeLow', label: 'Edges: low threshold', value: 40, min: 0, max: 255, step: 1 },
  { name: 'edgeHigh', label: 'Edges: high threshold', value: 120, min: 0, max: 255, step: 1 },
];

/** @type {Knob[]} */
let knobs = [...ENGINE_KNOBS];
/** @type {Map<string, number>} */
let values = new Map();

/** All knobs (engine first, then the game's), each with its current value as `value`. @returns {Knob[]} */
export function listKnobs() {
  return knobs.map((k) => ({ ...k, value: knob(k.name) }));
}

/** The current value of a knob (its default until a slider moves it). Throws for an unknown name. @param {string} name */
export function knob(name) {
  const found = knobs.find((k) => k.name === name);
  if (!found) throw new Error(`Unknown knob "${name}"`);
  return values.get(name) ?? found.value;
}

/** Sets a knob, kept between its min and max. Returns the value it got. @param {string} name @param {number} value */
export function setKnob(name, value) {
  const found = knobs.find((k) => k.name === name);
  if (!found || !Number.isFinite(value)) return found ? knob(name) : NaN;
  const kept = Math.min(found.max, Math.max(found.min, value));
  values.set(name, kept);
  return kept;
}

/** Every knob back to its default. */
export function resetKnobs() {
  values = new Map();
}

/**
 * The knobs of a game (config.knobs), after the engine's. Replaces the knobs of the game before and resets all
 * values. A game knob with an engine knob's name is skipped.
 * @param {Knob[]} [gameKnobs]
 */
export function useGameKnobs(gameKnobs = []) {
  const own = gameKnobs.filter((k) => k && typeof k.name === 'string' && !ENGINE_KNOBS.some((e) => e.name === k.name));
  knobs = [...ENGINE_KNOBS, ...own.map((k) => ({ step: 1, label: k.name, ...k }))];
  resetKnobs();
}
