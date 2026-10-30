import assert from 'node:assert/strict';
import {
  orderCorners, polygonArea, isConvex, straightSize, pointInPolygon, dropNested, readingOrder, toCanvasPoint, bestQuad, boardPoint,
} from '../engine/geometry.js';

const square = (x, y, s) => [{ x, y }, { x: x + s, y }, { x: x + s, y: y + s }, { x, y: y + s }];

export function ordersCornersClockwiseFromTopLeft() {
  const tl = { x: 10, y: 12 }, tr = { x: 100, y: 5 }, br = { x: 110, y: 90 }, bl = { x: 0, y: 80 };
  assert.deepEqual(orderCorners([br, tl, bl, tr]), [tl, tr, br, bl]);
  // A square turned by 45 degrees still gets a sensible top-left.
  const diamond = [{ x: 50, y: 0 }, { x: 100, y: 50 }, { x: 50, y: 100 }, { x: 0, y: 50 }];
  assert.deepEqual(orderCorners([diamond[2], diamond[0], diamond[3], diamond[1]]), [diamond[0], diamond[1], diamond[2], diamond[3]]);
}

export function measuresAreaAndConvexity() {
  assert.equal(polygonArea(square(0, 0, 10)), 100);
  assert.ok(isConvex(square(0, 0, 10)));
  assert.ok(!isConvex([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 10 }]));
}

export function picksOutputSizeFromTheShape() {
  const wide = [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 100 }, { x: 0, y: 100 }];
  assert.deepEqual(straightSize(wide, 600), { width: 600, height: 200 });
}

export function dropsShapesInsideOtherShapes() {
  const card = square(0, 0, 100);
  const symbol = square(40, 40, 20);
  const other = square(200, 0, 100);
  assert.ok(pointInPolygon({ x: 50, y: 50 }, card) && !pointInPolygon({ x: 150, y: 50 }, card));
  assert.deepEqual(dropNested([symbol, card, other]), [card, other]);
}

export function sortsCardsInReadingOrder() {
  const a = square(0, 0, 10), b = square(50, 3, 10), c = square(2, 50, 10), d = square(52, 48, 10);
  assert.deepEqual(readingOrder([d, b, c, a], 10), [a, b, c, d]);
}

export function convertsTapsOnAScaledCanvas() {
  // Canvas of 640×480 pixels shown at 320×240 on screen, 10 px from the left, 20 px from the top.
  const p = toCanvasPoint(170, 140, { left: 10, top: 20, width: 320, height: 240 }, { width: 640, height: 480 });
  assert.deepEqual(p, { x: 320, y: 240 });
}

export function convertsTapsOnACanvasThatFitsItsBox() {
  // 640×480 picture in a 400×600 box (object-fit: contain): shown 400×300, 150 px bars above and below.
  const p = toCanvasPoint(200, 300, { left: 0, top: 0, width: 400, height: 600 }, { width: 640, height: 480 });
  assert.deepEqual(p, { x: 320, y: 240 });
  assert.deepEqual(toCanvasPoint(0, 150, { left: 0, top: 0, width: 400, height: 600 }, { width: 640, height: 480 }), { x: 0, y: 0 });
}

export function convertsTapsOnACanvasThatFillsItsBox() {
  // 640×480 picture filling a 400×600 box (object-fit: cover): shown 800×600, 200 px cut left and right.
  const box = { left: 0, top: 0, width: 400, height: 600 };
  assert.deepEqual(toCanvasPoint(200, 300, box, { width: 640, height: 480 }, true), { x: 320, y: 240 });
  assert.deepEqual(toCanvasPoint(0, 0, box, { width: 640, height: 480 }, true), { x: 160, y: 0 });
}

export function bestQuadIgnoresAShapeStickingOut() {
  // Edges: the outline of a 100×100 square. A "finger" adds two outline points far to the right.
  const isEdge = (x, y) => ((x === 0 || x === 100) && y >= 0 && y <= 100) || ((y === 0 || y === 100) && x >= 0 && x <= 100);
  const outline = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 160, y: 40 }, { x: 160, y: 60 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
  const found = bestQuad(outline, isEdge, 1);
  assert.deepEqual(found.quad, square(0, 0, 100));
  assert.equal(found.support, 1);
}

export function mapsBoardPointsWithPerspective() {
  const quad = [{ x: 10, y: 10 }, { x: 110, y: 10 }, { x: 110, y: 110 }, { x: 10, y: 110 }];
  assert.deepEqual(boardPoint(quad, 0.5, 0.25), { x: 60, y: 35 });
  // A trapezoid (board seen at an angle): corners stay corners, the middle is where the diagonals cross.
  const far = [{ x: 40, y: 0 }, { x: 60, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
  const round = (p) => ({ x: Math.round(p.x * 1000) / 1000, y: Math.round(p.y * 1000) / 1000 });
  assert.deepEqual(round(boardPoint(far, 1, 1)), { x: 100, y: 100 });
  assert.deepEqual(round(boardPoint(far, 0.5, 0.5)), { x: 50, y: 16.667 });
}
