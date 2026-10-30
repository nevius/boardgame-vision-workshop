// @ts-check
// Building block "fields": light shapes made of squares, printed on a straight card or board → grids.
// Pure (no OpenCV), so tests can call it. From Ubongo (the light puzzle shapes on its black cards).
//
//   const card = await engine.straighten(frame, corners);
//   const [top, bottom] = findFields(card, 0.128, 2);
//   // top.grid = ['.#..', '####', '##..'] ('#' = a light square), top.area = where it lies (shares 0–1 of the card)
//
// A field = a band of rows with light squares; the thin lines between squares give the size of a square.
// fallbackShare: square size as a share of the card width (all squares on a card have one size); the lines between
// squares only confirm the count.
// Used by games/ubongo.js. Limits: the squares must be light and without much colour on a dark or coloured card;
// 2 to 10 squares per side; the card must be straightened first.

/** @typedef {import('./types.js').Frame} Frame */
/** @typedef {{ left: number, top: number, width: number, height: number }} Area */

// True for a pixel of a shape: light and without much colour (the card around it is coloured or dark).
/** @param {Uint8ClampedArray} d @param {number} i */
function isLight(d, i) {
  const max = Math.max(d[i], d[i + 1], d[i + 2]);
  const min = Math.min(d[i], d[i + 1], d[i + 2]);
  return (d[i] + d[i + 1] + d[i + 2]) / 3 > 150 && max - min < 60;
}

// How far the shape mask looks around a pixel (see shapeMask), in pixels of the straight card.
/** @param {number} width */
const maskReach = (width) => Math.max(2, Math.round(width / 70));

// The shapes' pixels of a straight card as a mask (1 = shape). A pixel counts only when the pixels R to the left,
// right, above and below are light too: the squares are solid, glare on the card's rough print is not.
// So the shape in the mask is R pixels smaller on every side than on the card (readGrid adds it back).
const shapeMasks = new WeakMap();
/** @param {Frame} card @returns {Uint8Array} */
export function shapeMask(card) {
  if (shapeMasks.has(card)) return shapeMasks.get(card);
  const { width: w, height: h, data } = card;
  const R = maskReach(w);
  const light = new Uint8Array(w * h);
  for (let k = 0; k < w * h; k++) light[k] = isLight(data, k * 4) ? 1 : 0;
  const mask = new Uint8Array(w * h);
  for (let y = R; y < h - R; y++) for (let x = R; x < w - R; x++) {
    const k = y * w + x;
    mask[k] = light[k] & light[k - R] & light[k + R] & light[k - R * w] & light[k + R * w];
  }
  shapeMasks.set(card, mask);
  return mask;
}

/**
 * The `count` biggest bands of light squares on a straight card, top to bottom, each read as a grid (readGrid).
 * Bands closer than half a square belong together. A border of 6 % (the card's frame) is skipped.
 * A band whose shape cannot be read comes back with area null and an empty grid (so places stay as they are).
 * @param {Frame} card @param {number} fallbackShare @param {number} [count]
 * @returns {{ area: Area | null, grid: string[] }[]}
 */
export function findFields(card, fallbackShare, count = 2) {
  const { width: w, height: h } = card;
  const mask = shapeMask(card);
  const skip = Math.round(Math.min(w, h) * 0.06);
  const rows = new Float32Array(h);
  for (let y = skip; y < h - skip; y++) for (let x = skip; x < w - skip; x++) rows[y] += mask[y * w + x];
  const gap = fallbackShare * w * 0.5;
  /** @type {number[][]} */
  const bands = [];
  rows.forEach((n, y) => {
    if (n < w * 0.05) return; // less than half a square: glare on the card edge, not a field
    const last = bands[bands.length - 1];
    if (last && y - last[1] < gap) last[1] = y + 1;
    else bands.push([y, y + 1]);
  });
  // The bands with the most light pixels are the fields (a light line or glare is smaller).
  /** @param {number[]} band */
  const light = ([a, b]) => rows.slice(a, b).reduce((sum, n) => sum + n, 0);
  const biggest = bands.filter(([a, b]) => b - a > gap).sort((p, q) => light(q) - light(p)).slice(0, count).sort((p, q) => p[0] - q[0]);
  return biggest.map(([a, b]) => readGrid(card, fallbackShare, Math.max(0, a - skip), Math.min(h, b + skip)));
}

