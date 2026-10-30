// engine/iso.js: cubes → polygons in the right drawing order (later polygons cover earlier ones).
import assert from 'node:assert/strict';
import { isoPolygons, fitView, shade, explodeOffsets, placementCubes } from '../engine/iso.js';
import { solutionCubes } from '../games/ubongo.js';

const red = '#ff0000';
const firstIndex = (polygons, cube) => polygons.findIndex((p) => p.cube === cube);
const lastIndex = (polygons, cube) => polygons.map((p) => p.cube).lastIndexOf(cube);

export function frontCubeIsDrawnAfterTheOneBehindIt() {
  // Cube 0 at the front (row 1), cube 1 behind it (row 0). At angle 0 row grows towards the viewer.
  const cubes = [{ at: [0, 1, 0], color: red }, { at: [0, 0, 0], color: red }];
  const polygons = isoPolygons(cubes, { angle: 0 });
  assert.ok(lastIndex(polygons, 1) < firstIndex(polygons, 0), 'the back cube comes first');
  // Turned half way round, the other cube is in front.
  const turned = isoPolygons(cubes, { angle: Math.PI });
  assert.ok(lastIndex(turned, 0) < firstIndex(turned, 1), 'turned: the old front cube is now behind');
}

export function cubeOnTopIsDrawnAfterTheOneBelow() {
  // A cube lifted above another one (as its own piece): the lower one comes first at every angle.
  const cubes = [{ at: [1, 0, 0], color: red, piece: 1 }, { at: [0, 0, 0], color: red, piece: 0 }];
  for (const angle of [0, 0.7, 2, 4]) {
    const polygons = isoPolygons(cubes, { angle, offsets: [[0, 0, 0], [0.8, 0, 0]] });
    assert.ok(lastIndex(polygons, 1) < firstIndex(polygons, 0), `angle ${angle}`);
  }
}

export function onlyFacesTowardsTheViewerAreKept() {
  // One cube: the top and two or three sides (never the back or the bottom).
  const one = isoPolygons([{ at: [0, 0, 0], color: red }], { angle: 0.5 });
  assert.equal(one.length, 3, 'top, front and one side');
  assert.equal(isoPolygons([{ at: [0, 0, 0], color: red }], { angle: 0 }).length, 2, 'straight on: top and front');
  // Two cubes side by side: the face between them is not drawn.
  const two = isoPolygons([{ at: [0, 0, 0], color: red }, { at: [0, 0, 1], color: red }], { angle: 0.5 });
  assert.equal(two.length, 5);
  // A cube on top of another hides its top face, unless their pieces are pulled apart.
  const stack = [{ at: [0, 0, 0], color: red, piece: 0 }, { at: [1, 0, 0], color: red, piece: 1 }];
  assert.equal(isoPolygons(stack, { angle: 0.5 }).length, 5);
  assert.equal(isoPolygons(stack, { angle: 0.5, offsets: [[0, 0, 0], [0.8, 0, 0]] }).length, 6);
}

// A two-layer solution of ['###', '###'] (12 cubes, 3 pieces; one piece reaches into the top layer). Fixed cells,
// so the drawing tests do not depend on the piece set; the names only give the colours.
const SOLUTION = { placements: [
  { piece: 'yellow3', cells: [[0, 0, 0], [0, 0, 1], [0, 1, 0], [0, 1, 1]] },
  { piece: 'red1', cells: [[0, 0, 2], [0, 1, 2], [1, 0, 1], [1, 0, 2]] },
  { piece: 'green2', cells: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 1, 2]] },
] };

