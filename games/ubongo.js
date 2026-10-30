// @ts-check
// Ubongo 3D, half done on purpose: you finish it in the workshop. The finished version is the owner's live demo.
// Lay one Ubongo puzzle card on the table and the needed pieces next to it (not on it). Open the page with #ubongo.
// Try it without a camera: "Sample photos" runs the pictures in replay/ubongo/, or  node replay/run.js ubongo
//
// What is done:  finding the card, its fields and the roll, reading the piece pictures and the pieces on the table,
//                drawing the solution on the card and in the 3D view.
// What is open:  TODO in solve(): the 2-layer solver. Until it is done the page reads everything and shows
//                "No solution with …". The replay check (node replay/run.js ubongo) then says "differs".
//
// The rules of Ubongo
//   The card shows a shape made of squares. Fill the shape exactly two layers high with the pieces shown on the
//   card (pieces are made of cubes): no gaps, no overlaps, nothing outside the shape or higher than two layers.
//   Pieces may be turned every way a solid can turn (24 ways). They cannot be mirrored (a real piece cannot be).
//
// The card
//   A real card (e.g. A24) has two fields, top and bottom, each with its own shape and groups of piece pictures.
//   The die roll picks the field and the pieces (LAYOUT below): A cards 1–2, 3–4 top, 5–7, 8–10 bottom;
//   B cards one group per number, 1–5 top, 6–10 bottom.
//
// How it works
// Built from the engine's building blocks (engine/README.md): cards, fields, color, pictures, pieces3d, cover,
// steady, iso and pick. This file keeps the Ubongo rules and the glue.
//
//   1. Card:   found by its red frame (engine/cards.js findColorFrame), else the largest four-sided shape (engine.findBoard). Straightened.
//   2. Fields: the light squares on the card (engine/fields.js), in one or two bands (top and bottom field). Per field the grid
//              (the thin lines between squares give the size of a square) and the groups of piece pictures
//              (their places and colours). Many pictures = a B card, few = an A card.
//   3. Pieces: coloured blobs on the table outside the card (white balanced with the card's light squares; blobs
//              that touch are split). Each blob is matched in 3D: every turn of every piece of its colour is drawn
//              the way the camera sees it (raised cubes sit further from the picture's middle) and the best match
//              wins, '?' when none is good enough (engine/pieces3d.js). On live video the list counts after
//              3 frames in a row (steady). Fallback: the puzzle icon (bottom right), then the pieces (tap again to remove one).
//      Card pictures: each piece picture on the card is read (engine/pictures.js, references in
//              games/ubongo.refs.json), so the roll alone gives
//              the pieces. An unsure picture shows '?': tap it, then the right piece of its colour (saved with the card).
//      Roll:   tap a group of piece pictures on the card (or the dice icon, then 1–10): the roll picks
//              field and pieces. A tap on the other field switches to it. Without a roll: the field with a group
//              whose colours match the pieces on the table, else the top field. Shown in the corner chip as
//              "A24 · roll 3 · top · solved".
//      Learn:  a card is known by the shapes of its two fields. The first time "Card looks right ✓" (in More) saves it in
//              this browser (localStorage, never in the repo); pieces tapped in the list are saved per roll with it,
//              and come back at once next time. "Forget card" (in More) removes it.
//   4. Solve:  TODO (see solve() below): fill the shape two layers high with the pieces (backtracking). Pure function.
//   5. Draw:   the solution in the piece colours on the card, one layer at a time (the "1 | 2" layers icon).
//              Nothing else is drawn on the picture (engine/actions.js): one line in the corner chip, the buttons as
//              icons at the bottom right (roll, pieces, 3D view, layer), rare ones in More (card looks right, fix, forget).
//              Picture-in-picture box (bottom left, tap to make it big): the pieces in use as small turning 3D models
//              with their names (T4, L4↑, …, legend in PIECES); with the 3D view on, the solution as cubes
//              (engine/iso.js): drag to turn, "Explode" slides the pieces apart, "Step" shows them one by one.
//
// The state (plain JSON) that detect() returns and solve() gets:
//   {
//     corners: [{ x, y }, ...] | null,   // the card in picture pixels (top-left, top-right, bottom-right, bottom-left)
//     area: { left, top, width, height }, // where the chosen field's grid lies on the straight card, shares (0 … 1)
//     grid: ['.##', '###'],               // '#' = a square to cover, '.' = not part of the shape
//     pieces: ['red2', 'green4'],         // names from PIECES (below), '?' = seen, not recognised
//     seen: ['red2', '?'],                // the pieces the camera saw on the table
//     tapped: false,                      // true when the pieces come from the tap bar (now or saved), not the camera
//     printed: true,                      // true when the pieces were read from the group's pictures on the card
//     card: 'A24' | null,                 // the card's name when its shapes are in CARDS
//     type: 'A' | 'B',                    // the kind of card (see LAYOUT)
//     print: '.#..,####,##..|###,###,#..', // the card's fingerprint (shapes of both fields), null without two fields
//     known: false,                       // true when this browser has learned the card (localStorage)
//     field: 'top' | 'bottom' | null,     // the field that grid and area belong to
//     roll: '1–2' | null,                 // the group of piece pictures that plays (null = none)
//     number: 3 | null,                   // the die number picked by a tap (null = chosen by the pieces)
//     fields: [{ name, grid, area, rolls: [{ roll: '1–2', box: { left, top, width, height }, colors: [...],
//               icons: [{ color, box, piece: 'red2', sure: true }] }] }],   // icons: each picture, read (issue #56)
//   }
//
// The move (plain JSON) that solve() returns and draw() gets:
//   { placements: [{ piece: 'red2', cells: [[layer, row, col], ...] }] }, or null when there is no solution.
//   layer 0 = bottom (on the card), layer 1 = top. row and col are the grid's.

import { boardPoint, orderCorners } from '../engine/geometry.js';
import { colorName } from '../engine/tiles.js';
import { recordStep } from '../engine/bench.js';
import { setActions, setInfo, setPip } from '../engine/actions.js';
import { isoPolygons, fitView, drawPolygons, explodeOffsets, placementCubes } from '../engine/iso.js';
import { findColorFrame } from '../engine/cards.js';
import { findFields } from '../engine/fields.js';
import { paperGains } from '../engine/color.js';
import { findPatches, groupNear, cutOut, rankByRefs, bestCombination, loadRefs } from '../engine/pictures.js';
import { findBlobs, splitBlob, nameBlobs, pieceCatalogue, tableCamera } from '../engine/pieces3d.js';
import { orientations, firstWorking } from '../engine/cover.js';
import { holdSteady } from '../engine/steady.js';
import { areaCorners, areaAt, canvasPoint } from '../engine/pick.js';
import { createAnchor } from '../engine/anchor.js';
import { flagsFromHash } from '../engine/route.js';

/** @typedef {{ x: number, y: number }} Point */
/** @typedef {import('../engine/types.js').Frame} Frame */
/** @typedef {{ left: number, top: number, width: number, height: number }} Area */
/** @typedef {{ name: string, grid: string[], area: Area | null, rolls: { roll: string, box: Area, colors: string[], icons?: GroupIcon[] }[] }} Field */
/**
 * @typedef {{ corners: Point[] | null, area: Area | null, grid: string[], pieces: string[], tapped: boolean,
 *   seen?: string[], options?: string[][], printed?: boolean, card?: string | null, type?: 'A' | 'B', print?: string | null, known?: boolean,
 *   field?: string | null, roll?: string | null, number?: number | null, fields?: Field[] }} UbongoState
 */
/** @typedef {{ placements: { piece: string, cells: number[][] }[] } | null} UbongoMove */

/** @type {import('../engine/types.js').GameConfig & { cellShare: number, frameColor: string }} */
export const config = {
  title: 'Ubongo 3D',
  // detect() on every frame: the card does not change when a hand leaves it.
  hands: false,
  // No "Tap corners": the roll picks the field (a tap on the card picks a roll or a field instead).
  cornerTaps: false,
  // Size of one square as a share of the card's width (the same on every Ubongo card; engine/fields.js).
  cellShare: 0.128,
  // Colour of the card's frame (colorName word). The card is found by it; without it, by its edges.
  frameColor: 'red',
};

