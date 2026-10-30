// @ts-check
// Clean overlay (issue #163): by default draw() shows only clean outlines of what was found and the suggested
// move. Small labels, grid lines and other detail belong to the Steps view, or to the one thing the user tapped.
//
//   if (detailsOn()) drawLabels(ctx, tiles);                       // all labels only while Steps is open
//   const tap = tapPoint();                                        // the last tap on the picture, or null
//   const t = tap && tiles.find((t) => inside(t.corners, tap));
//   if (t) drawCallout(ctx, tap, `${t.color} ${t.shape}`);         // a small name box at the tapped tile
//
// app.js stores each tap on the picture (in picture pixels) and draws again, but only for a game whose last
// draw() asked for tapPoint(); a game with its own tap handler (Set, Ubongo) is not drawn twice.
// A new photo, the camera or a game switch forgets the tap. Import this file directly in draw().
import { stepsOn } from './steps.js';

/** @typedef {{ x: number, y: number }} Point */

/** @type {Point | null} */
let tap = null;
let asked = false;

/** True while the Steps view is open: then draw() may show every label and line. */
export function detailsOn() {
  return stepsOn();
}

/** The last tap on the picture in picture pixels, or null. Calling it tells app.js to draw again on a tap. */
export function tapPoint() {
  asked = true;
  return tap;
}

/** For app.js: keep a tap (null forgets it). Returns true when the game's last draw() wants to draw again. */
export function setTap(/** @type {Point | null} */ p) {
  tap = p;
  const again = asked;
  asked = false; // the next draw asks again if it still wants taps; null (a game switch) forgets it too
  return again;
}

// Colours of the callout: the design tokens (ui/tokens.css), read once from the page; Node tests get the defaults.
const TOKENS = { surface: '#171717', text: '#f5f5f5', line: 'rgba(255, 255, 255, 0.12)' };
let tokensRead = false;
function tokens() {
  if (!tokensRead && typeof getComputedStyle === 'function' && typeof document !== 'undefined') {
    tokensRead = true;
    const css = getComputedStyle(document.documentElement);
    const read = (/** @type {string} */ name, /** @type {string} */ fallback) => css.getPropertyValue(name).trim() || fallback;
    Object.assign(TOKENS, { surface: read('--bv-surface', TOKENS.surface), text: read('--bv-text', TOKENS.text), line: read('--bv-line', TOKENS.line) });
  }
  return TOKENS;
}

/**
 * Where the callout box goes: above the point, kept inside the picture. Pure, tested.
 * @param {Point} at @param {number} width @param {number} height  box size
 * @param {number} canvasWidth @param {number} canvasHeight
 */
export function calloutBox(at, width, height, canvasWidth, canvasHeight) {
  const gap = height / 2;
  const x = Math.min(Math.max(0, at.x - width / 2), Math.max(0, canvasWidth - width));
  const above = at.y - gap - height;
  const y = above >= 0 ? above : Math.min(at.y + gap, Math.max(0, canvasHeight - height));
  return { x, y, width, height };
}

/**
 * A small name box next to a tapped point: the one label the clean overlay shows outside the Steps view.
 * @param {CanvasRenderingContext2D} ctx @param {Point} at @param {string} text
 */
export function drawCallout(ctx, at, text) {
  const { surface, text: ink, line } = tokens();
  const size = Math.max(14, ctx.canvas.width / 36);
  ctx.save();
  ctx.font = `${size}px system-ui, sans-serif`;
  const pad = size / 2;
  const box = calloutBox(at, ctx.measureText(text).width + pad * 2, size + pad * 2, ctx.canvas.width, ctx.canvas.height);
  ctx.globalAlpha = 1;
  ctx.fillStyle = surface;
  ctx.strokeStyle = line;
  ctx.lineWidth = Math.max(1, size / 14);
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(box.x, box.y, box.width, box.height, size / 2);
  else ctx.rect(box.x, box.y, box.width, box.height);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = ink;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, box.x + pad, box.y + box.height / 2);
  ctx.restore();
}
