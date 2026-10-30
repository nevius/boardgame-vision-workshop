// @ts-check
// Template for a game. Copy this file to games/<your-game>.js and add the name to games/list.js.
// Open the page with #<your-game> at the end of the URL to pick it.
//
// The page calls three functions, in this order, for every camera frame:
//   1. detect(frame, engine) → state   read the game from the picture
//   2. solve(state)          → move    decide what to do next
//   3. draw(ctx, state, move)          paint the answer over the picture
//
// "state" and "move" must be plain JSON: objects, arrays, strings, numbers, true/false, null.
// No classes, no functions, no images inside. Then you can save, print and test them easily.

// Settings for this game. The page shows "title". Add what your game needs.
/** @type {import('../engine/types.js').GameConfig} */
import { setInfo } from '../engine/actions.js';
export const config = {
  title: 'Blank game',
  // hands: false turns off "hand gone = move done". Then detect() runs whenever the camera picture
  // changes (a few times per second), not only once after a hand has left the board.
  // hands: false,
  // Live camera only: detect() gets a smaller picture (long side 960 px, 720 in Saver) a few times per second.
  // If your game needs more: analysisSize: 1440 (px), maxRate: 10 (per second).
  // knobs: numbers of your own with a slider in the Steps view; read one with engine.knob('inkLimit').
  // knobs: [{ name: 'inkLimit', label: 'Ink limit', value: 0.2, min: 0, max: 1, step: 0.01 }],
};

// frame:  ImageData of the camera picture (frame.width, frame.height, frame.data). Live it is a smaller copy;
//         draw() gets a canvas of that same size, so draw in frame pixels and it lands on the right spot.
// engine: shared helpers from engine/index.js (find the board, cut tiles, recognise tiles, ...).
//         Ready-made building blocks, each explained with an example in engine/README.md:
//           need many cards?             engine.findCards, then engine.cardSized and engine.straightLying (cards)
//           squares printed on a card?   engine.findFields → grids like ['.##', '###'] (fields)
//           colours under yellow light?  engine.paperGains, engine.paperColor, engine.colorName (color)
//           small pictures to name?      engine.findPatches, engine.cutOut, engine.rankByRefs (pictures)
//           3D pieces on the table?      engine.findBlobs, engine.nameBlobs (pieces3d)
//           fill a shape with pieces?    engine.coverGrid (cover), shown in 3D with engine.isoPolygons (iso)
//           labels flicker on video?     engine.createVotes or engine.holdSteady in steady() (steady)
//           tap on the picture?          engine.canvasPoint, engine.areaAt (pick)
// Return the game state as plain JSON. May be async.
/**
 * @param {import('../engine/types.js').Frame} frame
 * @param {import('../engine/types.js').Engine} engine
 */
export async function detect(frame, engine) {
  return { width: frame.width, height: frame.height, pieces: [] };
}

// state: what detect() returned. Return the suggested move as plain JSON (or null for "no move").
// Keep this a pure function: same state in, same move out. That makes it easy to test.
/** @param {{ width: number, height: number, pieces: string[] }} state */
export function solve(state) {
  return state.pieces.length === 0 ? null : { piece: state.pieces[0] };
}

// ctx: the 2D canvas context, already showing the camera picture. Draw your hint on top.
/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ width: number, height: number, pieces: string[] }} state
 * @param {{ piece: string } | null} move
 */
export function draw(ctx, state, move) {
  // Draw only on the board: clean outlines and the move. Labels only in Steps or on a tap (engine/details.js).
  // One short line of text goes in the small chip in the corner (engine/actions.js).
  // Buttons: engine.setActions([{ id, icon, label, onTap }]) puts up to 4 buttons in the bottom bar.
  setInfo(move ? 'Move found' : 'Blank game: nothing to do yet');
}