// The shape is filled this many layers high.
export const LAYERS = 2;

// The pieces: the 16 real pieces in PIECES below (name → colour word and cubes as [layer, row, col]).
// The real green pieces look teal on camera; the card prints them light green (COLOR_ALIASES).

// Colour words that mean the same piece colour (see pieceColor).
const COLOR_ALIASES = { cyan: 'green' };

// Card names to show, by the grids of the top and bottom field. Only a name: any card plays, and cards are learned
// in the browser (loadCards), not listed here.
/** @type {Record<string, string[][]>} */
export const CARDS = {
  A24: [['.#..', '####', '##..'], ['###', '###', '#..']],
};

// ---------------------------------------------------------------- the pieces

// The 16 real Ubongo 3D pieces (issue #54): 4 per colour (blue, red, green, yellow). They never change.
// Read from the owner's photos in replay/ubongo/pieces/ (from above and at two angles).
//
// Each piece: colour word (engine colorName; the real green looks teal on camera), cubes as [layer, row, col]
// (layer 0 lies on the table, row grows down, col grows right, as the piece lies on the photo all-16-top.jpg),
// `confirmed` = the owner checked the shape on ubongo-pieces.html, and `photo` = where the piece lies on
// all-16-top.jpg (left, top, width, height in pixels) for that check page.
// Keys: colour + place on that photo, left to right (blue1 … blue4). They stay as they are: learned cards
// (localStorage) and replay files use them. People see `name` instead (issue #61).
//
// Names = one letter for the shape seen from above + the number of all cubes, ↑ = a cube sits on top:
//   I  a straight bar             L  a bar with a foot at one end (also a corner of 3)
//   J  an L turned over           T  a bar with a bump in the middle
//   S  a zigzag going down right  Z  a zigzag going down left
//   O  a 2 × 2 square             P  a 2 × 2 square with one more below
//   U  a cup: a bar with both ends bent the same way
// Example: L4↑ = a corner of 3 seen from above, 4 cubes, one cube on top. Pieces with the same name are told apart
// by their colour (the colour chip next to the name).

/** @typedef {{ color: string, name: string, cubes: number[][], confirmed: boolean, photo: number[], about: string }} Piece */

/** @type {Record<string, Piece>} */
export const PIECES = {
  blue1: { color: 'blue', name: 'S5↑', about: 'zigzag of 4, a cube on top of one end', confirmed: false, photo: [290, 280, 260, 400],
    cubes: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 1, 1], [0, 2, 1]] },
  blue2: { color: 'blue', name: 'L3', about: 'flat corner of 3', confirmed: false, photo: [655, 315, 240, 270],
    cubes: [[0, 0, 0], [0, 0, 1], [0, 1, 0]] },
  blue3: { color: 'blue', name: 'J5↑', about: 'bar of 3 with a foot, the foot 2 high', confirmed: false, photo: [945, 290, 235, 380],
    cubes: [[0, 0, 1], [0, 1, 1], [0, 2, 1], [0, 2, 0], [1, 2, 0]] },
  blue4: { color: 'blue', name: 'P5', about: 'flat P of 5', confirmed: false, photo: [1300, 310, 250, 330],
    cubes: [[0, 0, 0], [0, 1, 0], [0, 1, 1], [0, 2, 0], [0, 2, 1]] },
  red1: { color: 'red', name: 'S4', about: 'flat zigzag of 4', confirmed: false, photo: [285, 860, 270, 350],
    cubes: [[0, 0, 0], [0, 1, 0], [0, 1, 1], [0, 2, 1]] },
  red2: { color: 'red', name: 'O5↑', about: '2 × 2 slab, a cube on top of one corner', confirmed: true, photo: [685, 805, 250, 290],
    cubes: [[0, 0, 0], [0, 0, 1], [0, 1, 0], [0, 1, 1], [1, 0, 0]] },
  red3: { color: 'red', name: 'L4↑', about: 'flat corner of 3, a cube on top of one end', confirmed: false, photo: [1005, 820, 245, 255],
    cubes: [[0, 0, 0], [0, 0, 1], [0, 1, 0], [1, 1, 0]] },
  red4: { color: 'red', name: 'J5↑', about: 'J of 4, a cube on top of the long end', confirmed: false, photo: [1270, 795, 310, 375],
    cubes: [[0, 0, 1], [1, 0, 1], [0, 1, 1], [0, 2, 1], [0, 2, 0]] },
  green1: { color: 'green', name: 'Z5↑', about: 'zigzag of 4, a cube on top of one end', confirmed: false, photo: [285, 1315, 310, 360],
    cubes: [[0, 0, 1], [0, 1, 0], [0, 1, 1], [0, 2, 0], [1, 2, 0]] },
  green2: { color: 'green', name: 'L4', about: 'flat L of 4', confirmed: true, photo: [675, 1315, 245, 340],
    cubes: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 2, 1]] },
  green3: { color: 'green', name: 'T4', about: 'flat T of 4', confirmed: false, photo: [1050, 1270, 245, 345],
    cubes: [[0, 0, 1], [0, 1, 0], [0, 1, 1], [0, 2, 1]] },
  green4: { color: 'green', name: 'L5↑', about: 'bar of 3 with a foot, the foot 2 high', confirmed: true, photo: [1345, 1340, 310, 345],
    cubes: [[0, 0, 0], [0, 1, 0], [0, 2, 0], [0, 2, 1], [1, 2, 1]] },
  yellow1: { color: 'yellow', name: 'L5↑', about: 'L of 4, a cube on top of the long end', confirmed: false, photo: [310, 1835, 285, 380],
    cubes: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 2, 0], [0, 2, 1]] },
  yellow2: { color: 'yellow', name: 'T5↑', about: 'T of 4, a cube on top of one end of the bar', confirmed: false, photo: [695, 1850, 260, 400],
    cubes: [[0, 0, 0], [0, 1, 0], [0, 2, 0], [0, 1, 1], [1, 2, 0]] },
  yellow3: { color: 'yellow', name: 'U5', about: 'flat U of 5', confirmed: false, photo: [1045, 1850, 260, 350],
    cubes: [[0, 0, 0], [0, 0, 1], [0, 1, 0], [0, 2, 0], [0, 2, 1]] },
  yellow4: { color: 'yellow', name: 'L4↑', about: 'flat corner of 3, a cube on top of one end', confirmed: false, photo: [1405, 1960, 255, 245],
    cubes: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 1, 1]] },
};

// The colours in the order the tap bar and the check page show them.
export const COLORS = ['blue', 'red', 'green', 'yellow'];

// The letters the names use, for the legend above (a test checks every name uses one of them).
export const LETTERS = ['I', 'L', 'J', 'T', 'S', 'Z', 'O', 'P', 'U'];

// The name people see for a piece key, e.g. 'green3' → 'T4'. Unknown keys (like '?') stay as they are.
/** @param {string} key */
export function pieceName(key) {
  return PIECES[key]?.name ?? key;
}

// ---------------------------------------------------------------- the cards

// Ubongo 3D cards (issue #54): which die roll belongs to which field and piece group, the groups of piece
// pictures on a card, and cards learned in this browser (localStorage, never in the repo).
//
// Two kinds of cards:
//   A cards: 3 pieces per roll, two groups per field. Top field: 1–2 (left), 3–4 (right).
//            Bottom field: 5–7 (left), 8–10 (right).
//   B cards: 4 pieces per roll, one group per number (2 × 2 pictures around the number). 1–5 top, 6–10 bottom.
//            The groups are numbered in reading order (row by row, left to right).
// A card is known by the shapes of its two fields (its fingerprint), so anyone can learn new cards.

/** @typedef {{ color: string, box: number[] }} Icon  box: [x0, y0, x1, y1] in pixels of the straight card */
/** @typedef {{ type: 'A' | 'B', confirmed: boolean, pieces: Record<string, string[]> }} LearnedCard */
/** @typedef {{ color: string, box: Area, piece?: string, sure?: boolean }} GroupIcon  piece: read from the picture (readPictures) */

