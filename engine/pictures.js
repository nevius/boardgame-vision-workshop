// @ts-check
// Building block "pictures": find small printed pictures (icons) on a straight card, cut each one out as a small
// silhouette with its light and dark pattern, and match it to reference cut-outs (few-shot: a few examples per
// name, no training). Pure JavaScript on the pixels, so it runs the same in the browser and in Node.
// From Ubongo (the piece pictures on its cards, issue #56).
//
//   const icons = findPatches(card, { colorOf: (rgb) => colorName(rgb) });   // [{ color: 'red', box: [x0, y0, x1, y1] }]
//   const cut = cutOut(card, icons[0].box, (r, g, b) => colorName({ r, g, b }) === 'red');
//   const options = rankByRefs(cut, ['red1', 'red2'], refs);                 // [{ name, score 0–1 }], best first
//
// A reference = toRef(cut) plus its name ({ piece, cells, light }), stored as JSON (loadRefs(url) reads such a file).
// Used by games/ubongo.js (and scripts/ubongo-refs.js to make its references).
// Limits: pictures must be one strong colour on a dark or white card, about 2–9 % of the card width, apart
// from each other; colour names come from your colorOf. Mirror images and turned pictures do not match.

import { cosine } from './fewshot.js';

/** @typedef {import('./types.js').Frame} Frame */
/** @typedef {{ color: string, box: number[] }} Patch  box: [x0, y0, x1, y1] in pixels of the straight card */
/** @typedef {{ cover: number[], shade: number[], ratio: number }} CutOut  per cell 0–1; ratio = width / height */
/** @typedef {{ piece: string, cells: string[], light: string[] }} Ref  a cut-out as digits 0–9, one string per row */

// The cut-out grid: SIZE × SIZE cells.
export const SIZE = 16;

/**
 * Patches of strong colour about one picture big on a straight card (bigger patches are the frame or its drawings,
 * smaller ones digits or noise). A border of 6 % is skipped. Each patch takes the colour most of its pixels have.
 * colorOf: the colour word of a strong pixel (brightest minus darkest channel at least 70), or null to skip it.
 * @param {Frame} card @param {{ colorOf: (rgb: { r: number, g: number, b: number }) => string | null }} options
 * @returns {Patch[]}
 */
export function findPatches(card, { colorOf }) {
  const { width: w, height: h, data } = card;
  const skip = Math.round(Math.min(w, h) * 0.06);
  /** @type {(string | null)[]} */
  const label = new Array(w * h).fill(null);
  for (let y = skip; y < h - skip; y++) for (let x = skip; x < w - skip; x++) {
    const i = (y * w + x) * 4;
    const max = Math.max(data[i], data[i + 1], data[i + 2]);
    const min = Math.min(data[i], data[i + 1], data[i + 2]);
    if (max - min < 70) continue;
    label[y * w + x] = colorOf({ r: data[i], g: data[i + 1], b: data[i + 2] });
  }
  const minSize = (w * 0.02) ** 2;
  const maxSide = w * 0.09;
  const seen = new Uint8Array(w * h);
  /** @type {Patch[]} */
  const patches = [];
  for (let start = 0; start < w * h; start++) {
    if (!label[start] || seen[start]) continue;
    const count = new Map();
    const stack = [start];
    seen[start] = 1;
    let size = 0;
    const box = [w, h, 0, 0];
    while (stack.length) {
      const k = /** @type {number} */ (stack.pop());
      size++;
      count.set(label[k], (count.get(label[k]) ?? 0) + 1);
      const x = k % w;
      const y = (k - x) / w;
      box[0] = Math.min(box[0], x); box[1] = Math.min(box[1], y); box[2] = Math.max(box[2], x + 1); box[3] = Math.max(box[3], y + 1);
      for (const n of [k - w, k + w, x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1]) {
        if (n >= 0 && n < w * h && !seen[n] && label[n]) { seen[n] = 1; stack.push(n); }
      }
    }
    // A picture is about square: long thin patches are bits of the frame's lines.
    const long = Math.max(box[2] - box[0], box[3] - box[1]);
    const short = Math.min(box[2] - box[0], box[3] - box[1]);
    if (size < minSize || long > maxSide || long < w * 0.035 || long > 3 * short) continue;
    patches.push({ color: [...count.entries()].reduce((a, b) => (b[1] > a[1] ? b : a))[0], box });
  }
  return patches;
}

