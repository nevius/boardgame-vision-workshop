// @ts-check
// Building block "iso": a small 3D drawer for cubes, plain canvas 2D, no library. Used by games/ubongo.js for the
// 3D view and the piece preview, and by ubongo-pieces.html.
//
//   const cubes = placementCubes(move.placements, (piece) => '#ef4444');   // solver output (engine/cover.js) → cubes
//   const offsets = explodeOffsets(cubes, 1.2);                            // pieces apart ("explode"), or []
//   drawPolygons(ctx, isoPolygons(cubes, { angle, offsets }), fitView(cubes, offsets, box));
//
// Pure part: isoPolygons() turns cubes into flat polygons in drawing order (painter's order: what is farther
// from the viewer first), so later polygons cover earlier ones. drawPolygons() paints them.
//
// A cube is { at: [layer, row, col], color: '#rrggbb', piece?: number }. Layer 0 lies on the table, row grows
// towards the viewer (at angle 0), col grows to the right. The view turns around the up axis by `angle` (radians)
// and looks down at a fixed tilt. `offsets[piece]` = [up, row, col] moves all cubes of that piece by that many
// cube sizes ("explode"): explodeOffsets() works them out, so each piece stays in one piece.
// Limits: cubes on a grid only (no other shapes); fine for a few hundred cubes per picture.

/** @typedef {{ x: number, y: number }} Point */
/** @typedef {{ at: number[], color: string, piece?: number }} Cube */
/** @typedef {{ points: Point[], fill: string, cube: number }} Polygon */

// Solver placements ({ piece, cells: [[layer, row, col], …] }, see engine/cover.js) → cubes in the piece colours,
// each with its piece number (the place order). step > 0: only the first `step` pieces (to show them one by one).
/** @param {{ piece: string, cells: number[][] }[]} placements @param {(piece: string) => string} colorOf @param {number} [step] @returns {Cube[]} */
export function placementCubes(placements, colorOf, step = 0) {
  const shown = step > 0 ? placements.slice(0, step) : placements;
  return shown.flatMap(({ piece, cells }, i) => cells.map((at) => ({ at, color: colorOf(piece), piece: i })));
}

// How steep the view looks down: 0 = from the side, PI / 2 = from straight above.
const TILT = 0.6;

// The six faces of a unit cube: the outward direction [layer, row, col], the four corners, and how bright.
// Corners are offsets [up, row, col] from the cube's low corner.
const FACES = [
  { normal: [1, 0, 0], light: 1, corners: [[1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0]] },
  { normal: [0, 1, 0], light: 0.8, corners: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] },
  { normal: [0, -1, 0], light: 0.8, corners: [[0, 0, 0], [0, 0, 1], [1, 0, 1], [1, 0, 0]] },
  { normal: [0, 0, 1], light: 0.62, corners: [[0, 0, 1], [0, 1, 1], [1, 1, 1], [1, 0, 1]] },
  { normal: [0, 0, -1], light: 0.62, corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
];

/**
 * How far each piece moves when exploded: outward from the middle of the shape (along the line from the shape's
 * middle to the piece's middle) by `distance` cube sizes, more for pieces farther out, plus a little up. A piece in the middle (that would not
 * move outward) is lifted instead; several of them are stacked, the lowest one least. Pure.
 * @param {Cube[]} cubes all cubes of the shape, each with its `piece` number
 * @param {number} distance cube sizes (0 = together)
 * @returns {number[][]} offsets[piece] = [up, row, col]
 */