// The group labels per card type and field, in the order the groups lie on the card.
export const LAYOUT = {
  A: { top: ['1–2', '3–4'], bottom: ['5–7', '8–10'] },
  B: { top: ['1', '2', '3', '4', '5'], bottom: ['6', '7', '8', '9', '10'] },
};

// Die number 1–10 → the field it plays on.
/** @param {'A' | 'B'} type @param {number} roll @returns {'top' | 'bottom'} */
export function fieldOfRoll(type, roll) {
  return roll <= (type === 'B' ? 5 : 4) ? 'top' : 'bottom';
}

// Die number 1–10 → its group label ('5–7' on an A card, '7' on a B card).
/** @param {'A' | 'B'} type @param {number} roll */
export function groupOfRoll(type, roll) {
  const { top, bottom } = LAYOUT[type];
  return [...top, ...bottom].find((label) => {
    const [from, to = from] = label.split('–').map(Number);
    return roll >= from && roll <= to;
  }) ?? null;
}

// A group label → the first die number in it ('5–7' → 5).
/** @param {string} label */
export const firstRoll = (label) => parseInt(label, 10);

// More than this many piece pictures on the whole card: a B card (40 pictures), else an A card (12).
const B_ICONS = 24;

/** @param {Icon[]} icons @returns {'A' | 'B'} */
export const cardType = (icons) => (icons.length > B_ICONS ? 'B' : 'A');

/**
 * The piece pictures of one field → its groups, each with its label, box (shares of the card) and colours.
 * Pictures close together form a group (engine/pictures.js groupNear), as many groups as the layout has.
 * @param {Icon[]} icons
 * @param {'A' | 'B'} type
 * @param {'top' | 'bottom'} field
 * @param {{ width: number, height: number }} size the straight card in pixels
 * @returns {{ roll: string, box: Area, colors: string[], icons: GroupIcon[] }[]}
 */
export function groupIcons(icons, type, field, size) {
  const labels = LAYOUT[type][field];
  const groups = groupNear(icons, labels.length).map((g) => ({ box: g.box, colors: g.items.map((i) => i.color), icons: g.items }));
  /** @param {number[]} b @returns {Area} */
  const share = (b) => ({ left: round(b[0] / size.width), top: round(b[1] / size.height), width: round((b[2] - b[0]) / size.width), height: round((b[3] - b[1]) / size.height) });
  return groups.map((g, k) => ({
    roll: labels[k],
    box: share(g.box),
    colors: g.colors.sort(),
    // The pictures in the order of colors (then left to right), each with its box.
    icons: g.icons.sort((a, b) => (a.color < b.color ? -1 : a.color > b.color ? 1 : a.box[0] - b.box[0]))
      .map((i) => ({ color: i.color, box: share(i.box) })),
  })).filter((g) => g.roll);
}

const round = (n) => Math.round(n * 1000) / 1000;

// A card's fingerprint: the shapes of its fields, e.g. ".#..,####,##..|###,###,#..". Null without two fields.
/** @param {{ grid: string[] }[]} fields */
export function fingerprint(fields) {
  return fields.length === 2 ? fields.map((f) => f.grid.join(',')).join('|') : null;
}

// A card from CARDS that counts as confirmed without "Card looks right ✓": the launcher's #ubongo&card=A24
// (issue #133, engine/route.js). Added to the learned cards, not saved unless you edit its pieces. An unknown name changes nothing.
/** @param {string | null} name @param {Record<string, LearnedCard>} [learned] @returns {Record<string, LearnedCard>} */
export function presetCards(name, learned = {}) {
  const shapes = name ? CARDS[name] : undefined;
  if (!shapes) return learned;
  const print = shapes.map((grid) => grid.join(',')).join('|');
  const type = name.startsWith('B') ? 'B' : 'A';
  return { ...learned, [print]: { type, pieces: {}, ...learned[print], confirmed: true } };
}

// ---------------------------------------------------------------- learned cards (this browser only)

const KEY = 'ubongo-cards';

// The browser's localStorage, or null (Node, private mode, blocked storage).
/** @returns {Storage | null} */
function browserStore() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

// All learned cards: fingerprint → { type, confirmed, pieces: { '1–2': ['red2', …] } }. {} when nothing is
// saved or the storage cannot be read.
/** @param {Pick<Storage, 'getItem'> | null} [store] @returns {Record<string, LearnedCard>} */
export function loadCards(store = browserStore()) {
  try {
    const cards = JSON.parse(store?.getItem(KEY) ?? '{}');
    return cards && typeof cards === 'object' && !Array.isArray(cards) ? cards : {};
  } catch {
    return {};
  }
}

