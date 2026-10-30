// @ts-check
// How a photo sits on the screen (owner 30.10.): it starts zoomed to what the game found (the board, or all the
// cards), with a margin, so the whole board shows as big as possible. Nothing found: the whole photo. Then two
// fingers zoom and move it (pinch). The live camera is not zoomed. Small pure functions, tested in
// tests/view-rules.test.js; app.js puts the result on the picture as a CSS transform.

/** @typedef {{ x: number, y: number }} Point */
/** @typedef {{ x: number, y: number, width: number, height: number }} Box */
/** @typedef {{ scale: number, x: number, y: number }} View  scale around the top left corner, then move by x, y (screen px) */

export const MARGIN = 0.08;     // around the found area: 8 % of its size on each side
export const MIN_SHARE = 0.15;  // a found area smaller than this share of the photo is not zoomed to (likely wrong)
export const MAX_ZOOM = 6;      // pinch: at most 6 × the whole photo
export const NONE = /** @type {View} */ ({ scale: 1, x: 0, y: 0 });

/**
 * The box around the found outlines, with a margin, inside the photo. null: nothing usable was found.
 * @param {Point[][] | null} quads  in photo pixels
 * @param {{ width: number, height: number }} photo
 * @returns {Box | null}
 */
export function foundBox(quads, photo) {
  const points = (quads ?? []).flat().filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y));
  if (points.length < 3 || !(photo.width > 0) || !(photo.height > 0)) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const width = Math.max(...xs) - left;
  const height = Math.max(...ys) - top;
  if (width * height < MIN_SHARE * photo.width * photo.height) return null;
  const x = Math.max(0, left - width * MARGIN);
  const y = Math.max(0, top - height * MARGIN);
  return {
    x, y,
    width: Math.min(photo.width, left + width * (1 + MARGIN)) - x,
    height: Math.min(photo.height, top + height * (1 + MARGIN)) - y,
  };
}

/**
 * The view that shows `box` whole and as big as it fits, centred. The photo itself is shown fitted ("contain") in
 * a screen area of `screen` size; the view scales that area. No box: the whole photo (NONE).
 * @param {Box | null} box  in photo pixels
 * @param {{ width: number, height: number }} photo
 * @param {{ width: number, height: number }} screen  the picture's area on the screen, in CSS px
 * @returns {View}
 */
export function zoomTo(box, photo, screen) {
  if (!box || !(screen.width > 0) || !(screen.height > 0) || !(photo.width > 0) || !(photo.height > 0)) return NONE;
  const fit = Math.min(screen.width / photo.width, screen.height / photo.height);
  const left = (screen.width - photo.width * fit) / 2 + box.x * fit;
  const top = (screen.height - photo.height * fit) / 2 + box.y * fit;
  const scale = Math.max(1, Math.min(MAX_ZOOM, screen.width / (box.width * fit), screen.height / (box.height * fit)));
  const cx = left + (box.width * fit) / 2;
  const cy = top + (box.height * fit) / 2;
  return { scale, x: screen.width / 2 - cx * scale, y: screen.height / 2 - cy * scale };
}

/**
 * One pinch step: two fingers moved from `before` to `after` (screen px, relative to the picture's area). The spot
 * under the fingers' middle stays under it; the distance between them sets the zoom (1 × to MAX_ZOOM ×).
 * @param {View} view @param {[Point, Point]} before @param {[Point, Point]} after
 * @returns {View}
 */
export function pinch(view, before, after) {
  const gap = (/** @type {[Point, Point]} */ [a, b]) => Math.hypot(a.x - b.x, a.y - b.y);
  const mid = (/** @type {[Point, Point]} */ [a, b]) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const g0 = gap(before);
  if (!(g0 > 0)) return view;
  const scale = Math.max(1, Math.min(MAX_ZOOM, view.scale * (gap(after) / g0)));
  const m0 = mid(before);
  const m1 = mid(after);
  // The picture point under m0 before the step stays under m1 after it.
  const px = (m0.x - view.x) / view.scale;
  const py = (m0.y - view.y) / view.scale;
  return scale === 1 ? NONE : { scale, x: m1.x - px * scale, y: m1.y - py * scale };
}

/** The CSS transform for a view (transform-origin: top left). @param {View} view */
export function viewCss(view) {
  return view.scale === 1 && view.x === 0 && view.y === 0 ? '' : `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
}
