// @ts-check
// What a game shows around the picture, instead of drawing buttons or text on it (issue #73):
//   setActions([...])  small icon buttons at the bottom right (thumb zone), at most 4. `more: true` puts one in
//                      the ⋯ sheet instead (for rare actions, any number).
//   setInfo('A24 · roll 1–2 · solved')  one short line in a small chip in the top left corner of the picture.
//   setPip({ draw })   a small picture-in-picture box at the bottom left; tap it to make it big, tap again small.
// Each call replaces what the game set before; setActions([]), setInfo(''), setPip(null) remove it.
// The page shows them (app.js listens with onGameUi); a tap calls the game's onTap. Plain JS, no Preact here.
// Icon names: ui/icons.js (Lucide), e.g. 'dices', 'puzzle', 'box', 'layers', 'trash-2', 'check'.

/** @typedef {{ label: string, active?: boolean, color?: string, onTap: () => void }} Choice  one item in an action's list */
/**
 * @typedef {object} Action
 * @property {string} id
 * @property {string} icon      a name from ui/icons.js
 * @property {string} label     short text: shown under the icon the first time, and read out by screen readers
 * @property {() => void} [onTap]
 * @property {boolean} [active] lit (blue), e.g. while the 3D view is open
 * @property {string} [badge]   a tiny text on the icon, e.g. the die number or the layer '1'
 * @property {Choice[]} [choices] a tap opens this list next to the button (die numbers, pieces); a tap on an item calls its onTap
 * @property {boolean} [open]   the game keeps the list open (or closed with false); then a tap on the button calls onTap
 * @property {boolean} [more]   a rare action: a row in the ⋯ sheet instead of a button on the picture
 */
/**
 * @typedef {object} Pip  a small picture-in-picture box
 * @property {(ctx: CanvasRenderingContext2D, size: number) => void} draw  paints into a square canvas of `size` px
 * @property {string} label            for screen readers, e.g. 'Pieces in use'
 * @property {boolean} [turning]       draw again on every screen refresh (a turning model); off with reduced motion
 * @property {(dx: number) => void} [drag]  a finger moved across the big box: dx = part of its width (-1 … 1)
 */
/** @typedef {{ actions: Action[], info: string, pip: Pip | null }} GameUi */

/** At most this many actions sit on the picture; more are left out (with a warning in the Log). */
export const MAX_ACTIONS = 4;

/** @type {GameUi} */
const current = { actions: [], info: '', pip: null };
/** @type {((ui: GameUi) => void) | null} */
let listener = null;
const changed = () => listener?.({ ...current });

/** The game's actions: on the picture (at most 4) and `more: true` ones in the ⋯ sheet. @param {Action[]} actions */
export function setActions(actions) {
  const rail = actions.filter((a) => !a.more);
  if (rail.length > MAX_ACTIONS) console.warn(`setActions: only ${MAX_ACTIONS} buttons fit on the picture; left out: ${rail.slice(MAX_ACTIONS).map((a) => a.id).join(', ')}`);
  current.actions = [...rail.slice(0, MAX_ACTIONS), ...actions.filter((a) => a.more)];
  changed();
}

/** One short line in the corner chip ('' = no chip). @param {string} text */
export function setInfo(text) {
  if (text === current.info) return;
  current.info = text;
  changed();
}

/** The picture-in-picture box (null = none). @param {Pip | null} pip */
export function setPip(pip) {
  current.pip = pip;
  changed();
}

/** Removes everything a game set (the page calls this when the game changes). */
export function clearGameUi() {
  Object.assign(current, { actions: [], info: '', pip: null });
  changed();
}

/** What the game set, right now. @returns {GameUi} */
export function gameUi() {
  return { ...current };
}

/** For the page: called on every change. @param {(ui: GameUi) => void} fn */
export function onGameUi(fn) {
  listener = fn;
}