// Saves (or with card = null forgets) one card. Returns false when the storage cannot be written.
/** @param {string} print @param {LearnedCard | null} card @param {Pick<Storage, 'getItem' | 'setItem'> | null} [store] */
export function saveCard(print, card, store = browserStore()) {
  try {
    if (!store) return false;
    const cards = loadCards(store);
    if (card) cards[print] = card;
    else delete cards[print];
    store.setItem(KEY, JSON.stringify(cards));
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- the piece pictures on the card

// Read the small piece pictures printed on a card (issue #56), so the die roll alone gives the pieces
// (engine/pictures.js does the cutting out and matching):
//   1. Cut-out: each picture (found by findIcons) is cut from a bigger straight card: the pixels of its colour.
//   2. Colour first: only the 4 pieces of the picture's colour are candidates.
//   3. Shape: each candidate's reference cut-outs (games/ubongo.refs.json, one per drawing seen on a card) are
//      compared (likeness: silhouette overlap and light/dark pattern).
//   4. Cube count: the pieces of a group must have 2 × the field's squares in cubes (and no piece twice); if the
//      best guess does not, the next-best candidates are tried.
//   5. Unsure: a picture below SURE_LIMIT is shown with '?' and can be fixed by a tap.
// Add a reference: node scripts/ubongo-refs.js (reads the card photos in replay/ubongo/cards/ with their truth
// files and writes games/ubongo.refs.json, one cut-out per new drawing).

/** @typedef {import('../engine/pictures.js').CutOut} CutOut */
/** @typedef {import('../engine/pictures.js').Ref} Ref */
/** @typedef {{ piece: string, score: number, sure: boolean, options: { name: string, score: number }[] }} IconRead */

// A picture counts as sure at this score or more; below it shows '?'.
export const SURE_LIMIT = 0.8;
// The card is cut out this many times bigger than the straight card used for the fields (more pixels per picture).
export const ZOOM = 2.5;

// The colour word of a printed picture pixel, or null (dark, grey or white). Printed shades: dark yellow reads as
// orange, light red as pink, the light green as cyan.
/** @param {number} r @param {number} g @param {number} b */
function printColor(r, g, b) {
  if (Math.max(r, g, b) - Math.min(r, g, b) < 50) return null;
  const name = colorName({ r, g, b });
  return ({ orange: 'yellow', pink: 'red', cyan: 'green' })[name] ?? name;
}

// One picture → its cut-out (engine/pictures.js): the pixels of its colour. card: the bigger straight card;
// box: the picture's box on it, in its pixels.
/** @param {Frame} card @param {number[]} box [x0, y0, x1, y1] @param {string} color */
export function cutOutIcon(card, box, color) {
  return cutOut(card, box, (r, g, b) => printColor(r, g, b) === color);
}

// One cut-out → the pieces of its colour, best first, each with the score of its closest reference.
/** @param {CutOut | null} cut @param {string} color @param {Ref[]} refs @returns {IconRead} */
export function nameIcon(cut, color, refs) {
  const options = rankByRefs(cut, Object.keys(PIECES).filter((name) => PIECES[name].color === color), refs);
  const best = options[0] ?? { name: '?', score: 0 };
  return { piece: best.name, score: best.score, sure: best.score >= SURE_LIMIT, options };
}

/**
 * The pictures of one group → the pieces, with the cube-count check: the combination with the highest total
 * score whose cubes are `cubes` (2 × the field's squares) and that uses no piece twice. When none fits, the best
 * guess per picture stays and every picture counts as unsure.
 * @param {IconRead[]} reads @param {number} cubes
 * @returns {{ reads: IconRead[], counted: boolean }}
 */
export function checkCubes(reads, cubes) {
  const picks = bestCombination(reads, (names) =>
    names.reduce((n, name) => n + PIECES[name].cubes.length, 0) === cubes && new Set(names).size === names.length);
  const found = picks && { picks };
  if (!found) return { reads: reads.map((r) => ({ ...r, sure: false })), counted: false };
  return {
    counted: true,
    reads: reads.map((r, i) => {
      const o = r.options[found.picks[i]];
      // A picture changed by the check is a guess: shown with '?'.
      return { ...r, piece: o.name, score: o.score, sure: r.sure && found.picks[i] === 0 };
    }),
  };
}

/**
 * All piece pictures of a card → each picture's piece and whether it is sure, per field and group. Pure.
 * big: the straight card cut ZOOM times bigger (any size works: boxes are shares of the card).
 * @template {{ grid: string[], rolls: { icons?: GroupIcon[] }[] }} F
 * @param {Frame} big @param {F[]} fields @param {Ref[]} refs
 * @returns {F[]}
 */
export function readPictures(big, fields, refs) {
  return fields.map((f) => {
    const cubes = 2 * f.grid.join('').split('').filter((ch) => ch === '#').length;
    const rolls = f.rolls.map((group) => {
      const icons = group.icons ?? [];
      const reads = icons.map(({ color, box }) => nameIcon(cutOutIcon(big, [box.left * big.width, box.top * big.height,
        (box.left + box.width) * big.width, (box.top + box.height) * big.height], color), color, refs));
      const checked = checkCubes(reads, cubes).reads;
      return { ...group, icons: icons.map((icon, i) => ({ ...icon, piece: checked[i].piece, sure: checked[i].sure })) };
    });
    return { ...f, rolls };
  });
}

// The pieces read for one group, sorted (empty when the pictures were not read).
/** @param {{ icons?: GroupIcon[] } | undefined} group @returns {string[]} */
export function piecesOf(group) {
  const pieces = (group?.icons ?? []).map((i) => i.piece ?? '');
  return pieces.length && pieces.every((p) => p in PIECES) ? pieces.sort() : [];
}

// The reference cut-outs (games/ubongo.refs.json, made by scripts/ubongo-refs.js), loaded once. [] when the file
// cannot be loaded (then the pictures are not read and the pieces come from the camera or a tap, as before).
export const loadPictureRefs = () => loadRefs(new URL('./ubongo.refs.json', import.meta.url));

// Fill colours for the overlay and the pieces list (CSS colours).
const PAINT = { red: '#ef4444', yellow: '#facc15', green: '#14b8a6', blue: '#3b82f6', purple: '#a855f7', pink: '#ec4899', cyan: '#22d3ee', orange: '#f97316' };

/** @type {string | null} */
let chosenField = null; // field picked by a tap on the card ('top' | 'bottom'), null = choose by the roll or pieces
/** @type {number | null} */
let pickedRoll = null; // die number picked by a tap on a group or in the roll menu, null = choose by the pieces
let fixing = false; // "Fix" was tapped: show how to fix the card
let tray = false; // the pieces list of the "Pieces" button is open
let layer = 0; // the layer drawn on the card: 0 = bottom, 1 = top (the "1 | 2" button)
/** @type {{ roll: string, index: number } | null} */
let fixingPicture = null; // a piece picture of the group that plays was tapped: its candidates are shown
/** @type {Record<string, LearnedCard> | null} */
let learned = null; // the cards learned in this browser, read from localStorage once (plus &card=…)
const cards = () => (learned ??= presetCards(flagsFromHash(globalThis.location?.hash).card, loadCards()));
// The 3D view: shown or not, turn angle (radians), pieces apart or not, pieces shown (0 = all), and when
// "Explode" was last tapped (the pieces slide apart or together for EXPLODE_MS after that).
const view = { on: false, angle: 0.5, explode: false, step: 0, since: 0 };
// How far "Explode" moves each piece outward, in cube sizes, and how long the move takes (ms).
const SPREAD = 1.2;
const EXPLODE_MS = 300;

// ---------------------------------------------------------------- detect

/**
 * @param {Frame} frame
 * @param {import('../engine/types.js').Engine} engine
 * @returns {Promise<UbongoState>}
 */
export async function detect(frame, engine) {
  // Live video: a confirmed card (learned in this browser) is anchored (engine/anchor.js): it is not read again,
  // only its position is followed. A new card is read on every frame until "Looks right? ✓". Lock icon: read again.
  const read = await anchor.run(frame, () => readScene(frame, engine), {
    key: (s) => s.print,
    sure: (s) => Boolean(s.print && cards()[s.print]?.confirmed),
  });
  return settle(read, { roll: pickedRoll, field: chosenField, cards: cards() });
}

const anchor = createAnchor();

// The card, its fields and pictures, and the pieces on the table, read from one picture (before the picks).
/** @param {Frame} frame @param {import('../engine/types.js').Engine} engine @returns {Promise<UbongoState>} */
async function readScene(frame, engine) {
  const empty = { corners: null, area: null, grid: [], pieces: [], seen: [], options: [], tapped: false, card: null, type: /** @type {'A'} */ ('A'), print: null, known: false, field: null, roll: null, number: null, fields: [] };
  let start = performance.now();
  let corners = findColorFrame(frame, config.frameColor) ?? await engine.findBoard(frame, { minArea: 0.05 });
  recordStep('ubongo card', performance.now() - start);
  if (!corners) return empty;
  corners = orderCorners(corners);
  const flat = await engine.straighten(frame, corners);
  start = performance.now();
  // A card held sideways is turned a quarter first. Real cards are about 0.7 times as wide as high; held sideways,
  // about 1.4 times. Near-square shapes (the drawn test cards in replay/ubongo/flat) stay as they are.
  let turns = flat.width > flat.height * 1.15 ? 1 : 0;
  let card = turnBy(flat, turns, engine);
  let { type, fields: read, upsideDown: turned } = readCard(card, config.cellShare);
  // A card lying upside down: turn the straight card around and read it again.
  if (turned) {
    turns += 2;
    card = turnBy(card, 2, engine);
    ({ type, fields: read } = readCard(card, config.cellShare));
  }
  // Start the corners where the card's top-left now is (the drawing follows the corners as they are; straighten
  // sorts them, so its pictures are turned instead).
  turns %= 4;
  corners = corners.map((_, i) => corners[(i - turns + 4) % 4]);
  recordStep('ubongo grid', performance.now() - start);
  // The piece pictures on the card, read from a bigger cut of the card (readPictures).
  let fields = read;
  const refs = await loadPictureRefs();
  if (refs.length && read.length) {
    const cut = await engine.straighten(frame, corners, Math.round(flat.width * ZOOM), Math.round(flat.height * ZOOM));
    const big = turnBy(cut, turns, engine);
    start = performance.now();
    fields = readPictures(big, read, refs);
    recordStep('ubongo pictures', performance.now() - start);
  }
  start = performance.now();
  const cardWidth = (Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y)
    + Math.hypot(corners[2].x - corners[3].x, corners[2].y - corners[3].y)) / 2;
  const first = fields[0];
  const cellPixels = first ? (cardWidth * first.area.width) / first.grid[0].length : cardWidth * config.cellShare;
  const matches = seePieces(frame, corners, cellPixels, paperGains(card));
  const seen = matches.map((p) => p.name).sort();
  recordStep('ubongo pieces', performance.now() - start);
  const state = {
    ...empty,
    corners: corners.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })),
    seen,
    options: matches.map((p) => p.options.map((o) => o.name)),
    card: cardName(fields),
    type,
    print: fingerprint(fields),
    fields,
  };
  return state;
}

// The image turned clockwise by that many quarters.
/** @param {Frame} image @param {number} turns @param {import('../engine/types.js').Engine} engine */
function turnBy(image, turns, engine) {
  for (let i = 0; i < turns; i++) image = engine.turnQuarter(image);
  return image;
}

