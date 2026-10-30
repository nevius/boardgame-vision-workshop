// @ts-check
// Building block "pieces3d": find coloured 3D pieces on a table and name them by their shape against a
// catalogue (issue #37, from Ubongo). No models, plain JavaScript on the picture's pixels, so it runs the same in
// the browser and in Node tests.
//
//   const catalogue = pieceCatalogue({ red2: { color: 'red', cubes: [[0, 0, 0], …] }, … });
//   const blobs = findBlobs(frame, cardCorners, cellPixels, { colors: new Set(['red']), colorOf: colorName });
//   const named = nameBlobs(blobs, catalogue, tableCamera(frame, cellPixels));   // [{ name: 'red2' | '?', score }]
//
// How it works:
//   1. Blobs: pixels of a piece colour outside the card (sampled on a coarse grid), white balanced with the card.
//      A blob touching the picture's edge is skipped (a hand or a cut-off piece). A blob too big for one piece
//      is split where it is thinnest (distance to the blob's edge, then growing from the thick parts).
//   2. Top or side: inside a blob, light pixels are top faces, darker pixels side faces.
//   3. Match: every turn of every piece of that colour is drawn the way the camera would see it: each column of
//      cubes as a top square raised by its height (a raised square sits further from the picture's middle) plus
//      its sides. The drawing that covers the blob best (same pixels, same top/side) wins, with a score 0–1.
// Used by games/ubongo.js. Limits: pieces must be one strong colour each and lie apart from the card; pieces of one
// colour that look alike from above are easy to mix up (see firstWorking in engine/cover.js); 3–8 cubes per piece.

import { orientations } from './cover.js';

/** @typedef {import('./types.js').Frame} Frame */
/** @typedef {{ x: number, y: number }} Point */
/**
 * A blob on the coarse grid: labels per sample (0 = empty, 1 = top face, 2 = side face), its box in samples,
 * the colour word and the sample size in picture pixels.
 * @typedef {{ color: string, step: number, left: number, top: number, width: number, height: number,
 *   labels: Uint8Array, count: number }} Blob
 */
/** @typedef {{ r: number, c: number, h: number }[]} Columns  one entry per square seen from above, h = cubes high */
/** @typedef {{ x: number, y: number, angle: number }} Pose  x, y: middle of the footprint in pixels, angle in radians */
/** @typedef {{ middle: Point, height: number, cell: number }} Camera  height: camera above the table, in cubes */

// A blob counts only above this share of the score; below it the piece is '?'.
export const MATCH_LIMIT = 0.55;

/**
 * The catalogue for nameBlobs: every piece with all its turns as seen from above. Make it once and keep it.
 * @param {Record<string, { color: string, cubes: number[][] }>} pieces name → colour word and cubes [layer, row, col]
 * @returns {{ name: string, color: string, turns: Columns[] }[]}
 */
export function pieceCatalogue(pieces) {
  return Object.entries(pieces).map(([name, p]) => ({ name, color: p.color, turns: standingTurns(orientations(p.cubes)) }));
}

// The camera for nameBlobs: straight above the picture's middle; its height in cubes from a typical phone lens
// (focal length about 0.6 × the picture's diagonal) and the size of one square (one cube) in picture pixels.
/** @param {{ width: number, height: number }} frame @param {number} cellPixels @returns {Camera} */
export function tableCamera(frame, cellPixels) {
  return { middle: { x: frame.width / 2, y: frame.height / 2 }, height: (0.6 * Math.hypot(frame.width, frame.height)) / cellPixels, cell: cellPixels };
}

/**
 * Blobs of piece colours outside the card.
 * @param {Frame} frame
 * @param {Point[]} card corners of the card in the picture
 * @param {number} cellPixels side of one square (one cube) in picture pixels
 * @param {{ colors: Set<string>, colorOf: (rgb: { r: number, g: number, b: number }) => string, gains?: number[] }} options
 * @returns {Blob[]}
 */
