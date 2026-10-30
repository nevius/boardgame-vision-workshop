// Find the board or cards in the picture and straighten them. Uses OpenCV.js (loaded once, on first use).
// Corners are always ordered top-left, top-right, bottom-right, bottom-left, in picture pixels.
//
//   const corners = await engine.findBoard(frame);            // one board / sheet / card, or null
//   const board = await engine.straighten(frame, corners, 600, 600);
//   const cards = await engine.findCards(frame);              // many cards: a list of corners
//   const images = await Promise.all(cards.map((c) => engine.straighten(frame, c, 300, 200)));
import { loadOpenCV } from './libs.js';
import { recordStep } from './bench.js';
import { recordStep as recordPicture, stepsOn, grayToPicture } from './steps.js';
import { knob } from './knobs.js';
import {
  orderCorners, polygonArea, isConvex, dropNested, readingOrder, scalePoints, straightSize, bestQuad,
  pointInPolygon, center,
} from './geometry.js';

const WORK_SIZE = 800; // the search runs on a copy whose longest side is at most this many pixels

// Corners tapped by hand (see engine/corners.js). While set, findBoard returns them.
let manualCorners = null;

// Use these corners instead of searching (or pass null to search again).
export function setManualCorners(corners) {
  manualCorners = corners ? orderCorners(corners) : null;
}

export function getManualCorners() {
  return manualCorners;
}

// frame: ImageData. Returns the four corners of the largest four-sided shape, or null if none is seen.
// options.minArea: smallest board, as a share of the picture (0.1 = 10 %).
// options.darkFrame: true = only a board with a dark frame (the print sheets in print.html). Then the
// sheet of paper around it, or the inner edge of the frame, is not taken for the board.
export async function findBoard(frame, { minArea = 0.1, darkFrame = false } = {}) {
  if (manualCorners) {
    recordPicture('found board', frame, { quads: [manualCorners] });
    return manualCorners;
  }
  const quads = (await findQuads(frame, minArea)).sort((a, b) => polygonArea(b) - polygonArea(a));
  let board = null;
  if (!darkFrame) board = quads[0] ?? null;
  else {
    for (const quad of quads.slice(0, 8)) {
      if (hasDarkFrame(await warp(frame, quad, 200, 200))) { board = quad; break; }
    }
  }
  // Steps view: the board in green, the other shapes that were looked at in yellow.
  if (board) recordPicture('found board', frame, { quads: [board, ...quads.filter((q) => q !== board)] });
  return board;
}

// True when a straight 200 × 200 image has a dark band along all four edges (0.5-1.5 % in) and lighter
// paper just inside it (3.5-6 % in). The print sheets' frame is 2.5 % of the side (print.html).
export function hasDarkFrame(image) {
  const size = 200;
  const band = (from, to) => {
    let sum = 0;
    let count = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const edge = Math.min(x, y, size - 1 - x, size - 1 - y);
        if (edge < from || edge > to) continue;
        const i = (y * size + x) * 4;
        sum += image.data[i] + image.data[i + 1] + image.data[i + 2];
        count++;
      }
    }
    return sum / count / 3;
  };
  const frame = band(1, 3);
  return frame < 110 && band(7, 12) > frame * 1.8;
}

// frame: ImageData. Returns a list of corners, one per card, in reading order (rows, left to right).
// options.minArea / maxArea: card size limits as a share of the picture.
// Two searches: bright patches (white cards on a darker table) and outlines (edges). A busy table (carpet,
// wood grain) can glue edges of several cards into one big shape, so outline shapes that overlap a bright
// patch are dropped.
export async function findCards(frame, { minArea = 0.003, maxArea = 0.5 } = {}) {
  const total = frame.width * frame.height;
  const small = (q) => polygonArea(q) <= maxArea * total;
  const bright = dropNested((await findBrightQuads(frame, minArea)).filter(small));
  const overlaps = (q) => bright.some((b) => pointInPolygon(center(q), b) || pointInPolygon(center(b), q));
  const outlines = (await findQuads(frame, minArea)).filter((q) => small(q) && !overlaps(q));
  const cards = dropNested([...bright, ...outlines]);
  recordPicture('found cards', frame, { quads: cards });
  const rowTolerance = Math.sqrt(polygonArea(cards[0] ?? [{ x: 0, y: 0 }])) / 2;
  return readingOrder(cards, rowTolerance);
}