// The state with field, roll and pieces chosen. Pure: the picks and the learned cards come in.
// roll: a die number picked by a tap (wins); field: a field picked by a tap; else the field and group whose
// colours match the pieces seen. Pieces: the ones saved with the card for that group (tapped in the bar or
// fixed on a picture), else the ones read from the group's pictures on the card, else the ones the camera saw.
/**
 * @param {UbongoState} state
 * @param {{ roll?: number | null, field?: string | null, cards?: Record<string, LearnedCard> }} [picks]
 * @returns {UbongoState}
 */
export function settle(state, { roll = null, field = null, cards: known = {} } = {}) {
  const fields = state.fields ?? [];
  const type = state.type ?? 'A';
  const seen = state.seen ?? [];
  let name;
  let group;
  if (roll) {
    name = fieldOfRoll(type, roll);
    group = groupOfRoll(type, roll);
  } else {
    ({ field: name, roll: group } = chooseField(fields, seen, field));
  }
  const chosen = fields.find((f) => f.name === name) ?? fields[0];
  if (chosen && chosen.name !== name) group = null;
  const card = state.print ? known[state.print] : undefined;
  const saved = (group && card?.pieces?.[group]) || [];
  const grid = chosen ? chosen.grid : [];
  const printed = piecesOf(chosen?.rolls.find((r) => r.roll === group));
  const camera = saved.length || printed.length || solve({ ...state, grid, pieces: seen }) ? seen : solvableChoice(state.options ?? [], grid) ?? seen;
  return {
    ...state,
    field: chosen ? chosen.name : null,
    roll: group ?? null,
    number: chosen && chosen.name === name ? roll : null,
    area: chosen ? chosen.area : null,
    grid: chosen ? chosen.grid : [],
    pieces: saved.length ? [...saved].sort() : printed.length ? printed : camera,
    tapped: saved.length > 0,
    printed: !saved.length && printed.length > 0,
    known: Boolean(card?.confirmed),
  };
}

/** @param {Area} a */
function roundArea(a) {
  const r = (n) => Math.round(n * 1000) / 1000;
  return { left: r(a.left), top: r(a.top), width: r(a.width), height: r(a.height) };
}

// A colour word for a piece or a card picture. The real green pieces look teal (cyan) on camera,
// while the card prints them light green: both count as green.
/** @param {string} name */
export function pieceColor(name) {
  return COLOR_ALIASES[name] ?? name;
}

// The straight card → its type ('A' or 'B', see LAYOUT), upsideDown (see upsideDown) and fields (a real card has two: top
// and bottom, each with its own shape and piece groups; engine/fields.js findFields).
// Each field: { name: 'top' | 'bottom', grid, area, rolls: [{ roll: '1–2', box, colors: ['green', 'red'] }, ...] }.
// Pure (no OpenCV), so tests can call it. fallbackShare: square size as a share of the card width.
/** @param {Frame} card @param {number} fallbackShare @returns {{ type: 'A' | 'B', fields: Field[], upsideDown: boolean }} */
export function readCard(card, fallbackShare) {
  const { height: h } = card;
  const read = findFields(card, fallbackShare, 2)
    .map((f, k) => ({ name: /** @type {'top' | 'bottom'} */ (k === 0 ? 'top' : 'bottom'), ...f }))
    .filter((f) => f.area && f.grid.length);
  // The piece pictures: above the top field's shape belong to it, the rest (below the middle between the two
  // shapes) to the bottom field.
  const icons = findIcons(card);
  const type = cardType(icons);
  const split = read.length === 2 ? ((read[0].area.top + read[0].area.height + read[1].area.top) / 2) * h : h;
  const fields = read.map((f) => {
    const mine = icons.filter((i) => ((i.box[1] + i.box[3]) / 2 < split) === (f.name === 'top'));
    return { name: f.name, grid: f.grid, area: roundArea(f.area), rolls: groupIcons(mine, type, f.name, card) };
  });
  return { type, fields, upsideDown: upsideDown(read, icons, card) };
}

// True when the card lies upside down (turned 180°). On an upright card the piece pictures sit above their field
// (A cards) or mostly left of it (B cards); turned, they sit below or right. Each picture counts for its nearest
// field. Pure.
/** @param {{ area: Area }[]} fields @param {Icon[]} icons @param {{ width: number, height: number }} size */
export function upsideDown(fields, icons, size) {
  if (!fields.length) return false;
  let score = 0;
  for (const { box } of icons) {
    const x = (box[0] + box[2]) / 2 / size.width;
    const y = (box[1] + box[3]) / 2 / size.height;
    const middle = ({ area: a }) => ({ x: a.left + a.width / 2, y: a.top + a.height / 2 });
    const near = fields.map(middle).reduce((a, b) => (Math.abs(b.y - y) < Math.abs(a.y - y) ? b : a));
    score += near.x - x + near.y - y;
  }
  return score < 0;
}

// The piece pictures on a straight card: patches of strong colour, about one picture big (engine/pictures.js).
/** @param {Frame} card @returns {Icon[]} */
export function findIcons(card) {
  // Printed shades: dark yellow reads as orange, light red as pink.
  return findPatches(card, { colorOf: (rgb) => {
    const name = pieceColor(colorName(rgb));
    return name === 'orange' ? 'yellow' : name === 'pink' ? 'red' : name;
  } });
}

// Which field and roll to solve. A field picked by a tap wins; else the field with a roll whose piece colours
// are the colours of the pieces seen; else the top field. Returns { field, roll } (null when nothing fits).
/** @param {Field[]} fields @param {string[]} pieces @param {string | null} picked */
export function chooseField(fields, pieces, picked = null) {
  const want = JSON.stringify(pieces.filter((p) => p in PIECES).map((p) => pieceColor(PIECES[p].color)).sort());
  const match = (f) => f.rolls.find((r) => JSON.stringify(r.colors) === want)?.roll ?? null;
  const tappedField = fields.find((f) => f.name === picked);
  if (tappedField) return { field: tappedField.name, roll: match(tappedField) };
  const fits = fields.find((f) => match(f));
  if (fits) return { field: fits.name, roll: match(fits) };
  return { field: fields[0]?.name ?? null, roll: null };
}

// The card's name when its shapes are a known card (CARDS), else null.
/** @param {Field[]} fields */
export function cardName(fields) {
  const key = JSON.stringify(fields.map((f) => f.grid));
  return Object.keys(CARDS).find((name) => JSON.stringify(CARDS[name]) === key) ?? null;
}

// Pieces on the table (outside the card) → piece names, '?' for a piece that matches nothing well enough.
// cellPixels: side of one square in picture pixels. gains: white balance from the card (engine/color.js paperGains).
// Each blob is matched in 3D against every turn of every piece of its colour (engine/pieces3d.js).
/** @param {Frame} frame @param {Point[]} card @param {number} cellPixels @param {number[]} [gains] @returns {string[]} */
export function findPieces(frame, card, cellPixels, gains) {
  return seePieces(frame, card, cellPixels, gains).map((p) => p.name).sort();
}

// Same as findPieces, with the score of each match (0–1).
/** @param {Frame} frame @param {Point[]} card @param {number} cellPixels @param {number[]} [gains] */
export function seePieces(frame, card, cellPixels, gains) {
  const colors = new Set(Object.values(PIECES).map((p) => p.color));
  const colorOf = (rgb) => pieceColor(colorName(rgb));
  const biggest = Math.max(...Object.keys(PIECES).map((p) => cellsOf(p).length));
  const blobs = findBlobs(frame, card, cellPixels, { colors, colorOf, gains })
    .flatMap((blob) => splitBlob(blob, cellPixels, biggest));
  return nameBlobs(blobs, catalogue(), tableCamera(frame, cellPixels));
}

// The pieces with their turns as columns, worked out once.
/** @type {{ name: string, color: string, turns: import('../engine/pieces3d.js').Columns[]}[] | null} */
let pieceTurns = null;
function catalogue() {
  pieceTurns ??= pieceCatalogue(PIECES);
  return pieceTurns;
}