export function findBlobs(frame, card, cellPixels, { colors, colorOf, gains = [1, 1, 1] }) {
  const step = Math.max(2, Math.round(cellPixels / 8));
  const w = Math.floor(frame.width / step);
  const h = Math.floor(frame.height / step);
  const d = frame.data;
  const mid = { x: card.reduce((s, p) => s + p.x, 0) / 4, y: card.reduce((s, p) => s + p.y, 0) / 4 };
  const bigCard = card.map((p) => ({ x: mid.x + (p.x - mid.x) * 1.04, y: mid.y + (p.y - mid.y) * 1.04 }));
  /** @type {(string | null)[]} */
  const label = new Array(w * h).fill(null);
  const bright = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const px = x * step + step / 2;
    const py = y * step + step / 2;
    if (inside({ x: px, y: py }, bigCard)) continue;
    const i = (Math.floor(py) * frame.width + Math.floor(px)) * 4;
    const r = Math.min(255, d[i] * gains[0]);
    const g = Math.min(255, d[i + 1] * gains[1]);
    const b = Math.min(255, d[i + 2] * gains[2]);
    const name = colorOf({ r, g, b });
    if (colors.has(name) && Math.max(r, g, b) - Math.min(r, g, b) > 70) {
      label[y * w + x] = name;
      bright[y * w + x] = Math.max(r, g, b);
    }
  }
  // Cube edges shine (light, little colour): a sample between two samples of one colour gets that colour.
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const k = y * w + x;
    if (label[k]) continue;
    const pair = [[k - 1, k + 1], [k - w, k + w], [k - 2, k + 1], [k - 1, k + 2], [k - 2 * w, k + w], [k - w, k + 2 * w]]
      .find(([a, b]) => a >= 0 && b < w * h && label[a] && label[a] === label[b]);
    if (pair) { label[k] = label[pair[0]]; bright[k] = Math.max(bright[pair[0]], bright[pair[1]]); }
  }
  /** @type {Blob[]} */
  const blobs = [];
  const seen = new Uint8Array(w * h);
  for (let start = 0; start < w * h; start++) {
    if (!label[start] || seen[start]) continue;
    const color = label[start];
    const members = [];
    const stack = [start];
    seen[start] = 1;
    let edge = false;
    while (stack.length) {
      const k = /** @type {number} */ (stack.pop());
      members.push(k);
      const x = k % w;
      const y = (k - x) / w;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge = true;
      for (const n of [y > 0 ? k - w : -1, y < h - 1 ? k + w : -1, x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1]) {
        if (n >= 0 && !seen[n] && label[n] === color) { seen[n] = 1; stack.push(n); }
      }
    }
    // Specks under 1.5 squares are noise; blobs at the picture's edge are hands or cut-off pieces.
    if (edge || (members.length * step * step) / (cellPixels * cellPixels) < 1.5) continue;
    blobs.push(makeBlob(color, step, w, members, bright));
  }
  return blobs;
}

// A blob from its sample indexes: box, and top (light) or side (dark) per sample by a two-class split
// (Otsu) of the brightness. Without a clear split (a flat piece, a drawn picture) every sample is top.
/** @param {string} color @param {number} step @param {number} w @param {number[]} members @param {Float32Array} bright */
function makeBlob(color, step, w, members, bright) {
  const xs = members.map((k) => k % w);
  const ys = members.map((k) => Math.floor(k / w));
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const width = Math.max(...xs) - left + 1;
  const height = Math.max(...ys) - top + 1;
  const values = members.map((k) => bright[k]);
  const cut = otsu(values);
  const labels = new Uint8Array(width * height);
  members.forEach((k, i) => { labels[(ys[i] - top) * width + xs[i] - left] = cut !== null && values[i] < cut ? 2 : 1; });
  return { color, step, left, top, width, height, labels, count: members.length };
}

// The best brightness cut between two groups, or null when the groups are too close (less than 25 apart).
/** @param {number[]} values @returns {number | null} */
export function otsu(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const total = sorted.reduce((s, v) => s + v, 0);
  let best = -1;
  let cut = null;
  let low = 0;
  for (let i = 1; i < sorted.length; i++) {
    low += sorted[i - 1];
    if (sorted[i] === sorted[i - 1]) continue;
    const a = low / i;
    const b = (total - low) / (sorted.length - i);
    const between = i * (sorted.length - i) * (b - a) * (b - a);
    if (between > best && b - a >= 25) { best = between; cut = (sorted[i - 1] + sorted[i]) / 2; }
  }
  return cut;
}