export function polygonsAreQuadsInsideTheFittedBox() {
  const move = structuredClone(SOLUTION);
  assert.ok(move);
  const cubes = solutionCubes(move);
  assert.equal(cubes.length, 12);
  assert.equal(solutionCubes(move, 1).length, move.placements[0].cells.length, 'step 1: only the first piece');
  const box = { x: 10, y: 20, width: 390, height: 500 };
  for (const distance of [0, 0.6, 1.2]) {
    const offsets = explodeOffsets(cubes, distance);
    const fit = fitView(cubes, offsets, box);
    for (let angle = 0; angle < 2 * Math.PI; angle += 0.3) {
      for (const { points, fill } of isoPolygons(cubes, { angle, offsets })) {
        assert.equal(points.length, 4);
        assert.match(fill, /^rgb\(/);
        for (const p of points) {
          const x = fit.x + p.x * fit.scale;
          const y = fit.y + p.y * fit.scale;
          assert.ok(x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height, `inside at angle ${angle}`);
        }
      }
    }
  }
}

export function shadeMakesColoursDarker() {
  assert.equal(shade('#ff8000', 1), 'rgb(255, 128, 0)');
  assert.equal(shade('#ff8000', 0.5), 'rgb(128, 64, 0)');
}

// The two-layer solution above: three pieces, 12 cubes.
function twoLayerSolution() {
  const move = structuredClone(SOLUTION);
  assert.ok(move);
  return solutionCubes(move);
}

export function explodeKeepsEachPieceTogether() {
  const cubes = twoLayerSolution();
  const offsets = explodeOffsets(cubes, 1.2);
  const pieces = [...new Set(cubes.map((c) => c.piece))];
  assert.equal(pieces.length, 3);
  for (const piece of pieces) {
    // One offset per piece, so every cube of it moves the same way; and every piece moves.
    assert.equal(offsets[piece].length, 3);
    assert.ok(Math.hypot(...offsets[piece]) > 1, `piece ${piece} moves`);
  }
  // Pieces that were side by side are apart now: no two cubes of different pieces in the same place.
  const places = cubes.map((c) => c.at.map((v, k) => v + offsets[c.piece][k]).map((v) => v.toFixed(3)).join(','));
  assert.equal(new Set(places).size, cubes.length);
  // Together = no move at all.
  for (const o of explodeOffsets(cubes, 0)) assert.deepEqual(o.map(Math.abs), [0, 0, 0]);
}

export function explodeMovesPiecesOutwardAndLiftsTheMiddleOne() {
  // Piece 0 on the left, piece 1 on the right, piece 2 right in the middle (a row of 5 cubes: 2 + 1 + 2).
  const cubes = [
    { at: [0, 0, 0], color: red, piece: 0 }, { at: [0, 0, 1], color: red, piece: 0 },
    { at: [0, 0, 2], color: red, piece: 2 },
    { at: [0, 0, 3], color: red, piece: 1 }, { at: [0, 0, 4], color: red, piece: 1 },
  ];
  const offsets = explodeOffsets(cubes, 1);
  assert.ok(offsets[0][2] < -0.9 && offsets[1][2] > 0.9, 'left goes left, right goes right');
  assert.ok(offsets[0][0] > 0 && offsets[0][0] < 1, 'and a little up');
  assert.deepEqual(offsets[2].slice(1), [0, 0], 'the middle piece does not slide');
  assert.ok(offsets[2][0] > offsets[0][0], 'it is lifted instead');
}

export function drawingOrderIsRightWithOffsets() {
  // Ray test: at many points on screen, the polygon drawn last there must belong to the cube a ray from the viewer
  // hits first. Exploded and together, at many angles.
  const cubes = twoLayerSolution();
  const rows = cubes.map((c) => c.at[1]);
  const cols = cubes.map((c) => c.at[2]);
  const mid = { row: (Math.min(...rows) + Math.max(...rows) + 1) / 2, col: (Math.min(...cols) + Math.max(...cols) + 1) / 2 };
  const tilt = 0.6;
  for (const distance of [0, 0.5, 1.2]) {
    const offsets = explodeOffsets(cubes, distance);
    const boxes = cubes.map((c) => c.at.map((v, k) => v + offsets[c.piece][k]));
    for (let angle = 0.1; angle < 2 * Math.PI; angle += 0.5) {
      const polygons = isoPolygons(cubes, { angle, offsets });
      let checked = 0;
      for (let x = -4; x <= 4; x += 0.13) {
        for (let y = -5; y <= 4; y += 0.13) {
          if (polygons.some((p) => nearEdge(p.points, { x, y }))) continue; // too close to call
          const drawn = polygons.filter((p) => inside(p.points, { x, y })).at(-1);
          if (!drawn) continue;
          const hit = firstHit(boxes, x, y, angle, mid, tilt);
          if (hit < 0) continue; // on an edge
          assert.equal(drawn.cube, hit, `distance ${distance}, angle ${angle.toFixed(1)}, point ${x.toFixed(2)},${y.toFixed(2)}`);
          checked++;
        }
      }
      assert.ok(checked > 100);
    }
  }
}

// Inside a convex polygon?
function inside(points, p) {
  let sign = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    if (sign === 0) sign = Math.sign(cross);
    else if (Math.sign(cross) !== sign) return false;
  }
  return true;
}