// Pieces of one colour look much alike on camera. When the best names do not solve the field, try the other
// pieces each blob matches well enough (options, best first) and take the first choice that solves it.
/** @param {string[][]} options per blob @param {string[]} grid @returns {string[] | null} */
export function solvableChoice(options, grid) {
  if (!grid.length || !options.length || options.some((o) => !o.length) || options.length > 6) return null;
  return firstWorking(options, (names) => Boolean(solve({ corners: null, area: null, grid, pieces: names, tapped: false })));
}

// Live video only: the pieces seen count when the camera saw the same list in STEADY_FRAMES frames in a row;
// until then the list seen before stays (no flicker; engine/steady.js holdSteady). Pieces saved with the card or tapped count at once.
const STEADY_FRAMES = 3;
/** @returns {(state: UbongoState) => UbongoState} */
export function makeSteady(frames = STEADY_FRAMES) {
  /** @type {(seen: string[]) => string[]} */
  const hold = holdSteady(frames);
  return (state) => {
    const seen = state.seen ?? [];
    const shown = hold(seen);
    if (shown === seen || state.tapped) return state;
    return settle({ ...state, seen: shown }, { roll: pickedRoll, field: chosenField, cards: cards() });
  };
}
export const steady = makeSteady();

// ---------------------------------------------------------------- solve

// The cubes of a piece as [layer, row, col].
/** @param {string} name @returns {number[][]} */
export function cubesOf(name) {
  return PIECES[name].cubes.map((cube) => [...cube]);
}

// The squares a piece covers seen from above, lying as in PIECES, as [row, col] pairs.
/** @param {string} name @returns {number[][]} */
export function cellsOf(name) {
  const seen = new Map(PIECES[name].cubes.map(([, r, c]) => [`${r},${c}`, [r, c]]));
  return [...seen.values()];
}

// TODO (solve): fill every '#' of state.grid LAYERS (2) high with exactly the pieces in state.pieces, each used once.
// Return { placements: [{ piece: 'red2', cells: [[layer, row, col], ...] }, ...] } (see the move at the top),
// or null when the pieces do not fit. Skip names that are not in PIECES ('?').
// Hints:
//   - space[layer][row][col] = true while empty: two copies of the grid, true where it has '#'.
//   - Quick "no": the cubes of all pieces (cubesOf(name).length) must add up to the number of empty spaces.
//   - orientations(cubes) (engine/cover.js) gives every turn of a piece (24 at most, never mirrored), each starting
//     at its first cube (bottom layer first, then reading order).
//   - Backtracking: find the first empty space (layer 0 first, then row by row, left to right). Some piece must fill
//     it with its own first cube. For every unused piece and every turn: shift the turn so its first cube lands on
//     that space; if all its cubes are empty spaces, mark them full, remember the placement, and go on with the
//     next empty space. When nothing fits, undo the last placement and try the next turn (step back).
//     No empty space left = solved.
//   - Test it: node replay/run.js ubongo  says "ok" and "solution": "valid" for every photo.
// Keep it pure: same state in, same move out. Stuck? The engine's coverGrid (engine/cover.js) does all of this.
/** @param {UbongoState} state @returns {UbongoMove} */
export function solve(state) {
  return null;
}

// ---------------------------------------------------------------- draw

/**
 * Paints the solution on the card (one layer at a time) and the grid outline. Nothing else goes on the picture:
 * the line of text is the corner chip, the buttons are icons at the bottom right, the pieces and the 3D view
 * are in the picture-in-picture box (engine/actions.js).
 * @param {CanvasRenderingContext2D} ctx
 * @param {UbongoState} state
 * @param {UbongoMove} move
 */
export function draw(ctx, state, move) {
  if (ctx.canvas.dataset) ctx.canvas.dataset.drawnBy = 'ubongo'; // see listenForTaps
  last = { ctx, picture: ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height), state, move };
  paint(ctx, state, move);
  showControls(state, move);
  listenForTaps(ctx.canvas);
}

/** @type {{ ctx: CanvasRenderingContext2D, picture: ImageData, state: UbongoState, move: UbongoMove } | null} */
let last = null; // the last picture, state and move: a tap changes them and paints again (the camera may be off)

// Paints the last picture again, with the changed state, and updates the buttons.
function repaint() {
  if (!last) return;
  last.ctx.putImageData(last.picture, 0, 0);
  paint(last.ctx, last.state, last.move);
  showControls(last.state, last.move);
}

// After a pick (roll, field, card, pieces): choose again from the state detect() gave, solve, paint.
function again() {
  if (!last) return;
  last.state = settle(last.state, { roll: pickedRoll, field: chosenField, cards: cards() });
  last.move = solve(last.state);
  repaint();
}

/** @param {CanvasRenderingContext2D} ctx @param {UbongoState} state @param {UbongoMove} move */
function paint(ctx, state, move) {
  if (!state.corners || !state.area || !state.grid.length) return;
  const size = Math.max(14, ctx.canvas.width / 32);
  ctx.save();
  const { corners, area, grid } = state;
  const rows = grid.length;
  const cols = grid[0].length;
  // A point (y, x) in grid squares → picture pixels.
  const at = (y, x) => boardPoint(corners, area.left + (area.width * x) / cols, area.top + (area.height * y) / rows);
  const corner4 = (r, c) => [at(r, c), at(r, c + 1), at(r + 1, c + 1), at(r + 1, c)];
  ctx.lineWidth = Math.max(1, ctx.canvas.width / 600);
  ctx.strokeStyle = '#22d3ee';
  grid.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') polygon(ctx, corner4(r, c), false); }));
  // Only the layer chosen with the "1 | 2" button: [row, col] of each cube in it, per piece.
  const placed = (move?.placements ?? []).map(({ piece, cells }) => ({ piece, cells: cells.filter(([l]) => l === layer).map(([, r, c]) => [r, c]) }));
  ctx.globalAlpha = 0.8;
  for (const { piece, cells } of placed) {
    ctx.fillStyle = PAINT[PIECES[piece].color] ?? '#ffffff';
    for (const [r, c] of cells) polygon(ctx, corner4(r, c), true);
  }
  ctx.globalAlpha = 1;
  // A dark outline around each piece: every side of a square that is not shared with a square of the same piece.
  /** @type {Map<string, { a: number[], b: number[], pieces: number[] }>} */
  const sides = new Map();
  placed.forEach(({ cells }, k) => {
    for (const [r, c] of cells) {
      for (const [a, b] of [[[r, c], [r, c + 1]], [[r, c + 1], [r + 1, c + 1]], [[r + 1, c], [r + 1, c + 1]], [[r, c], [r + 1, c]]]) {
        const key = `${a}|${b}`;
        const known = sides.get(key) ?? { a, b, pieces: [] };
        known.pieces.push(k);
        sides.set(key, known);
      }
    }
  });
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = Math.max(2, ctx.canvas.width / 250);
  for (const { a, b, pieces } of sides.values()) {
    if (pieces.length === 1 || pieces[0] !== pieces[1]) line(ctx, at(a[0], a[1]), at(b[0], b[1]));
  }
  // The other field: a dashed outline, so you see where to tap. The group that plays: a solid outline.
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = '#9ca3af';
  for (const f of state.fields ?? []) {
    if (f.name === state.field || !f.area) continue;
    polygon(ctx, areaCorners(corners, f.area), false);
  }
  ctx.setLineDash([]);
  const group = state.fields?.find((f) => f.name === state.field)?.rolls.find((r) => r.roll === state.roll);
  if (group) {
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = Math.max(2, ctx.canvas.width / 300);
    polygon(ctx, areaCorners(corners, padBox(group.box, state.type)), false);
    // Each picture read: its piece name small under it, with '?' when unsure (tap it to fix).
    if (state.printed) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (const icon of group.icons ?? []) {
        const p = boardPoint(corners, icon.box.left + icon.box.width / 2, icon.box.top + icon.box.height + 0.012);
        const from = boardPoint(corners, icon.box.left, icon.box.top);
        const to = boardPoint(corners, icon.box.left + icon.box.width, icon.box.top);
        const wide = Math.hypot(to.x - from.x, to.y - from.y); // the picture's width in pixels: the name fits under it
        ctx.font = `bold ${Math.min(size * 0.7, wide * 0.6)}px system-ui, sans-serif`;
        ctx.fillStyle = icon.sure ? '#ffffff' : '#facc15';
        ctx.fillText(`${pieceName(icon.piece ?? '')}${icon.sure ? '' : '?'}`, p.x, p.y);
      }
    }
  }
  ctx.restore();
}