// A blob bigger than maxSquares squares is two or more pieces touching: split it at its thin places.
// Distance to the blob's edge (in samples); the thick parts (more than half a square from the edge) are seeds,
// then every sample joins the seed it reaches first (a simple watershed). Returns the parts (or the blob).
/** @param {Blob} blob @param {number} cellPixels @param {number} maxSquares @returns {Blob[]} */
export function splitBlob(blob, cellPixels, maxSquares) {
  const squares = (blob.count * blob.step * blob.step) / (cellPixels * cellPixels);
  if (squares <= maxSquares + 1) return [blob];
  const { width, height, labels } = blob;
  const dist = distanceToEdge(labels, width, height);
  const deepest = Math.max(...dist);
  const seed = new Int32Array(width * height).fill(-1);
  let seeds = 0;
  // Seeds: groups of samples deeper than 60 % of the deepest point.
  for (let k = 0; k < width * height; k++) {
    if (seed[k] >= 0 || dist[k] < deepest * 0.6) continue;
    const stack = [k];
    seed[k] = seeds;
    while (stack.length) {
      const j = /** @type {number} */ (stack.pop());
      for (const n of neighbours(j, width, height)) {
        if (seed[n] < 0 && dist[n] >= deepest * 0.6) { seed[n] = seeds; stack.push(n); }
      }
    }
    seeds++;
  }
  if (seeds < 2) return [blob];
  // Grow all seeds together, deepest samples first.
  const order = [...labels.keys()].filter((k) => labels[k] && seed[k] < 0).sort((a, b) => dist[b] - dist[a]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const k of order) {
      if (seed[k] >= 0) continue;
      const n = neighbours(k, width, height).find((j) => seed[j] >= 0);
      if (n !== undefined) { seed[k] = seed[n]; changed = true; }
    }
  }
  /** @type {Blob[]} */
  const parts = [];
  for (let s = 0; s < seeds; s++) {
    const part = new Uint8Array(width * height);
    let count = 0;
    for (let k = 0; k < width * height; k++) if (seed[k] === s) { part[k] = labels[k]; count++; }
    parts.push({ ...blob, labels: part, count });
  }
  return parts;
}

/** @param {number} k @param {number} w @param {number} h @returns {number[]} */
function neighbours(k, w, h) {
  const x = k % w;
  const out = [];
  if (k >= w) out.push(k - w);
  if (k < w * (h - 1)) out.push(k + w);
  if (x > 0) out.push(k - 1);
  if (x < w - 1) out.push(k + 1);
  return out;
}

// Steps to the nearest empty sample (city-block distance), 0 outside the blob.
/** @param {Uint8Array} labels @param {number} w @param {number} h */
function distanceToEdge(labels, w, h) {
  const big = w + h;
  const dist = new Float32Array(w * h);
  for (let k = 0; k < w * h; k++) dist[k] = labels[k] ? big : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x;
    if (!dist[k]) continue;
    dist[k] = Math.min(dist[k], x > 0 ? dist[k - 1] + 1 : 1, y > 0 ? dist[k - w] + 1 : 1);
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const k = y * w + x;
    if (!dist[k]) continue;
    dist[k] = Math.min(dist[k], x < w - 1 ? dist[k + 1] + 1 : 1, y < h - 1 ? dist[k + w] + 1 : 1);
  }
  return dist;
}

// The columns of one turn of a piece seen from above: each square with how many cubes high it is.
/** @param {number[][]} cubes [layer, row, col] @returns {Columns} */
export function columnsOf(cubes) {
  const high = new Map();
  for (const [l, r, c] of cubes) high.set(`${r},${c}`, Math.max(high.get(`${r},${c}`) ?? 0, l + 1));
  return [...high].map(([key, h]) => {
    const [r, c] = key.split(',').map(Number);
    return { r, c, h };
  });
}

