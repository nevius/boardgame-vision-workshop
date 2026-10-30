// @ts-check
// "Hand gone = move done", made visible (issue #133): the hand skeleton on the live camera picture. The hand status
// ("Hand over board · paused") is in the mode chip (ui/mode-rules.js, issue #139). On with "Show hands" in ⋯ or
// &hands=show in the address.
// The see-through canvas has the video's size and the same fit as the video, so the points land on the hand.
// app.js draws on it with drawHands() on every hand check; nothing is drawn while it is off.
import { html } from 'htm/preact';
import { HAND_BONES } from '../engine/hands.js';

/** @param {{ canvasRef: import('preact').RefObject<HTMLCanvasElement>, fill: boolean, on: boolean }} props */
export function HandLayer({ canvasRef, fill, on }) {
  return html`
    <canvas ref=${canvasRef} width="640" height="480" aria-hidden="true"
      class=${!on ? 'hidden' : fill ? 'pointer-events-none absolute inset-0 block h-full w-full object-cover' : 'pointer-events-none absolute inset-0 block h-full w-full object-contain'}></canvas>
  `;
}

// Draws the hands (points from 0 to 1 in the video picture) as bones and dots; [] clears the layer.
/** @param {HTMLCanvasElement} canvas @param {{ x: number, y: number }[][]} hands @param {number} width @param {number} height */
export function drawHands(canvas, hands, width, height) {
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, width, height);
  const line = Math.max(3, Math.round(width / 200));
  for (const points of hands) {
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.9)'; // amber
    ctx.lineWidth = line;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const [a, b] of HAND_BONES) {
      ctx.moveTo(points[a].x * width, points[a].y * height);
      ctx.lineTo(points[b].x * width, points[b].y * height);
    }
    ctx.stroke();
    ctx.fillStyle = 'white';
    for (const p of points) {
      ctx.beginPath();
      ctx.arc(p.x * width, p.y * height, line * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