export function explodeOffsets(cubes, distance) {
  const mid = middle(cubes);
  /** @type {number[][]} */
  const offsets = [];
  const pieces = [...new Set(cubes.map((c) => c.piece ?? 0))];
  /** @type {{ piece: number, layer: number }[]} */
  const middleOnes = [];
  for (const piece of pieces) {
    const own = cubes.filter((c) => (c.piece ?? 0) === piece);
    const mean = (k) => own.reduce((sum, c) => sum + c.at[k] + 0.5, 0) / own.length;
    const row = mean(1) - mid.row;
    const col = mean(2) - mid.col;
    const length = Math.hypot(row, col);
    if (length < 0.5) { middleOnes.push({ piece, layer: mean(0) }); continue; }
    const scale = Math.min(1, length); // pieces farther out move farther, so pieces on the same side part too
    offsets[piece] = [distance * 0.4, (row / scale) * distance, (col / scale) * distance];
  }
  // Pieces in the middle go straight up, stacked: the lowest one least, each next one a step higher.
  middleOnes.sort((a, b) => a.layer - b.layer || a.piece - b.piece);
  middleOnes.forEach(({ piece }, rank) => { offsets[piece] = [distance * (1.5 + rank), 0, 0]; });
  return offsets;
}

/**
 * Cubes → polygons in drawing order, in "cube units" around the middle of the cubes (scale with fitView).
 * Only faces that point at the viewer are kept, and none that touch another cube of the same piece (or of a
 * piece that did not move apart from it).
 * @param {Cube[]} cubes
 * @param {{ angle?: number, offsets?: number[][] }} [view]
 * @returns {Polygon[]}
 */
export function isoPolygons(cubes, view = {}) {
  const angle = view.angle ?? 0;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const mid = middle(cubes);
  const shift = (cube) => view.offsets?.[cube.piece ?? 0] ?? [0, 0, 0];
  // A point [up, row, col] → turned around the middle: x to the right on screen, depth towards the viewer.
  const turn = (up, row, col) => {
    const dc = col - mid.col;
    const dr = row - mid.row;
    return { x: dc * cos - dr * sin, depth: dc * sin + dr * cos, up };
  };
  const toScreen = (p) => ({ x: p.x, y: -p.up * Math.cos(TILT) + p.depth * Math.sin(TILT) });
  // Where each cube's low corner really is, with its piece's offset.
  const places = cubes.map((cube) => cube.at.map((v, k) => v + shift(cube)[k]));
  const key = (place) => place.map((v) => Math.round(v * 1000)).join(',');
  const taken = new Set(places.map(key));
  /** @type {Polygon[][]} */
  const perCube = cubes.map((cube, i) => {
    const [l, r, c] = places[i];
    /** @type {Polygon[]} */
    const faces = [];
    for (const face of FACES) {
      const [nl, nr, nc] = face.normal;
      // Points at the viewer? Sides: their direction turned must point towards the viewer. The top always does.
      if (nl === 0 && nc * sin + nr * cos <= 1e-9) continue;
      // Covered by a neighbour right next to it?
      if (taken.has(key([l + nl, r + nr, c + nc]))) continue;
      const points = face.corners.map(([u, dr, dc]) => toScreen(turn(l + u, r + dr, c + dc)));
      faces.push({ points, fill: shade(cube.color, face.light), cube: i });
    }
    return faces;
  });
  // Towards the viewer along each axis [up, row, col]: up always, row and col depending on the turn.
  const towards = [1, cos, sin];
  return drawingOrder(places, perCube, towards).flatMap((i) => perCube[i]);
}