// The different column sets of all turns (turns that look the same from above count once).
/** @param {number[][][]} turns @returns {Columns[]} */
export function standingTurns(turns) {
  const seen = new Map();
  for (const turn of turns) {
    const cols = columnsOf(turn).sort((a, b) => a.r - b.r || a.c - b.c);
    seen.set(JSON.stringify(cols), cols);
  }
  return [...seen.values()];
}

// Draws one turn of a piece the way the camera sees it, on the blob's grid: 1 = top face, 2 = side face.
// Each column: its sides (the hull of the square on the table and the raised square), then its top;
// lower columns first, so higher ones cover them.
/** @param {Columns} cols @param {Pose} pose @param {Camera} cam @param {Blob} blob @returns {Uint8Array} */
export function render(cols, pose, cam, blob) {
  const out = new Uint8Array(blob.width * blob.height);
  const { cell } = cam;
  const cos = Math.cos(pose.angle);
  const sin = Math.sin(pose.angle);
  const rows = Math.max(...cols.map((q) => q.r)) + 1;
  const colsN = Math.max(...cols.map((q) => q.c)) + 1;
  const { height } = cam;
  // A table point (in squares, from the footprint's middle) at z cubes high → blob grid coordinates.
  const at = (u, v, z) => {
    const px = pose.x + (u * cos - v * sin) * cell;
    const py = pose.y + (u * sin + v * cos) * cell;
    const s = height / (height - z);
    return {
      x: (cam.middle.x + (px - cam.middle.x) * s) / blob.step - blob.left - 0.5,
      y: (cam.middle.y + (py - cam.middle.y) * s) / blob.step - blob.top - 0.5,
    };
  };
  for (const q of [...cols].sort((a, b) => a.h - b.h)) {
    const u = q.c - colsN / 2;
    const v = q.r - rows / 2;
    const square = (z) => [at(u, v, z), at(u + 1, v, z), at(u + 1, v + 1, z), at(u, v + 1, z)];
    const low = square(0);
    const high = square(q.h);
    fill(out, blob.width, blob.height, hull([...low, ...high]), 2);
    fill(out, blob.width, blob.height, high, 1);
  }
  return out;
}

// How well a drawing covers a blob, 0–1: shared pixels over all pixels of both, a bit more when top and side agree.
/** @param {Uint8Array} drawn @param {Uint8Array} seen */
export function overlap(drawn, seen) {
  let both = 0;
  let either = 0;
  let same = 0;
  for (let k = 0; k < seen.length; k++) {
    if (drawn[k] && seen[k]) { both++; if (drawn[k] === seen[k]) same++; }
    if (drawn[k] || seen[k]) either++;
  }
  return either ? (both / either) * (0.75 + (0.25 * same) / Math.max(1, both)) : 0;
}

/**
 * The best pose of one piece (all its turns) on a blob: { score, pose, cols }.
 * @param {Blob} blob @param {Columns[]} turns @param {Camera} cam
 */
export function matchBlob(blob, turns, cam) {
  // Start: the footprint's middle on the blob's middle, moved back by where the drawing's middle lands.
  let sx = 0;
  let sy = 0;
  for (let k = 0; k < blob.labels.length; k++) if (blob.labels[k]) { sx += k % blob.width; sy += Math.floor(k / blob.width); }
  const middle = { x: (blob.left + sx / blob.count + 0.5) * blob.step, y: (blob.top + sy / blob.count + 0.5) * blob.step };
  /** @type {{ score: number, pose: Pose, cols: Columns }[]} */
  const tries = [];
  for (const cols of turns) {
    for (let a = 0; a < 90; a += 7.5) {
      let pose = { x: middle.x, y: middle.y, angle: (a * Math.PI) / 180 };
      const drawn = render(cols, pose, cam, blob);
      const shift = centreOf(drawn, blob);
      if (shift) pose = { ...pose, x: pose.x + middle.x - shift.x, y: pose.y + middle.y - shift.y };
      tries.push({ score: overlap(render(cols, pose, cam, blob), blob.labels), pose, cols });
    }
  }
  tries.sort((a, b) => b.score - a.score);
  // Refine the best few: small moves and turns while the score grows.
  let best = tries[0];
  for (const start of tries.slice(0, 4)) {
    let cur = start;
    const move = blob.step;
    for (let round = 0; round < 12; round++) {
      const steps = [[move, 0, 0], [-move, 0, 0], [0, move, 0], [0, -move, 0], [0, 0, 0.04], [0, 0, -0.04]];
      let better = null;
      for (const [dx, dy, da] of steps) {
        const pose = { x: cur.pose.x + dx, y: cur.pose.y + dy, angle: cur.pose.angle + da };
        const score = overlap(render(cur.cols, pose, cam, blob), blob.labels);
        if (score > (better ?? cur).score) better = { score, pose, cols: cur.cols };
      }
      if (!better) break;
      cur = better;
    }
    if (cur.score > best.score) best = cur;
  }
  return best;
}