/**
 * Patches close together → `count` groups: the two closest groups are joined until `count` are left.
 * Returns the groups in reading order, each with its box and its items.
 * @template {{ box: number[] }} T @param {T[]} items @param {number} count
 * @returns {{ box: number[], items: T[] }[]}
 */
export function groupNear(items, count) {
  let groups = items.map((i) => ({ box: [...i.box], items: [i] }));
  const gap = (a, b) => Math.max(a[0] - b[2], b[0] - a[2], a[1] - b[3], b[1] - a[3], 0)
    + 0.01 * Math.hypot(a[0] + a[2] - b[0] - b[2], a[1] + a[3] - b[1] - b[3]);
  while (groups.length > count) {
    let best = [0, 1];
    let bestGap = Infinity;
    for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
      const g = gap(groups[i].box, groups[j].box);
      if (g < bestGap) { bestGap = g; best = [i, j]; }
    }
    const [a, b] = best.map((k) => groups[k]);
    const joined = { box: [Math.min(a.box[0], b.box[0]), Math.min(a.box[1], b.box[1]), Math.max(a.box[2], b.box[2]), Math.max(a.box[3], b.box[3])], items: [...a.items, ...b.items] };
    groups = groups.filter((g) => g !== a && g !== b).concat([joined]);
  }
  return boxReadingOrder(groups);
}

// Boxes in reading order: a box whose middle lies within the height of the row's first box is in that row.
/** @template {{ box: number[] }} T @param {T[]} groups @returns {T[]} */
export function boxReadingOrder(groups) {
  const byTop = [...groups].sort((a, b) => (a.box[1] + a.box[3]) - (b.box[1] + b.box[3]));
  /** @type {T[][]} */
  const rows = [];
  for (const g of byTop) {
    const middle = (g.box[1] + g.box[3]) / 2;
    const row = rows.find((r) => middle >= r[0].box[1] && middle <= r[0].box[3]);
    if (row) row.push(g);
    else rows.push([g]);
  }
  return rows.flatMap((r) => r.sort((a, b) => a.box[0] - b.box[0]));
}

/**
 * One picture → its cut-out: the pixels that `mine` says belong to it, fitted into a SIZE × SIZE grid (the shape
 * keeps its proportions). Per cell: how much of it is the picture (cover) and how light it is (shade).
 * box: the picture's box on the card, in its pixels (a bit around it is looked at too). null when too few pixels.
 * @param {Frame} card @param {number[]} box [x0, y0, x1, y1] @param {(r: number, g: number, b: number) => boolean} mine
 * @returns {CutOut | null}
 */
export function cutOut(card, box, mine) {
  const { width: w, data } = card;
  const pad = Math.round((box[2] - box[0]) * 0.15);
  const x0 = Math.max(0, Math.floor(box[0] - pad));
  const y0 = Math.max(0, Math.floor(box[1] - pad));
  const x1 = Math.min(w, Math.ceil(box[2] + pad));
  const y1 = Math.min(card.height, Math.ceil(box[3] + pad));
  /** @type {{ x: number, y: number, v: number }[]} */
  const pixels = [];
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * w + x) * 4;
    if (mine(data[i], data[i + 1], data[i + 2])) pixels.push({ x, y, v: Math.max(data[i], data[i + 1], data[i + 2]) });
  }
  if (pixels.length < 20) return null;
  const left = Math.min(...pixels.map((p) => p.x));
  const top = Math.min(...pixels.map((p) => p.y));
  const pw = Math.max(...pixels.map((p) => p.x)) + 1 - left;
  const ph = Math.max(...pixels.map((p) => p.y)) + 1 - top;
  // Fit the longer side into the grid, the shorter one in the middle (the shape keeps its proportions).
  const scale = Math.max(pw, ph) / SIZE;
  const dx = (SIZE - pw / scale) / 2;
  const dy = (SIZE - ph / scale) / 2;
  const bright = pixels.map((p) => p.v).sort((a, b) => a - b);
  const light = bright[Math.floor(bright.length * 0.9)] || 1;
  const count = new Array(SIZE * SIZE).fill(0);
  const sum = new Array(SIZE * SIZE).fill(0);
  for (const p of pixels) {
    const cx = Math.min(SIZE - 1, Math.floor((p.x - left) / scale + dx));
    const cy = Math.min(SIZE - 1, Math.floor((p.y - top) / scale + dy));
    count[cy * SIZE + cx]++;
    sum[cy * SIZE + cx] += Math.min(1, p.v / light);
  }
  const full = scale * scale;
  return {
    cover: count.map((n) => Math.min(1, n / full)),
    shade: sum.map((s, k) => (count[k] ? s / count[k] : 0)),
    ratio: Math.round((pw / ph) * 100) / 100,
  };
}

