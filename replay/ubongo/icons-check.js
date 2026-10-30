// @ts-check
// Helpers for the piece pictures on the card photos (issue #56), used by scripts/ubongo-refs.js and
// tests/ubongo.test.js: read a card photo, make the reference cut-outs from the truth files, and score a reading.
// Node only (needs the dev tools: jpeg-js and OpenCV.js from pnpm install).
import { readFileSync } from 'node:fs';
import * as ubongo from '../../games/ubongo.js';
import { toRef, fromRef, likeness } from '../../engine/pictures.js';
import { findColorFrame } from '../../engine/cards.js';

const { cutOutIcon: cutOut, readPictures, ZOOM } = ubongo;
/** @typedef {import('../../engine/pictures.js').Ref} Ref */
/** @typedef {{ name: string, big: import('../../engine/types.js').Frame, fields: import('../../games/ubongo.js').Field[], truth: Record<string, string[]> }} CardPhoto */

export const CARDS = ['a24', 'a27', 'b24', 'b27'];
// The owner's newer photos of card 27 (issue #158), in replay/ubongo/cards-owner/: checked, not used for references.
export const OWNER_CARDS = ['b27-wood-top', 'b27-wood-tilted', 'b27-fabric-top', 'b27-fabric-angle', 'a27-fabric-upside-down']
  .map((name) => `cards-owner/${name}`);

// A card photo in replay/ubongo/cards/ (a name like 'b27') or elsewhere in replay/ubongo/ ('cards-owner/b27-wood-top')
// → its fields (as games/ubongo.js reads them, turned when upside down), the bigger straight card and the truth
// (pieces per group).
/** @param {string} name @param {any} engine @param {any} jpeg @returns {Promise<CardPhoto>} */
export async function loadCard(name, engine, jpeg) {
  const url = (/** @type {string} */ file) => new URL(name.includes('/') ? `./${file}` : `./cards/${file}`, import.meta.url);
  const image = jpeg.decode(readFileSync(url(`${name}.jpg`)), { useTArray: true, maxMemoryUsageInMB: 1024 });
  const frame = { width: image.width, height: image.height, data: new Uint8ClampedArray(image.data) };
  const corners = findColorFrame(frame, 'red');
  let card = await engine.straighten(frame, corners);
  let big = await engine.straighten(frame, corners, Math.round(card.width * ZOOM), Math.round(card.height * ZOOM));
  let { fields, upsideDown } = ubongo.readCard(card, ubongo.config.cellShare);
  if (upsideDown) {
    const turn = (/** @type {any} */ image) => engine.turnQuarter(engine.turnQuarter(image));
    card = turn(card);
    big = turn(big);
    ({ fields } = ubongo.readCard(card, ubongo.config.cellShare));
  }
  return { name, big, fields, truth: JSON.parse(readFileSync(url(`${name}.truth.json`), 'utf8')).pieces };
}

// The card a photo shows: 'cards-owner/b27-wood-top' → 'b27'.
/** @param {string} name */
export const cardOf = (name) => (name.split('/').pop() ?? '').slice(0, 3);

// Every picture of a card with its cut-out.
/** @param {CardPhoto} photo */
function cutOuts(photo) {
  const { big } = photo;
  return photo.fields.flatMap((f) => f.rolls.map((group) => ({
    roll: group.roll,
    cuts: (group.icons ?? []).map(({ color, box }) => ({ color, cut: cutOut(big, [box.left * big.width, box.top * big.height,
      (box.left + box.width) * big.width, (box.top + box.height) * big.height], color) })),
  })));
}

// All orders of a list.
/** @template T @param {T[]} list @returns {T[][]} */
const orders = (list) => (list.length <= 1 ? [list] : list.flatMap((x, i) => orders([...list.slice(0, i), ...list.slice(i + 1)]).map((rest) => [x, ...rest])));

/**
 * The reference cut-outs from card photos with truth files. Per group and colour, the truth names which pieces
 * the pictures show; when a colour has two or more pictures, the order that looks most like the references so far
 * wins (groups with one picture per colour go first). A cut-out becomes a new reference only when no reference
 * of its piece looks like it (likeness below `same`): one reference per drawing.
 * @param {CardPhoto[]} photos @param {number} [same]
 * @returns {Ref[]}
 */
export function makeRefs(photos, same = 0.9) {
  /** @type {Ref[]} */
  const refs = [];
  const add = (/** @type {string} */ piece, /** @type {import('../../engine/pictures.js').CutOut | null} */ cut) => {
    if (!cut || refs.some((r) => r.piece === piece && likeness(cut, fromRef(r)) >= same)) return;
    refs.push({ piece, ...toRef(cut) });
  };
  const jobs = photos.flatMap((photo) => cutOuts(photo).flatMap(({ roll, cuts }) => {
    const want = photo.truth[roll] ?? [];
    return [...new Set(cuts.map((c) => c.color))].map((color) => ({
      cuts: cuts.filter((c) => c.color === color).map((c) => c.cut),
      pieces: want.filter((p) => ubongo.PIECES[p]?.color === color),
    }));
  })).filter((j) => j.cuts.length === j.pieces.length).sort((a, b) => a.cuts.length - b.cuts.length);
  for (const { cuts, pieces } of jobs) {
    const fit = (/** @type {string[]} */ order) => order.reduce((sum, piece, i) => {
      const own = refs.filter((r) => r.piece === piece);
      const cut = cuts[i];
      return sum + (cut && own.length ? Math.max(...own.map((r) => likeness(cut, fromRef(r)))) : 0);
    }, 0);
    const best = orders(pieces).reduce((a, b) => (fit(b) > fit(a) ? b : a));
    best.forEach((piece, i) => add(piece, cuts[i]));
  }
  return refs.sort((a, b) => (a.piece < b.piece ? -1 : a.piece > b.piece ? 1 : 0));
}

/**
 * Reads a card's pictures with refs and compares with the truth. Per group: right pictures (multiset), whether
 * the cube count passed and whether the whole group is right.
 * @param {CardPhoto} photo @param {Ref[]} refs
 */
export function scoreCard(photo, refs) {
  const fields = readPictures(photo.big, photo.fields, refs);
  return fields.flatMap((f) => {
    const cubes = 2 * f.grid.join('').split('').filter((ch) => ch === '#').length;
    return f.rolls.map((group) => {
      const read = (group.icons ?? []).map((i) => i.piece ?? '?');
      const left = [...(photo.truth[group.roll] ?? [])];
      let right = 0;
      for (const p of read) {
        const k = left.indexOf(p);
        if (k >= 0) { right++; left.splice(k, 1); }
      }
      const counted = read.reduce((n, p) => n + (ubongo.PIECES[p]?.cubes.length ?? 0), 0) === cubes;
      return { roll: group.roll, read: [...read].sort(), right, total: read.length, counted, whole: right === read.length && left.length === 0,
        unsure: (group.icons ?? []).filter((i) => !i.sure).length };
    });
  });
}