/**
 * The one line in the corner chip, e.g. "A24 · roll 1–2 · top · solved". Pure.
 * @param {UbongoState} state @param {UbongoMove} move @param {{ fixing?: boolean }} [now]
 */
export function infoLine(state, move, { fixing: fix = false } = {}) {
  if (!state.corners || !state.grid?.length) return 'No Ubongo card found: get the whole card in the picture';
  if (fix) return 'Fix: tap the right group on the card, then its pieces (puzzle icon)';
  const result = move ? 'solved' : state.pieces.length ? 'no solution' : 'no pieces yet';
  const unsure = state.printed && state.fields?.some((f) => f.rolls.some((r) => r.roll === state.roll && r.icons?.some((i) => !i.sure)));
  // What to do next comes first, so the chip never cuts it off on a narrow phone (issue #163).
  const todo = state.print && !state.known ? 'New card: check it in More · ' : unsure ? 'Tap a ? to fix it · ' : '';
  return `${todo}${fieldLabel(state)} · ${result}`;
}

// For a new card: what was read for the group that plays, e.g. "New card (A). 1–2: green, green, red. Looks right?"
/** @param {UbongoState} state */
export function newCardText(state) {
  const group = state.fields?.find((f) => f.name === state.field)?.rolls.find((r) => r.roll === state.roll);
  const what = group ? ` ${group.roll}: ${group.colors.join(', ')}.` : '';
  return `New card (${state.type ?? 'A'}).${what} Looks right?`;
}

// A group's box made a bit bigger, so a finger hits it; on an A card the numbers left of the pictures count too.
/** @param {Area} box @param {'A' | 'B' | undefined} type @returns {Area} */
export function padBox(box, type) {
  const left = type === 'B' ? 0.02 : 0.08;
  return { left: box.left - left, top: box.top - 0.02, width: box.width + left + 0.02, height: box.height + 0.04 };
}

// "A24 · roll 3 · top": the card (name when known, else its type), the roll (the number picked, else the group
// that matches the pieces) and the field.
/** @param {{ card?: string | null, type?: string, field?: string | null, roll?: string | null, number?: number | null }} state */
export function fieldLabel(state) {
  return `${state.card ?? `Card ${state.type ?? ''}`.trim()} · roll ${state.number ?? state.roll ?? '?'} · ${state.field ?? 'top'}`;
}

// A tap on the card → the die number of the piece group under it (its first number), or null.
/** @param {UbongoState} state @param {Point} p a point in picture pixels */
export function rollAt(state, p) {
  if (!state.corners) return null;
  for (const f of state.fields ?? []) {
    const k = areaAt(state.corners, f.rolls.map((r) => padBox(r.box, state.type)), p);
    if (k >= 0) return firstRoll(f.rolls[k].roll);
  }
  return null;
}

// ---------------------------------------------------------------- buttons, corner chip, picture-in-picture

/** @typedef {import('../engine/actions.js').Action} Action */

// The buttons (at most 4 on the picture, engine/actions.js), the corner chip and the picture-in-picture box.
// Normal:   Roll (1–10) · Pieces (all 16, tap to add or remove) · 3D view · Layer 1 | 2.
// 3D view:  3D view (lit, tap to close) · Explode · Step · Pieces. The 3D view is the big picture-in-picture box.
// In ⋯:     a new card: "Card looks right ✓" and "Fix card"; a learned card: "Forget card".
/** @param {UbongoState} state @param {UbongoMove} move */
function showControls(state, move) {
  setInfo(infoLine(state, move, { fixing }));
  if (!state.corners || !state.grid?.length) {
    setActions([]);
    setPip(null);
    return;
  }
  if (!move) view.on = false;
  const roll = /** @type {Action} */ ({
    id: 'roll', icon: 'dices', label: 'Roll', badge: String(state.number ?? '?'),
    choices: Array.from({ length: 10 }, (_, i) => ({ label: String(i + 1), active: state.number === i + 1, onTap: () => { pickedRoll = i + 1; chosenField = null; again(); } })),
  });
  const pieces = piecesAction(state);
  const show3d = /** @type {Action} */ ({ id: '3d', icon: 'box', label: '3D view', active: view.on, onTap: () => { view.on = !view.on; repaint(); } });
  /** @type {Action[]} */
  const rail = !move ? [roll, pieces]
    : view.on ? [
      show3d,
      { id: 'explode', icon: 'move-diagonal', label: view.explode ? 'Together' : 'Explode', active: view.explode, onTap: () => { view.explode = !view.explode; view.since = Date.now(); repaint(); } },
      { id: 'step', icon: 'list-ordered', label: 'Step', badge: view.step ? String(view.step) : '', onTap: () => { view.step = (view.step + 1) % (move.placements.length + 1); repaint(); } },
      pieces,
    ] : [
      roll, pieces, show3d,
      { id: 'layer', icon: 'layers', label: `Layer ${layer + 1} of ${LAYERS}`, badge: String(layer + 1), onTap: () => { layer = (layer + 1) % LAYERS; repaint(); } },
    ];
  /** @type {Action[]} */
  const more = !state.print ? []
    : state.known ? [{ id: 'forget', icon: 'trash-2', label: 'Forget card', more: true, onTap: () => cardAction('forget') }]
      : [
        { id: 'right', icon: 'check', label: 'Card looks right ✓', more: true, onTap: () => cardAction('right') },
        { id: 'fix', icon: 'wrench', label: 'Fix card', more: true, active: fixing, onTap: () => cardAction('fix') },
      ];
  setActions([...rail, ...more]);
  setPip(move && view.on ? solutionPip(move) : state.pieces.some((p) => p in PIECES) ? piecesPip(state) : null);
}

// "Pieces": all 16 (lit = in use; a tap adds or removes one, saved with the card). After a tap on a piece
// picture of the group on the card: only the 4 pieces of its colour, to fix that picture.
/** @param {UbongoState} state @returns {Action} */
function piecesAction(state) {
  const icon = fixingPicture && fixingPicture.roll === state.roll ? groupIcon(state, fixingPicture.index) : null;
  const names = icon ? Object.keys(PIECES).filter((name) => PIECES[name].color === icon.color)
    : COLORS.flatMap((color) => Object.keys(PIECES).filter((name) => PIECES[name].color === color));
  return {
    id: 'pieces', icon: 'puzzle', label: 'Pieces', open: tray || Boolean(icon),
    onTap: () => { tray = !(tray || icon); fixingPicture = null; repaint(); },
    choices: names.map((name) => ({
      label: pieceName(name), color: PAINT[PIECES[name].color], active: state.pieces.includes(name),
      onTap: () => {
        if (!last) return;
        if (icon && fixingPicture) {
          last.state = fixPicture(last.state, fixingPicture.index, name);
          fixingPicture = null;
        } else last.state = tapPiece(last.state, name);
        last.move = solve(last.state);
        repaint();
      },
    })),
  };
}

// A card row in the ⋯ sheet: save the card as read, show how to fix it, or forget it.
/** @param {'right' | 'fix' | 'forget'} id */
function cardAction(id) {
  const print = last?.state.print;
  if (!last || !print) return;
  if (id === 'fix') tray = fixing = !fixing; // fixing needs the pieces list
  if (id === 'right') {
    cards()[print] = { type: last.state.type ?? 'A', pieces: {}, ...cards()[print], confirmed: true };
    saveCard(print, cards()[print]);
    fixing = false;
  }
  if (id === 'forget') {
    delete cards()[print];
    saveCard(print, null);
  }
  again();
}

