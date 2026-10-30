import assert from 'node:assert/strict';
import { foundBox, zoomTo, pinch, viewCss, NONE, MAX_ZOOM } from '../ui/view-rules.js';

const photo = { width: 1000, height: 1000 };
const screen = { width: 400, height: 800 };
const square = (x, y, s) => [{ x, y }, { x: x + s, y }, { x: x + s, y: y + s }, { x, y: y + s }];

export function nothingFoundShowsTheWholePhoto() {
  assert.equal(foundBox(null, photo), null);
  assert.equal(foundBox([], photo), null);
  assert.deepEqual(zoomTo(null, photo, screen), NONE);
}

export function aTinyFindIsNotZoomedTo() {
  assert.equal(foundBox([square(10, 10, 50)], photo), null, '0.25 % of the photo: likely wrong');
}

export function theBoxHasAMarginAndStaysInThePhoto() {
  assert.deepEqual(foundBox([square(100, 100, 500)], photo), { x: 60, y: 60, width: 580, height: 580 });
  const edge = foundBox([square(0, 0, 900)], photo);
  assert.equal(edge?.x, 0);
  assert.ok(Math.abs((edge?.width ?? 0) - 972) < 1e-9);
}

export function cardsTogetherMakeOneBox() {
  const box = foundBox([square(100, 100, 300), square(500, 500, 300)], photo);
  assert.deepEqual(box, { x: 44, y: 44, width: 812, height: 812 });
}

export function theZoomShowsTheWholeBoxCentred() {
  const box = { x: 250, y: 250, width: 500, height: 500 };
  const view = zoomTo(box, photo, screen);
  // The photo fits 400 px wide (0.4 px per photo px); the box is 200 px wide on screen, so 2 ×.
  assert.equal(view.scale, 2);
  const fit = 0.4;
  const top = (800 - 1000 * fit) / 2;
  const left = 0;
  // Box corners on screen after the view: inside the screen, centred.
  const x0 = (left + box.x * fit) * view.scale + view.x;
  const x1 = (left + (box.x + box.width) * fit) * view.scale + view.x;
  const y0 = (top + box.y * fit) * view.scale + view.y;
  const y1 = (top + (box.y + box.height) * fit) * view.scale + view.y;
  assert.equal(x0, 0);
  assert.equal(x1, 400);
  assert.equal((y0 + y1) / 2, 400);
}

export function aBoxThatFillsThePhotoIsNotZoomed() {
  assert.equal(zoomTo({ x: 0, y: 0, width: 1000, height: 1000 }, photo, screen).scale, 1);
}

export function pinchKeepsTheSpotUnderTheFingers() {
  const view = pinch(NONE, [{ x: 100, y: 100 }, { x: 200, y: 100 }], [{ x: 50, y: 100 }, { x: 250, y: 100 }]);
  assert.equal(view.scale, 2);
  // The middle (150, 100) stays where it was.
  assert.equal(150 * view.scale + view.x, 150);
  assert.equal(100 * view.scale + view.y, 100);
}

export function pinchStaysBetweenOneAndMax() {
  assert.deepEqual(pinch(NONE, [{ x: 0, y: 0 }, { x: 100, y: 0 }], [{ x: 0, y: 0 }, { x: 10, y: 0 }]), NONE, 'not smaller than the whole photo');
  assert.equal(pinch(NONE, [{ x: 0, y: 0 }, { x: 10, y: 0 }], [{ x: 0, y: 0 }, { x: 1000, y: 0 }]).scale, MAX_ZOOM);
  assert.deepEqual(pinch(NONE, [{ x: 5, y: 5 }, { x: 5, y: 5 }], [{ x: 0, y: 0 }, { x: 9, y: 9 }]), NONE, 'two fingers on one spot: no change');
}

export function noViewNoTransform() {
  assert.equal(viewCss(NONE), '');
  assert.equal(viewCss({ scale: 2, x: -10, y: 5 }), 'translate(-10px, 5px) scale(2)');
}