// Returns a straight, top-down ImageData of what lies inside corners, size width × height.
// Leave out width and height to keep the shape's own proportions (longest side 600 pixels).
export async function straighten(frame, corners, width, height) {
  const image = await warp(frame, corners, width, height);
  recordPicture('straightened', image);
  return image;
}

// straighten without the Steps view (the dark-frame check tries several shapes).
async function warp(frame, corners, width, height) {
  if (!width || !height) ({ width, height } = straightSize(orderCorners(corners)));
  const cv = await loadOpenCV();
  const start = performance.now();
  const [tl, tr, br, bl] = orderCorners(corners);
  const src = cv.matFromImageData(frame);
  const from = cv.matFromArray(4, 1, cv.CV_32FC2, [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y]);
  const to = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, width, 0, width, height, 0, height]);
  const matrix = cv.getPerspectiveTransform(from, to);
  const out = new cv.Mat();
  cv.warpPerspective(src, out, matrix, new cv.Size(width, height), cv.INTER_LINEAR, cv.BORDER_REPLICATE);
  const image = makeImageData(new Uint8ClampedArray(out.data), width, height);
  [src, from, to, matrix, out].forEach((m) => m.delete());
  recordStep('warp', performance.now() - start);
  return image;
}

// Debug view: draws the found shapes on the canvas (first one green, the others yellow), with numbers.
export function drawQuads(ctx, quads) {
  ctx.save();
  ctx.lineWidth = Math.max(2, ctx.canvas.width / 300);
  ctx.font = `${Math.max(14, ctx.canvas.width / 40)}px system-ui, sans-serif`;
  quads.forEach((quad, i) => {
    ctx.strokeStyle = ctx.fillStyle = i === 0 ? '#2e2' : '#fc2';
    ctx.beginPath();
    quad.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.stroke();
    ctx.fillText(String(i + 1), quad[0].x + 6, quad[0].y + 20);
  });
  ctx.restore();
}

// All convex four-sided shapes bigger than minArea (share of the picture), in full-picture pixels.
async function findQuads(frame, minArea) {
  const cv = await loadOpenCV();
  const scale = Math.min(1, WORK_SIZE / Math.max(frame.width, frame.height));
  const src = cv.matFromImageData(frame);
  const gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  if (scale < 1) cv.resize(gray, gray, new cv.Size(Math.round(frame.width * scale), Math.round(frame.height * scale)), 0, 0, cv.INTER_AREA);
  cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
  // Edges (thresholds: knobs edgeLow / edgeHigh), thickened a little so small gaps in an outline close.
  const edges = new cv.Mat();
  cv.Canny(gray, edges, knob('edgeLow'), knob('edgeHigh'));
  const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
  cv.dilate(edges, edges, kernel);
  if (stepsOn()) recordPicture('edges', grayToPicture(edges.data, edges.cols, edges.rows));
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

  // For checking a shape's sides: an edge counts if it is within a few pixels.
  const near = new cv.Mat();
  const wide = cv.Mat.ones(7, 7, cv.CV_8U);
  cv.dilate(edges, near, wide);
  const isEdge = (x, y) => x >= 0 && y >= 0 && x < near.cols && y < near.rows && near.data[y * near.cols + x] > 0;
  const minPixels = minArea * gray.rows * gray.cols;
  const quads = [];
  for (let i = 0; i < contours.size(); i++) {
    const contour = contours.get(i);
    if (cv.contourArea(contour) >= minPixels) {
      // Hull first: a dent in the outline (a finger on the board) then does not break the shape.
      const hull = new cv.Mat();
      const approx = new cv.Mat();
      cv.convexHull(contour, hull);
      const perimeter = cv.arcLength(hull, true);
      cv.approxPolyDP(hull, approx, 0.03 * perimeter, true);
      let points = matPoints(approx);
      if (points.length !== 4 || bestQuad(points, isEdge).support < 0.8) {
        // Something sticks out of the shape (a hand, another card): keep the four corners that lie on edges.
        cv.approxPolyDP(hull, approx, 0.01 * perimeter, true);
        const outline = matPoints(approx);
        const found = outline.length <= 12 ? bestQuad(outline, isEdge) : null;
        points = found && found.support >= 0.8 ? found.quad : [];
      }
      if (points.length === 4 && isConvex(points)) quads.push(orderCorners(scalePoints(points, 1 / scale)));
      hull.delete();
      approx.delete();
    }
    contour.delete();
  }
  [src, gray, edges, kernel, near, wide, contours, hierarchy].forEach((m) => m.delete());
  return quads;
}

