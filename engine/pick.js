// @ts-check
// Building block "pick": a tap on the picture → which region of a card or board, or which button, is under it.
// Regions are areas on the straight card (shares 0–1), so they follow the card's perspective in the picture.
// Pure, so tests can call it. From Ubongo (tap a piece group or a field on the card, tap a button).
//
//   canvas.addEventListener('pointerdown', (event) => {
//     const p = canvasPoint(event, canvas);                 // the tap in picture pixels
//     const k = areaAt(state.corners, groups.map((g) => g.box), p);   // index of the area under it, or -1
//   });
//
// Used by games/ubongo.js. Limits: areas are rectangles on the straight card; the first hit wins when they overlap.

import { boardPoint, pointInPolygon, canvasPoint } from './geometry.js';

export { canvasPoint };

/** @typedef {{ x: number, y: number }} Point */
/** @typedef {{ left: number, top: number, width: number, height: number }} Area */
/** @typedef {{ x: number, y: number, width: number, height: number }} Box  in picture pixels */

// An area on the straight card → its four corners in the picture (top-left, top-right, bottom-right, bottom-left).
/** @param {Point[]} corners the card in the picture @param {Area} a @returns {Point[]} */
export function areaCorners(corners, a) {
  return [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => boardPoint(corners, a.left + a.width * u, a.top + a.height * v));
}

// The index of the first area (on the card with these corners) under the picture point p, or -1.
/** @param {Point[]} corners @param {Area[]} areas @param {Point} p */
export function areaAt(corners, areas, p) {
  return areas.findIndex((a) => pointInPolygon(p, areaCorners(corners, a)));
}

// True when the picture point p lies in the box (a button drawn on the picture).
/** @param {Point} p @param {Box} b */
export function inBox(p, b) {
  return p.x >= b.x && p.x < b.x + b.width && p.y >= b.y && p.y < b.y + b.height;
}

