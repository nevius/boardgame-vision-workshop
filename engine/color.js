// @ts-check
// Building block "color": white balance from the paper of a card, and colour helpers. Pure, no OpenCV.
// (Colour names themselves: colorName, dominantColor and averageColor in engine/tiles.js.)
//
//   const paper = paperColor(card);                  // [r, g, b] of the white paper, or null (no paper card)
//   const gains = paperGains(card);                  // [r, g, b] factors that make the light paper grey
//   const h = hue(r, g, b);                          // 0–360: red near 0, green near 120, blue near 240
//
// Used by solutions/set.js (paperColor, paperTint, usualPaper, hue) and games/ubongo.js (paperGains).
// Limits: needs a mostly light card (paper) in the picture; strong coloured light still shifts colours.

/** @typedef {import('./types.js').Frame} Frame */

/** @param {number[]} values */
const median = (values) => [...values].sort((a, b) => a - b)[values.length >> 1] ?? 0;

// The paper colour [r, g, b]: the average of the brighter pixels of the inner card (ink is darker than paper;
// the very brightest are left out too, they may be glare). Most of a card is paper. `edge` pixels at the border
// are skipped (rounded corners, a bit of table).
// null when the "paper" is dark or strongly coloured: then this is no paper card (table, card back, box).
/** @param {Frame} image @param {number} [edge] @returns {number[] | null} */
export function paperColor(image, edge = 8) {
  const pixels = [];
  for (let y = edge; y < image.height - edge; y += 2) {
    for (let x = edge; x < image.width - edge; x += 2) {
      const i = (y * image.width + x) * 4;
      pixels.push([image.data[i], image.data[i + 1], image.data[i + 2]]);
    }
  }
  pixels.sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
  const bright = pixels.slice(Math.floor(pixels.length * 0.6), Math.floor(pixels.length * 0.9));
  const paper = [0, 1, 2].map((c) => bright.reduce((sum, p) => sum + p[c], 0) / Math.max(1, bright.length));
  const high = Math.max(...paper);
  const low = Math.min(...paper);
  return high >= 50 && (high - low) / high <= 0.5 ? paper : null;
}

// How different two paper colours are in tint. Light makes white paper look warmer (orange) or cooler
// (blue), but never purple or green; a card back or box does. So only the purple-green tint counts:
// the share of red and blue against the share of green (brightness does not count). 0 = same.
/** @param {number[]} a @param {number[]} b */
export function paperTint(a, b) {
  const purple = (/** @type {number[]} */ [r, g, b]) => ((r + b) / 2 - g) / (r + g + b);
  return Math.abs(purple(a) - purple(b));
}

// The usual paper colour of many cards on one photo: per channel the median (null entries are skipped).
/** @param {(number[] | null)[]} papers @returns {number[] | null} */
export function usualPaper(papers) {
  const known = /** @type {number[][]} */ (papers.filter(Boolean));
  return known.length ? [0, 1, 2].map((c) => median(known.map((p) => p[c]))) : null;
}

// Gains per colour channel that make the light, grey-ish pixels of a straight card grey (white balance),
// each kept within ±20 %. [1, 1, 1] when there are too few light pixels. Multiply a pixel by them.
/** @param {Frame} card @returns {number[]} [r, g, b] gains */
export function paperGains(card) {
  const sum = [0, 0, 0];
  let n = 0;
  const d = card.data;
  for (let i = 0; i < d.length; i += 16) {
    const max = Math.max(d[i], d[i + 1], d[i + 2]);
    if (max < 150 || max - Math.min(d[i], d[i + 1], d[i + 2]) > 80) continue;
    sum[0] += d[i]; sum[1] += d[i + 1]; sum[2] += d[i + 2]; n++;
  }
  if (n < 50) return [1, 1, 1];
  const grey = (sum[0] + sum[1] + sum[2]) / 3;
  return sum.map((s) => Math.min(1.2, Math.max(0.8, grey / s)));
}

// Hue in degrees (0–360) of an r, g, b colour: the angle on the colour wheel (red near 0°, green near 120°,
// blue near 240°). 0 for grey.
/** @param {number} r @param {number} g @param {number} b */
export function hue(r, g, b) {
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? (g - b) / d : max === g ? 2 + (b - r) / d : 4 + (r - g) / d;
  return (h * 60 + 360) % 360;
}

