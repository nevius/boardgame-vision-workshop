// Plain geometry for corners and four-sided shapes ("quads"). No OpenCV, no browser: easy to test.
// A point is {x, y} in picture pixels. A quad is four points.

// Puts four corners in a fixed order: top-left, top-right, bottom-right, bottom-left (clockwise on screen).
export function orderCorners(points) {
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  // Sort by angle around the middle. The picture's y axis points down, so this goes clockwise.
  const sorted = [...points].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  // Start at the corner nearest the top-left of the picture.
  let first = 0;
  sorted.forEach((p, i) => { if (p.x + p.y < sorted[first].x + sorted[first].y) first = i; });
  return [...sorted.slice(first), ...sorted.slice(0, first)].map((p) => ({ x: p.x, y: p.y }));
}

// Area of a polygon (shoelace formula). Always positive.
export function polygonArea(points) {
  let sum = 0;
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length];
    sum += p.x * q.y - q.x * p.y;
  });
  return Math.abs(sum) / 2;
}

// True if the polygon has no dents (all turns go the same way).
export function isConvex(points) {
  let sign = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const c = points[(i + 2) % points.length];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (cross === 0) continue;
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  return sign !== 0;
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Good output size for straightening a quad: keeps its shape, longest side = longSide pixels.
// corners must be ordered (see orderCorners).
export function straightSize(corners, longSide = 600) {
  const [tl, tr, br, bl] = corners;
  const w = (distance(tl, tr) + distance(bl, br)) / 2;
  const h = (distance(tl, bl) + distance(tr, br)) / 2;
  const scale = longSide / Math.max(w, h, 1);
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

// Multiplies every point by factor (for example to go from a small working picture back to the full one).
export function scalePoints(points, factor) {
  return points.map((p) => ({ x: p.x * factor, y: p.y * factor }));
}

export function center(points) {
  return {
    x: points.reduce((s, p) => s + p.x, 0) / points.length,
    y: points.reduce((s, p) => s + p.y, 0) / points.length,
  };
}

// True if point p lies inside the polygon.
export function pointInPolygon(p, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

// Drops quads whose middle lies inside a bigger quad (a card's printed frame, a board's inner grid).
export function dropNested(quads) {
  const big = [...quads].sort((a, b) => polygonArea(b) - polygonArea(a));
  const kept = [];
  for (const quad of big) {
    if (!kept.some((k) => pointInPolygon(center(quad), k))) kept.push(quad);
  }
  return kept;
}

// Reading order: top to bottom in rows, left to right inside a row. rowTolerance is in pixels.
export function readingOrder(quads, rowTolerance = 20) {
  const items = quads.map((q) => ({ q, c: center(q) })).sort((a, b) => a.c.y - b.c.y);
  const rows = [];
  for (const item of items) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(item.c.y - row[0].c.y) <= rowTolerance) row.push(item);
    else rows.push([item]);
  }
  return rows.flatMap((row) => row.sort((a, b) => a.c.x - b.c.x).map((item) => item.q));
}

// Turns a pointer position on a (possibly scaled) canvas into canvas pixels.
// rect: canvas.getBoundingClientRect(). size: {width, height} of the canvas in pixels.
// The page shows the canvas with object-fit: contain (the picture fits the box, bars on two sides) or,
// with cover = true, object-fit: cover (the picture fills the box, cut on two sides). Either way it is
// centred in rect.
export function toCanvasPoint(clientX, clientY, rect, size, cover = false) {
  const scale = (cover ? Math.max : Math.min)(rect.width / size.width, rect.height / size.height);
  const left = rect.left + (rect.width - size.width * scale) / 2;
  const top = rect.top + (rect.height - size.height * scale) / 2;
  return { x: (clientX - left) / scale, y: (clientY - top) / scale };
}

// The canvas pixel under a pointer event, for a canvas on the page (reads its place and object-fit).
/** @param {{ clientX: number, clientY: number }} event @param {HTMLCanvasElement} canvas */
export function canvasPoint(event, canvas) {
  const cover = getComputedStyle(canvas).objectFit === 'cover';
  return toCanvasPoint(event.clientX, event.clientY, canvas.getBoundingClientRect(), canvas, cover);
}

// Picks the four of the given outline points (in order around the outline) whose quad best follows real
// edges in the picture. isEdge(x, y) says if there is an edge at that pixel. Helps when a hand or another
// object touches the board: the outline then has extra corners, but the board's own sides are still edges.
// Returns { quad, support } (support: share of the quad's outline that lies on edges) or null.
export function bestQuad(points, isEdge, step = 2) {
  let best = null;
  const n = points.length;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) for (let l = k + 1; l < n; l++) {
    const quad = [points[i], points[j], points[k], points[l]];
    let on = 0;
    let off = 0;
    quad.forEach((a, s) => {
      const b = quad[(s + 1) % 4];
      const count = Math.max(1, Math.round(distance(a, b) / step));
      for (let t = 0; t < count; t++) {
        if (isEdge(Math.round(a.x + ((b.x - a.x) * t) / count), Math.round(a.y + ((b.y - a.y) * t) / count))) on++;
        else off++;
      }
    });
    const score = on - 2 * off;
    if (!best || score > best.score) best = { quad, score, support: on / (on + off) };
  }
  return best && { quad: best.quad, support: best.support };
}

// A point on a straight board → the same point in the picture, following the perspective.
// corners: the board in the picture (top-left, top-right, bottom-right, bottom-left).
// u, v: 0 … 1 across the straight board (0, 0 = top-left corner, 1, 1 = bottom-right corner).
// Use it to draw on the picture, e.g. the middle of cell (row, col) of a 3 × 3 board: u = (col + 0.5) / 3.
export function boardPoint(corners, u, v) {
  const [p0, p1, p2, p3] = corners;
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dy1 = p1.y - p2.y, dy2 = p3.y - p2.y;
  const sx = p0.x - p1.x + p2.x - p3.x, sy = p0.y - p1.y + p2.y - p3.y;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / den, h = (dx1 * sy - sx * dy1) / den;
  const w = g * u + h * v + 1;
  return {
    x: ((p1.x - p0.x + g * p1.x) * u + (p3.x - p0.x + h * p3.x) * v + p0.x) / w,
    y: ((p1.y - p0.y + g * p1.y) * u + (p3.y - p0.y + h * p3.y) * v + p0.y) / w,
  };
}