// The solution as cubes in the piece colours, each with its piece number (the place order).
// With step > 0 only the first `step` pieces.
/** @param {NonNullable<UbongoMove>} move @param {number} step @returns {import('../engine/iso.js').Cube[]} */
export function solutionCubes(move, step = 0) {
  return placementCubes(move.placements, (piece) => PAINT[PIECES[piece].color] ?? '#ffffff', step);
}

// Turning slowly (one turn in 12 s), or still when the phone asks for less motion.
const still = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;
const turnAngle = () => (still() ? 0.5 : 0.5 + (Date.now() / 12000) * 2 * Math.PI);

// The 3D view in the picture-in-picture box: drag sideways to turn. "Explode" slides the pieces apart.
/** @param {NonNullable<UbongoMove>} move @returns {import('../engine/actions.js').Pip} */
function solutionPip(move) {
  return {
    label: '3D view',
    // Painted again on every screen refresh only while the pieces slide apart or together.
    get turning() { return !still() && Date.now() - view.since < EXPLODE_MS; },
    drag: (dx) => { view.angle += dx * 2 * Math.PI; },
    draw: (ctx, size) => {
      const goal = view.explode ? 1 : 0;
      const t = still() ? 1 : Math.min(1, (Date.now() - view.since) / EXPLODE_MS);
      const apart = view.explode ? t : 1 - t;
      const eased = (goal === apart ? apart : apart * apart * (3 - 2 * apart)); // starts and ends gently
      const all = solutionCubes(move); // offsets and fit from all pieces, so stepping keeps places and size
      const offsets = explodeOffsets(all, SPREAD * eased);
      const fit = fitView(all, offsets, { x: size * 0.05, y: size * 0.14, width: size * 0.9, height: size * 0.82 });
      drawPolygons(ctx, isoPolygons(solutionCubes(move, view.step), { angle: view.angle, offsets }), fit);
      ctx.font = `${Math.max(10, size / 14)}px system-ui, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const piece = view.step > 0 ? `${view.step}/${move.placements.length}: ${pieceName(move.placements[view.step - 1].piece)}` : 'Drag to turn';
      ctx.fillText(piece, size / 2, size * 0.03);
    },
  };
}

// The pieces in use as small turning 3D models with their names, in a grid in the picture-in-picture box.
/** @param {UbongoState} state @returns {import('../engine/actions.js').Pip} */
function piecesPip(state) {
  const pieces = state.pieces.filter((p) => p in PIECES);
  const per = Math.ceil(Math.sqrt(pieces.length));
  return {
    label: 'Pieces in use',
    turning: true,
    draw: (ctx, size) => {
      const cell = size / per;
      const angle = turnAngle();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      pieces.forEach((name, i) => {
        const x = (i % per) * cell;
        const y = Math.floor(i / per) * cell;
        const cubes = cubesOf(name).map((at) => ({ at, color: PAINT[PIECES[name].color] ?? '#ffffff' }));
        const fit = fitView(cubes, [], { x: x + cell * 0.12, y: y + cell * 0.06, width: cell * 0.76, height: cell * 0.66 });
        drawPolygons(ctx, isoPolygons(cubes, { angle }), fit);
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(9, cell * 0.2)}px system-ui, sans-serif`;
        ctx.fillText(pieceName(name), x + cell / 2, y + cell - 2);
      });
    },
  };
}

// The picture `index` of the group that plays, or null.
/** @param {UbongoState} state @param {number} index */
function groupIcon(state, index) {
  return state.fields?.find((f) => f.name === state.field)?.rolls.find((r) => r.roll === state.roll)?.icons?.[index] ?? null;
}

// A tap on the card → the index of the piece picture under it in the group that plays (read pictures only), or null.
/** @param {UbongoState} state @param {Point} p a point in picture pixels */
export function pictureAt(state, p) {
  const icons = state.fields?.find((f) => f.name === state.field)?.rolls.find((r) => r.roll === state.roll)?.icons ?? [];
  if (!state.corners || !state.printed && !state.tapped) return null;
  const boxes = icons.map((i) => (i.piece ? { left: i.box.left - 0.01, top: i.box.top - 0.01, width: i.box.width + 0.02, height: i.box.height + 0.04 } : { left: 0, top: 0, width: 0, height: 0 }));
  const k = areaAt(state.corners, boxes, p);
  return k >= 0 ? k : null;
}

// The fix of one picture: the group's pieces with that picture's piece swapped for `name`, saved with the card.
/** @param {UbongoState} state @param {number} index @param {string} name @returns {UbongoState} */
function fixPicture(state, index, name) {
  const icon = groupIcon(state, index);
  if (!icon?.piece || !state.print || !state.roll) return state;
  const list = [...state.pieces];
  const k = list.indexOf(icon.piece);
  if (k >= 0) list[k] = name;
  else list.push(name);
  const card = cards()[state.print] ?? { type: state.type ?? 'A', confirmed: false, pieces: {} };
  card.pieces = { ...card.pieces, [state.roll]: list.sort() };
  cards()[state.print] = card;
  saveCard(state.print, card);
  icon.piece = name; // the tapped picture now shows the fixed piece
  icon.sure = true;
  return { ...state, pieces: list, tapped: true, printed: false };
}

// A tap on a piece in the list: add or remove it for the group that plays, saved with the card (this browser).
/** @param {UbongoState} state @param {string} name @returns {UbongoState} */
function tapPiece(state, name) {
  const pieces = new Set(state.pieces.filter((p) => p in PIECES)); // start from what is in use now
  if (pieces.has(name)) pieces.delete(name);
  else pieces.add(name);
  const list = [...pieces].sort();
  if (state.print && state.roll) {
    const card = cards()[state.print] ?? { type: state.type ?? 'A', confirmed: false, pieces: {} };
    card.pieces = { ...card.pieces, [state.roll]: list };
    cards()[state.print] = card;
    saveCard(state.print, card);
  }
  return { ...state, pieces: list, tapped: list.length > 0 };
}

// Taps on the card itself: a piece picture of the group that plays (fix it), a piece group (= its roll), or the
// other field. The handler is added once per canvas and works on the last picture (see `last`).
const listening = new WeakSet();
/** @param {HTMLCanvasElement} canvas */
function listenForTaps(canvas) {
  if (typeof canvas.addEventListener !== 'function' || listening.has(canvas)) return;
  listening.add(canvas);
  canvas.addEventListener('pointerdown', (event) => {
    // A game switch leaves this handler on the canvas: quiet unless Ubongo drew last (app.js clears drawnBy).
    if (!last || canvas.dataset.drawnBy !== 'ubongo') return;
    const p = canvasPoint(event, canvas);
    const state = last.state;
    // A tap on a piece picture of the group that plays: show the pieces of its colour (tap one to fix it).
    const picture = pictureAt(state, p);
    if (picture !== null && state.roll) {
      const same = fixingPicture?.roll === state.roll && fixingPicture.index === picture;
      fixingPicture = same ? null : { roll: state.roll, index: picture };
      repaint();
      return;
    }
    // A tap on a piece group (or its number) on the card: that roll plays.
    const groupRoll = rollAt(state, p);
    if (groupRoll) {
      pickedRoll = groupRoll;
      chosenField = null;
      again();
      return;
    }
    // A tap on the other field of the card: solve that field instead.
    const field = (state.fields ?? []).find((f) => f.name !== state.field && f.area && state.corners && areaAt(state.corners, [f.area], p) === 0);
    if (field) {
      pickedRoll = null;
      chosenField = field.name;
      again();
    }
  });
}

/** @param {CanvasRenderingContext2D} ctx @param {Point} a @param {Point} b */
function line(ctx, a, b) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

/** @param {CanvasRenderingContext2D} ctx @param {Point[]} points @param {boolean} fill */
function polygon(ctx, points, fill) {
  ctx.beginPath();
  points.forEach((p) => ctx.lineTo(p.x, p.y));
  ctx.closePath();
  if (fill) ctx.fill();
  else ctx.stroke();
}