// Painter's order for unit cubes that do not overlap: for two cubes whose pictures overlap, find an axis along
// which they are apart; the one farther from the viewer along that axis is drawn first. Then a topological sort
// (ties and, should it ever happen, loops: the cube farther back by its middle goes first).
/** @param {number[][]} places @param {Polygon[][]} perCube @param {number[]} towards @returns {number[]} */
function drawingOrder(places, perCube, towards) {
  const n = places.length;
  const boxes = perCube.map((faces) => {
    const points = faces.flatMap((f) => f.points);
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
  });
  const near = 1e-6;
  const overlap = (a, b) => a.left < b.right - near && b.left < a.right - near && a.top < b.bottom - near && b.top < a.bottom - near;
  // How near the viewer a cube's middle is (only for ties).
  const nearness = places.map((p) => p[0] * Math.sin(TILT) + (p[1] * towards[1] + p[2] * towards[2]) * Math.cos(TILT));
  /** @type {number[][]} */
  const after = places.map(() => []); // after[i] = cubes that must be drawn after cube i
  const waiting = places.map(() => 0); // how many cubes must be drawn before this one
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (!overlap(boxes[i], boxes[j])) continue;
      for (let k = 0; k < 3; k++) {
        const d = places[j][k] - places[i][k]; // j minus i along axis k
        if (Math.abs(d) < 1 - near || Math.abs(towards[k]) < 1e-9) continue;
        const [first, second] = d * towards[k] > 0 ? [i, j] : [j, i];
        after[first].push(second);
        waiting[second]++;
        break;
      }
    }
  }
  /** @type {number[]} */
  const order = [];
  const done = places.map(() => false);
  while (order.length < n) {
    // Cubes not yet drawn; those with nothing left to wait for come first, then the one farthest back.
    const rest = places.map((_, i) => i).filter((i) => !done[i]);
    const ready = rest.filter((i) => waiting[i] === 0);
    const pick = (ready.length ? ready : rest).reduce((a, b) => (nearness[b] < nearness[a] ? b : a));
    done[pick] = true;
    order.push(pick);
    for (const next of after[pick]) waiting[next]--;
  }
  return order;
}

// The middle of all cubes, seen from above, so the view turns around it.
/** @param {Cube[]} cubes */
function middle(cubes) {
  if (cubes.length === 0) return { row: 0, col: 0 };
  const rows = cubes.map((c) => c.at[1]);
  const cols = cubes.map((c) => c.at[2]);
  return { row: (Math.min(...rows) + Math.max(...rows) + 1) / 2, col: (Math.min(...cols) + Math.max(...cols) + 1) / 2 };
}

/**
 * The scale and shift that fit the cubes (moved by their offsets) into a box for every angle, so the size stays
 * the same while turning.
 * @param {Cube[]} cubes
 * @param {number[][] | undefined} offsets from explodeOffsets(), or none
 * @param {{ x: number, y: number, width: number, height: number }} box
 * @returns {{ scale: number, x: number, y: number }} screen point = { x: x + p.x * scale, y: y + p.y * scale }
 */
export function fitView(cubes, offsets, box) {
  const mid = middle(cubes);
  let radius = 0.5; // farthest corner from the middle, seen from above (the same at any angle)
  let height = 1;
  for (const cube of cubes) {
    const [up, row, col] = cube.at.map((v, k) => v + (offsets?.[cube.piece ?? 0]?.[k] ?? 0));
    height = Math.max(height, up + 1);
    for (const [dr, dc] of [[0, 0], [0, 1], [1, 0], [1, 1]]) radius = Math.max(radius, Math.hypot(row + dr - mid.row, col + dc - mid.col));
  }
  const wide = 2 * radius;
  const tall = 2 * radius * Math.sin(TILT) + height * Math.cos(TILT);
  const scale = Math.min(box.width / wide, box.height / tall) * 0.9;
  // Middle of the drawing: halfway between the highest point (top, far back) and the lowest (bottom, front).
  const highest = -height * Math.cos(TILT) - radius * Math.sin(TILT);
  const lowest = radius * Math.sin(TILT);
  return { scale, x: box.x + box.width / 2, y: box.y + box.height / 2 - ((highest + lowest) / 2) * scale };
}

// A '#rrggbb' colour made darker (factor below 1).
/** @param {string} hex @param {number} factor */
export function shade(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  const part = (shift) => Math.round(((n >> shift) & 255) * factor);
  return `rgb(${part(16)}, ${part(8)}, ${part(0)})`;
}

/**
 * Paints polygons from isoPolygons() with dark edges.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Polygon[]} polygons
 * @param {{ scale: number, x: number, y: number }} fit from fitView()
 */
export function drawPolygons(ctx, polygons, fit) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = Math.max(1.5, fit.scale / 20);
  for (const { points, fill } of polygons) {
    ctx.beginPath();
    for (const p of points) ctx.lineTo(fit.x + p.x * fit.scale, fit.y + p.y * fit.scale);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