// Bright four-sided patches (cards on a darker table), in full-picture pixels. The picture is split into
// light and dark with Otsu's method (it picks the threshold itself), thin bridges between cards that touch
// are cut, and every patch that fills its four-sided outline well is kept.
// Cards that touch can be glued by a bridge wider than the first cut: a second try cuts wider bridges. It only
// adds patches that do not overlap one found before.
async function findBrightQuads(frame, minArea) {
  const cv = await loadOpenCV();
  const scale = Math.min(1, WORK_SIZE / Math.max(frame.width, frame.height));
  const src = cv.matFromImageData(frame);
  const gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  if (scale < 1) cv.resize(gray, gray, new cv.Size(Math.round(frame.width * scale), Math.round(frame.height * scale)), 0, 0, cv.INTER_AREA);
  cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
  const light = new cv.Mat();
  const split = new cv.Mat();
  cv.threshold(gray, split, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
  const minPixels = minArea * gray.rows * gray.cols;
  const quads = [];
  const overlaps = (q) => quads.some((b) => pointInPolygon(center(q), b) || pointInPolygon(center(b), q));
  for (const cut of BRIGHT_CUTS) {
    const kernel = cv.Mat.ones(cut, cut, cv.CV_8U);
    cv.morphologyEx(split, light, cv.MORPH_OPEN, kernel);
    kernel.delete();
    if (stepsOn() && cut === BRIGHT_CUTS[0]) {
      recordPicture('bright patches', grayToPicture(light.data, light.cols, light.rows));
    }
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(light, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    const found = [];
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);
      if (area >= minPixels) {
        const hull = new cv.Mat();
        const approx = new cv.Mat();
        cv.convexHull(contour, hull);
        cv.approxPolyDP(hull, approx, 0.04 * cv.arcLength(hull, true), true);
        const points = matPoints(approx);
        // A card fills its outline; a patch of light table or two glued cards do not.
        if (points.length === 4 && isConvex(points) && area > 0.85 * polygonArea(points)) {
          found.push(orderCorners(scalePoints(points, 1 / scale)));
        }
        hull.delete();
        approx.delete();
      }
      contour.delete();
    }
    quads.push(...found.filter((q) => !overlaps(q)));
    [contours, hierarchy].forEach((m) => m.delete());
  }
  [src, gray, split, light].forEach((m) => m.delete());
  return quads;
}
// The cuts of findBrightQuads, in order: bridges up to this many pixels wide (at WORK_SIZE) are cut.
const BRIGHT_CUTS = [5, 11];

// The points of an OpenCV contour Mat as [{x, y}, ...].
function matPoints(mat) {
  const points = [];
  for (let k = 0; k < mat.rows; k++) points.push({ x: mat.data32S[2 * k], y: mat.data32S[2 * k + 1] });
  return points;
}

// ImageData in the browser; a plain object with the same fields elsewhere (tests in Node).
function makeImageData(data, width, height) {
  if (typeof ImageData !== 'undefined') return new ImageData(data, width, height);
  return { width, height, data };
}
