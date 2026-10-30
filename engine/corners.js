// Fallback when the board is not found: the player taps its four corners on the picture.
// Works with mouse, finger and pen (pointer events).
import { orderCorners, canvasPoint } from './geometry.js';

// canvas: shows the picture. Resolves with the four corners (top-left, top-right, bottom-right, bottom-left)
// in canvas pixels, or null when signal (an AbortSignal) stops it first. Draws a dot on every tap.
/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ signal?: AbortSignal }} [options]
 */
export function tapCorners(canvas, { signal } = {}) {
  const ctx = canvas.getContext('2d');
  const picture = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const taps = [];
  const oldTouchAction = canvas.style.touchAction;
  canvas.style.touchAction = 'none'; // a finger on the canvas must not scroll or zoom the page

  return new Promise((resolve) => {
    const finish = (result) => {
      canvas.removeEventListener('pointerdown', onTap);
      signal?.removeEventListener('abort', onAbort);
      canvas.style.touchAction = oldTouchAction;
      ctx.putImageData(picture, 0, 0);
      resolve(result);
    };
    const onAbort = () => finish(null);
    const onTap = (event) => {
      event.preventDefault();
      taps.push(canvasPoint(event, canvas));
      drawTaps(ctx, picture, taps);
      if (taps.length === 4) finish(orderCorners(taps));
    };
    if (signal?.aborted) return finish(null);
    canvas.addEventListener('pointerdown', onTap);
    signal?.addEventListener('abort', onAbort);
    drawTaps(ctx, picture, taps);
  });
}

function drawTaps(ctx, picture, taps) {
  const size = Math.max(6, ctx.canvas.width / 80);
  ctx.putImageData(picture, 0, 0);
  ctx.save();
  ctx.fillStyle = '#f2c';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.font = `${size * 2}px system-ui, sans-serif`;
  ctx.fillText(`Tap corner ${taps.length + 1} of 4`, size, size * 3);
  for (const p of taps) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, size, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