// A cut-out ↔ a reference (stored as digit strings, see Ref).
/** @param {CutOut} cut @returns {{ cells: string[], light: string[] }} */
export function toRef(cut) {
  const digits = (/** @type {number[]} */ list) => Array.from({ length: SIZE }, (_, r) =>
    list.slice(r * SIZE, (r + 1) * SIZE).map((n) => Math.min(9, Math.round(n * 9))).join(''));
  return { cells: digits(cut.cover), light: digits(cut.shade) };
}
/** @param {{ cells: string[], light: string[] }} ref @returns {CutOut} */
export function fromRef(ref) {
  const numbers = (/** @type {string[]} */ rows) => rows.join('').split('').map((d) => Number(d) / 9);
  return { cover: numbers(ref.cells), shade: numbers(ref.light), ratio: 0 };
}

// How alike two cut-outs are, 0–1: half silhouette overlap (shared cover over all cover), half the light and
// dark pattern inside it (cosine of cover × lightness, centred so dark sides count).
/** @param {CutOut} a @param {CutOut} b */
export function likeness(a, b) {
  let both = 0;
  let any = 0;
  for (let k = 0; k < a.cover.length; k++) {
    both += Math.min(a.cover[k], b.cover[k]);
    any += Math.max(a.cover[k], b.cover[k]);
  }
  const pattern = (/** @type {CutOut} */ c) => c.cover.map((n, k) => n * (c.shade[k] - 0.6));
  const shade = Math.max(0, cosine(pattern(a), pattern(b)));
  return (any ? both / any : 0) / 2 + shade / 2;
}

// One cut-out → the candidate names, best first, each with the score (0–1, 3 decimals) of its closest reference.
// A name without references (or a missing cut-out) scores 0.
/** @param {CutOut | null} cut @param {string[]} names @param {Ref[]} refs @returns {{ name: string, score: number }[]} */
export function rankByRefs(cut, names, refs) {
  return names.map((name) => {
    const own = refs.filter((r) => r.piece === name);
    const score = cut && own.length ? Math.max(...own.map((r) => likeness(cut, fromRef(r)))) : 0;
    return { name, score: Math.round(score * 1000) / 1000 };
  }).sort((a, b) => b.score - a.score);
}

/**
 * Several pictures, each with options (best first): the pick of one option per picture with the highest total
 * score that `ok` accepts (e.g. "the cubes add up", "no piece twice"). Returns the index picked per picture, or
 * null when no pick is accepted. Tries every pick: keep it to a few pictures with a few options each.
 * @param {{ options: { name: string, score: number }[] }[]} reads @param {(names: string[]) => boolean} ok
 * @returns {number[] | null}
 */
export function bestCombination(reads, ok) {
  /** @type {{ picks: number[], total: number } | null} */
  let best = null;
  const walk = (/** @type {number} */ k, /** @type {number[]} */ picks, /** @type {number} */ total) => {
    if (k === reads.length) {
      const names = picks.map((p, i) => reads[i].options[p].name);
      if (ok(names) && (!best || total > best.total)) best = { picks, total };
      return;
    }
    reads[k].options.forEach((o, p) => walk(k + 1, [...picks, p], total + o.score));
  };
  walk(0, [], 0);
  return /** @type {{ picks: number[], total: number } | null} */ (best)?.picks ?? null;
}

// Reference cut-outs from a JSON file ({ "refs": [...] }), loaded once per URL. [] when it cannot be loaded.
/** @type {Map<string, Promise<Ref[]>>} */
const loading = new Map();
/** @param {URL} url @returns {Promise<Ref[]>} */
export function loadRefs(url) {
  if (!loading.has(url.href)) {
    loading.set(url.href, (async () => {
      try {
        const text = url.protocol === 'file:'
          ? (await import('node:fs')).readFileSync(url, 'utf8') // Node (tests): fetch cannot read files
          : await (await fetch(url)).text();
        return JSON.parse(text).refs ?? [];
      } catch (err) {
        console.warn('refs:', url.href, err);
        return [];
      }
    })());
  }
  return /** @type {Promise<Ref[]>} */ (loading.get(url.href));
}