// The middle of a drawing, in picture pixels (null when nothing is drawn on the blob's grid).
/** @param {Uint8Array} drawn @param {Blob} blob */
function centreOf(drawn, blob) {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let k = 0; k < drawn.length; k++) if (drawn[k]) { sx += k % blob.width; sy += Math.floor(k / blob.width); n++; }
  return n ? { x: (blob.left + sx / n + 0.5) * blob.step, y: (blob.top + sy / n + 0.5) * blob.step } : null;
}

// Fills a convex polygon (grid coordinates) with value v.
/** @param {Uint8Array} out @param {number} w @param {number} h @param {Point[]} poly @param {number} v */
function fill(out, w, h, poly, v) {
  const x0 = Math.max(0, Math.floor(Math.min(...poly.map((p) => p.x))));
  const x1 = Math.min(w - 1, Math.ceil(Math.max(...poly.map((p) => p.x))));
  const y0 = Math.max(0, Math.floor(Math.min(...poly.map((p) => p.y))));
  const y1 = Math.min(h - 1, Math.ceil(Math.max(...poly.map((p) => p.y))));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inside({ x, y }, poly)) out[y * w + x] = v;
}

// The convex hull of some points, in order around.
/** @param {Point[]} points @returns {Point[]} */
function hull(points) {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper = [];
  for (const q of p.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** @param {Point} p @param {Point[]} poly */
function inside(p, poly) {
  let yes = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) yes = !yes;
  }
  return yes;
}

/**
 * Names the blobs: each blob gets a piece of its colour by the 3D match, each piece once, so that the scores add
 * up to the most; '?' when no piece matches well enough (score under MATCH_LIMIT).
 * @param {Blob[]} blobs
 * @param {{ name: string, color: string, turns: Columns[] }[]} catalogue
 * @param {Camera} cam
 * @returns {{ name: string, score: number, options: { name: string, score: number }[] }[]}  options: every piece
 *   that matches the blob well enough, best first
 */
export function nameBlobs(blobs, catalogue, cam) {
  const scores = blobs.map((blob) => catalogue
    .filter((p) => p.color === blob.color)
    .map((p) => ({ name: p.name, score: Math.round(matchBlob(blob, p.turns, cam).score * 100) / 100 }))
    .filter((p) => p.score >= MATCH_LIMIT));
  // Per colour, try every way to hand out its pieces (a few blobs, a few pieces), keep the best total.
  /** @type {{ name: string, score: number }[]} */
  const named = blobs.map(() => ({ name: '?', score: 0 }));
  for (const color of new Set(blobs.map((b) => b.color))) {
    const group = blobs.map((b, i) => i).filter((i) => blobs[i].color === color);
    let best = { total: -1, names: /** @type {{ name: string, score: number }[]} */ ([]) };
    const pick = (g, used, total, names) => {
      if (g === group.length) {
        if (total > best.total) best = { total, names };
        return;
      }
      pick(g + 1, used, total, [...names, { name: '?', score: 0 }]);
      for (const s of scores[group[g]]) if (!used.has(s.name)) pick(g + 1, new Set([...used, s.name]), total + s.score, [...names, s]);
    };
    pick(0, new Set(), 0, []);
    group.forEach((i, g) => { named[i] = best.names[g]; });
  }
  return named.map((n, i) => ({ ...n, options: [...scores[i]].sort((a, b) => b.score - a.score) }));
}