// Within 0.01 of one of the polygon's edges?
function nearEdge(points, p) {
  return points.some((a, i) => {
    const b = points[(i + 1) % points.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (length * length)));
    return Math.hypot(a.x + t * (b.x - a.x) - p.x, a.y + t * (b.y - a.y) - p.y) < 0.01;
  });
}

// The cube a viewer's ray through screen point (x, y) hits first (-1 = none, or too close to call).
function firstHit(boxes, x, y, angle, mid, tilt) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  // Ray in turned space: depth = y sin(tilt) + t cos(tilt), up = -y cos(tilt) + t sin(tilt); bigger t = nearer.
  const at = (t) => {
    const depth = y * Math.sin(tilt) + t * Math.cos(tilt);
    const up = -y * Math.cos(tilt) + t * Math.sin(tilt);
    return [up, -x * sin + depth * cos + mid.row, x * cos + depth * sin + mid.col];
  };
  const origin = at(0);
  const step = at(1).map((v, k) => v - origin[k]);
  const hits = [];
  boxes.forEach((low, i) => {
    let enter = -Infinity;
    let leave = Infinity;
    for (let k = 0; k < 3; k++) {
      if (Math.abs(step[k]) < 1e-12) {
        if (origin[k] < low[k] || origin[k] > low[k] + 1) return;
        continue;
      }
      const a = (low[k] - origin[k]) / step[k];
      const b = (low[k] + 1 - origin[k]) / step[k];
      enter = Math.max(enter, Math.min(a, b));
      leave = Math.min(leave, Math.max(a, b));
    }
    if (leave > enter + 1e-6) hits.push({ i, near: leave });
  });
  if (hits.length === 0) return -1;
  hits.sort((a, b) => b.near - a.near);
  if (hits.length > 1 && hits[0].near - hits[1].near < 1e-3) return -1;
  return hits[0].i;
}

export function twoPiecesInTheMiddleAreStackedApart() {
  // Piece 0 lies flat in the middle, piece 1 lies on top of it: both are lifted, the upper one higher.
  const cubes = [
    { at: [0, 0, 0], color: red, piece: 0 }, { at: [0, 0, 1], color: red, piece: 0 },
    { at: [1, 0, 0], color: red, piece: 1 }, { at: [1, 0, 1], color: red, piece: 1 },
  ];
  const offsets = explodeOffsets(cubes, 1);
  assert.deepEqual(offsets[0].slice(1), [0, 0]);
  assert.deepEqual(offsets[1].slice(1), [0, 0]);
  assert.ok(offsets[1][0] > offsets[0][0] + 0.5, 'the upper one is lifted higher, so they part');
}

export function placementsBecomeCubesInPieceColours() {
  const placements = [{ piece: 'a', cells: [[0, 0, 0], [0, 0, 1]] }, { piece: 'b', cells: [[1, 0, 0]] }];
  const cubes = placementCubes(placements, (piece) => (piece === 'a' ? '#ff0000' : '#0000ff'));
  assert.deepEqual(cubes.map((c) => [c.color, c.piece]), [['#ff0000', 0], ['#ff0000', 0], ['#0000ff', 1]]);
  assert.equal(placementCubes(placements, () => '#fff', 1).length, 2, 'step 1: the first piece only');
}
