// @ts-check
// Draws the app icons (issue #151) into icons/: a dark tile with a 3×3 board, one cell lit up (the suggested
// move). Run once after a design change: `node scripts/icons.js`. The PNGs are committed; the page never runs this.
// "maskable" = the board sits inside the middle 80 % (Android cuts the corners into a circle or a squircle).
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pngjs from 'pngjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const BG = [10, 10, 10];        // neutral-950, same as the manifest background_color
const CELL = [64, 64, 64];      // neutral-700
const MOVE = [14, 165, 233];    // sky-500

// The files: name, size in px, how much of the side the board covers.
export const ICONS = [
  { file: 'icon-192.png', size: 192, board: 0.72 },
  { file: 'icon-512.png', size: 512, board: 0.72 },
  { file: 'icon-maskable-512.png', size: 512, board: 0.56 },
  { file: 'apple-touch-icon.png', size: 180, board: 0.66 },
];

/** The colour at (x, y) in a 0..1 square. @param {number} x @param {number} y @param {number} board */
function colorAt(x, y, board) {
  const start = (1 - board) / 2;
  const gap = board * 0.06;
  const cell = (board - 2 * gap) / 3;
  const radius = cell * 0.18;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const x0 = start + col * (cell + gap);
      const y0 = start + row * (cell + gap);
      const dx = Math.max(x0 + radius - x, 0, x - (x0 + cell - radius));
      const dy = Math.max(y0 + radius - y, 0, y - (y0 + cell - radius));
      if (dx * dx + dy * dy <= radius * radius) return row === 1 && col === 2 ? MOVE : CELL;
    }
  }
  return BG;
}

/** One icon, 4×4 samples per pixel for smooth edges. @param {number} size @param {number} board */
export function drawIcon(size, board) {
  const png = new pngjs.PNG({ width: size, height: size });
  const n = 4;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sum = [0, 0, 0];
      for (let sy = 0; sy < n; sy++) {
        for (let sx = 0; sx < n; sx++) {
          const c = colorAt((x + (sx + 0.5) / n) / size, (y + (sy + 0.5) / n) / size, board);
          for (let i = 0; i < 3; i++) sum[i] += c[i];
        }
      }
      const at = (y * size + x) * 4;
      for (let i = 0; i < 3; i++) png.data[at + i] = Math.round(sum[i] / (n * n));
      png.data[at + 3] = 255;
    }
  }
  return pngjs.PNG.sync.write(png);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const icon of ICONS) writeFileSync(join(root, 'icons', icon.file), drawIcon(icon.size, icon.board));
  console.log(`wrote ${ICONS.length} icons into icons/`);
}