// The straight card → the shape as a grid of squares, and where it lies (area, shares of the card).
// fallbackShare: square size as a share of the card width (see countCells).
// from, to: look only at these rows of the card (one field); default the whole card.
/** @param {Frame} card @param {number} fallbackShare @param {number} [from] @param {number} [to] @returns {{ area: Area | null, grid: string[] }} */
export function readGrid(card, fallbackShare, from = 0, to = card.height) {
  const { width: w, height: h } = card;
  const mask = shapeMask(card);
  const rows = new Float32Array(h);
  const cols = new Float32Array(w);
  // Skip a border of 6 % (the card's frame).
  const skip = Math.round(Math.min(w, h) * 0.06);
  for (let y = Math.max(skip, from); y < Math.min(h - skip, to); y++) for (let x = skip; x < w - skip; x++) {
    if (mask[y * w + x]) { rows[y]++; cols[x]++; }
  }
  const fallback = fallbackShare * w;
  // The shape's box: rows and columns with a fair share of light pixels, in one run around the fullest one.
  // A shape has no empty row or column inside, so light glare further away than half a square is left out.
  const box = (line, size) => {
    const peak = Math.max(...line);
    const on = (i) => line[i] > peak * 0.15 && line[i] > size * 0.02;
    const top = line.indexOf(peak);
    if (!(peak > 0) || !on(top)) return null;
    const reach = (step) => {
      let end = top;
      for (let i = top, gap = 0; i >= 0 && i < line.length && gap <= fallback * 0.5; i += step) {
        if (on(i)) { end = i; gap = 0; } else gap++;
      }
      return end;
    };
    return [reach(-1), reach(1) + 1];
  };
  const found = [box(cols, to - from), box(rows, w)];
  if (!found[0] || !found[1]) return { area: null, grid: [] };
  // The mask is maskReach pixels smaller on every side than the shape on the card.
  const R = maskReach(w);
  const bx = [Math.max(0, found[0][0] - R), Math.min(w, found[0][1] + R)];
  const by = [Math.max(0, found[1][0] - R), Math.min(h, found[1][1] + R)];
  const nx = countCells(cols, bx[0], bx[1], fallback);
  const ny = countCells(rows, by[0], by[1], fallback);
  const cw = (bx[1] - bx[0]) / nx;
  const ch = (by[1] - by[0]) / ny;
  const grid = [];
  for (let r = 0; r < ny; r++) {
    let line = '';
    for (let c = 0; c < nx; c++) {
      // Look at the middle half of the square only.
      let light = 0;
      let all = 0;
      for (let y = Math.round(by[0] + (r + 0.25) * ch); y < by[0] + (r + 0.75) * ch; y++) {
        for (let x = Math.round(bx[0] + (c + 0.25) * cw); x < bx[0] + (c + 0.75) * cw; x++) {
          all++;
          light += mask[y * w + x];
        }
      }
      line += light > all * 0.5 ? '#' : '.';
    }
    grid.push(line);
  }
  return { area: { left: bx[0] / w, top: by[0] / h, width: (bx[1] - bx[0]) / w, height: (by[1] - by[0]) / h }, grid };
}

// How many squares fit between from and to. line[i] = light pixels in row/column i; the thin grid lines between
// squares are dips. Tries 2 … 10 squares and keeps the most squares whose borders all fall on dips (lower than
// the squares on both sides of the border) and whose size is within 15 % of fallback (the expected square, in
// pixels): faint lines or glare can fake a dip. Else: the size / fallback, rounded.
/** @param {ArrayLike<number>} line @param {number} from @param {number} to @param {number} fallback */
export function countCells(line, from, to, fallback) {
  const size = to - from;
  const at = (x) => Math.min(...[-2, -1, 0, 1, 2].map((d) => line[Math.round(x) + d] ?? Infinity));
  const mean = (a, b) => {
    let sum = 0;
    for (let i = Math.round(a); i < Math.round(b); i++) sum += line[i];
    return sum / Math.max(1, Math.round(b) - Math.round(a));
  };
  let best = 0;
  for (let n = 2; n <= 10; n++) {
    const s = size / n;
    if (s < 8) break;
    if (Math.abs(s / fallback - 1) > 0.15) continue;
    let dips = true;
    for (let k = 1; k < n; k++) {
      const x = from + s * k;
      const sides = Math.min(mean(x - s * 0.75, x - s * 0.25), mean(x + s * 0.25, x + s * 0.75));
      if (at(x) > sides * 0.85) dips = false;
    }
    if (dips) best = n;
  }
  return best || Math.max(1, Math.round(size / fallback));
}
