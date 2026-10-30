// Cut a straight board image into tiles, and simple colour helpers. Pure code, no libraries,
// so it runs in the browser and in Node tests. Recognising tiles is in engine/fewshot.js.
//
//   const board = await engine.straighten(frame, corners, 600, 600);
//   const tiles = engine.cutTiles(board, { rows: 8, cols: 8, margin: 0.1 });  // tiles[row][col]
//   const color = engine.dominantColor(tiles[0][0]);                           // { r, g, b, name }
import { recordStep } from './steps.js';

// Split a straight board image into rows × cols tiles. Returns ImageData[][] (tiles[row][col]).
// Call it as cutTiles(board, rows, cols, margin) or cutTiles(board, { rows, cols, margin }).
// margin: share of each tile to cut away on every side (0.1 = 10 %), so grid lines and
// neighbours do not leak into the tile.
export function cutTiles(board, rows, cols, margin = 0) {
  if (typeof rows === 'object') ({ rows, cols, margin = 0 } = rows);
  if (!(rows >= 1 && cols >= 1)) throw new Error('cutTiles: rows and cols must be 1 or more');
  const tileW = board.width / cols;
  const tileH = board.height / rows;
  const tiles = [];
  const boxes = [];
  for (let row = 0; row < rows; row++) {
    const line = [];
    for (let col = 0; col < cols; col++) {
      const box = {
        x: (col + margin) * tileW,
        y: (row + margin) * tileH,
        width: tileW * (1 - 2 * margin),
        height: tileH * (1 - 2 * margin),
      };
      boxes.push(box);
      line.push(cropImage(board, box));
    }
    tiles.push(line);
  }
  recordStep('tiles', board, { boxes }); // Steps view: the board with the tile boxes on it
  return tiles;
}

// Cut a list of boxes [{ x, y, width, height }] (in pixels) out of an image. Returns ImageData[].
// Use it when the pieces are not on a grid, for example cards found with engine.findCards.
export function cropTiles(image, boxes) {
  recordStep('tiles', image, { boxes }); // Steps view
  return boxes.map((box) => cropImage(image, box));
}

// One box out of an image. The box is rounded to whole pixels and kept inside the image.
export function cropImage(image, { x, y, width, height }) {
  const left = clamp(Math.round(x), 0, image.width - 1);
  const top = clamp(Math.round(y), 0, image.height - 1);
  const w = clamp(Math.round(x + width), left + 1, image.width) - left;
  const h = clamp(Math.round(y + height), top + 1, image.height) - top;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let row = 0; row < h; row++) {
    const start = ((top + row) * image.width + left) * 4;
    data.set(image.data.subarray(start, start + w * 4), row * w * 4);
  }
  return makeImageData(data, w, h);
}

// The most common colour of a tile: { r, g, b, name }. Every pixel gets a colour word (see colorName);
// the word with the most pixels wins, and r, g, b is the average of those pixels.
// options.ignore: colour words to skip, e.g. ['white'] to skip the paper around a symbol.
export function dominantColor(tile, { ignore = [] } = {}) {
  const groups = new Map();
  const { data } = tile;
  for (let i = 0; i < data.length; i += 4) {
    const color = { r: data[i], g: data[i + 1], b: data[i + 2] };
    const name = colorName(color);
    if (ignore.includes(name)) continue;
    let group = groups.get(name);
    if (!group) groups.set(name, (group = { r: 0, g: 0, b: 0, count: 0 }));
    group.r += color.r;
    group.g += color.g;
    group.b += color.b;
    group.count++;
  }
  if (groups.size === 0) return null;
  const [name, g] = [...groups.entries()].reduce((a, b) => (b[1].count > a[1].count ? b : a));
  return { r: Math.round(g.r / g.count), g: Math.round(g.g / g.count), b: Math.round(g.b / g.count), name };
}

// The average colour of a tile: { r, g, b, name }.
export function averageColor(tile) {
  const { data } = tile;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  const n = data.length / 4;
  const color = { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
  return { ...color, name: colorName(color) };
}

// A plain colour word for { r, g, b }: black, white, gray, red, orange, yellow, green, cyan, blue, purple, pink.
export function colorName({ r, g, b }) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const light = (max + min) / 2 / 255;
  const saturation = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));
  if (light < 0.15) return 'black';
  if (saturation < 0.2 || max - min < 40) return light > 0.75 ? 'white' : light < 0.3 ? 'black' : 'gray';
  let hue;
  if (max === r) hue = ((g - b) / (max - min) + 6) % 6;
  else if (max === g) hue = (b - r) / (max - min) + 2;
  else hue = (r - g) / (max - min) + 4;
  hue *= 60;
  if (hue < 15 || hue >= 330) return light > 0.7 ? 'pink' : 'red';
  if (hue < 40) return 'orange';
  if (hue < 70) return 'yellow';
  if (hue < 165) return 'green';
  if (hue < 200) return 'cyan';
  if (hue < 260) return 'blue';
  if (hue < 300) return 'purple';
  return 'pink';
}

// A tiny embedding without any model: the tile shrunk to size × size pixels, as RGB numbers.
// Good enough for plain colour symbols, and used by the unit tests (MediaPipe needs a browser).
// engine.embed (MediaPipe) is the real one; both work with matchTile.
export function pixelEmbedding(tile, size = 8) {
  const out = new Array(size * size * 3).fill(0);
  const counts = new Array(size * size).fill(0);
  const { data, width, height } = tile;
  for (let y = 0; y < height; y++) {
    const cellY = Math.min(size - 1, Math.floor((y * size) / height));
    for (let x = 0; x < width; x++) {
      const cell = cellY * size + Math.min(size - 1, Math.floor((x * size) / width));
      const i = (y * width + x) * 4;
      out[cell * 3] += data[i];
      out[cell * 3 + 1] += data[i + 1];
      out[cell * 3 + 2] += data[i + 2];
      counts[cell]++;
    }
  }
  // Centre the values around 0, so cosine similarity tells dark from light.
  return out.map((sum, i) => sum / Math.max(1, counts[Math.floor(i / 3)]) / 255 - 0.5);
}

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

// ImageData in the browser; a plain object with the same fields elsewhere (tests in Node).
function makeImageData(data, width, height) {
  if (typeof ImageData !== 'undefined') return new ImageData(data, width, height);
  return { width, height, data };
}
