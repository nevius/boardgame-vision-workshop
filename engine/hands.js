// "Hand gone = move done". Uses the MediaPipe Hand Landmarker.
// While a hand is over the board, the page pauses detect(). When no hand was seen for a while
// (stableMs), the move is done: onStable() fires once and the page runs the game's detect() again.
// Turn it off for a game with config.hands = false.
import { loadVision, VISION_WASM, MODELS } from './libs.js';
import { busy, startBusy, fetchBytes } from './busy.js';
import { recordLoad, recordStep } from './bench.js';

// The pure part (no camera, no MediaPipe), so it can be unit tested.
// Feed it update(handSeen, nowMs) for every checked picture. It returns 'hand' when a hand just
// appeared, 'stable' once when the hand has been gone for stableMs, otherwise null.
export function handTracker({ stableMs = 800 } = {}) {
  let handVisible = false;
  let lastSeen = null;   // time a hand was last seen; null = nothing to report
  return {
    update(handSeen, now) {
      if (handSeen) {
        const appeared = !handVisible;
        handVisible = true;
        lastSeen = now;
        return appeared ? 'hand' : null;
      }
      handVisible = false;
      if (lastSeen !== null && now - lastSeen >= stableMs) {
        lastSeen = null;
        return 'stable';
      }
      return null;
    },
    // true while a hand is over the board or it left less than stableMs ago.
    busy() {
      return lastSeen !== null;
    },
  };
}

// The bones of one hand: pairs of the 21 Hand Landmarker points (0 = wrist, 4 = thumb tip, 8 = index tip, …).
// For drawing the hand skeleton (ui/HandLayer.js).
export const HAND_BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4],         // thumb
  [0, 5], [5, 6], [6, 7], [7, 8],         // index finger
  [5, 9], [9, 10], [10, 11], [11, 12],    // middle finger
  [9, 13], [13, 14], [14, 15], [15, 16],  // ring finger
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20], // little finger and palm
];

let landmarkerPromise = null;

// Loads the Hand Landmarker once (GPU first, CPU fallback).
function loadLandmarker() {
  landmarkerPromise ??= (async () => {
    const start = performance.now();
    const vision = await loadVision();
    const fileset = await vision.FilesetResolver.forVisionTasks(VISION_WASM);
    // Downloaded here (not by MediaPipe) so the busy indicator can show how far it is.
    const model = await busy('Loading hand model…', (job) => fetchBytes(MODELS.handLandmarker, job.bytes));
    const starting = startBusy('Starting hand model…'); // the WASM runtime loads here too
    try {
      for (const delegate of ['GPU', 'CPU']) {
        try {
          const landmarker = await vision.HandLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetBuffer: model, delegate },
            runningMode: 'VIDEO',
            numHands: 2,
          });
          recordLoad('hands', performance.now() - start, delegate);
          return landmarker;
        } catch (err) {
          if (delegate === 'CPU') throw err;
        }
      }
    } catch (err) {
      starting.fail(`Could not start the hand model: ${err.message}`);
      throw err;
    } finally {
      starting.done(); // harmless after fail()
    }
  })();
  landmarkerPromise.catch(() => { landmarkerPromise = null; });
  return landmarkerPromise;
}

// Watches the video about fps times per second.
//   onStable(): the hand was gone for stableMs → run detect() again.
//   onChange(busy): optional; true when a hand appears (pause detect), false when it is done.
//   onHands(hands): optional; the points of every hand seen on each check ([] = none), x and y from 0 to 1.
// Returns a stop function. Waits for the model; throws if it cannot load.
/**
 * @param {HTMLVideoElement} video
 * @param {() => void} onStable
 * @param {{ fps?: number, stableMs?: number, onChange?: (busy: boolean) => void,
 *   onHands?: (hands: { x: number, y: number }[][]) => void }} [options]
 */
export async function watchHand(video, onStable, { fps = 10, stableMs = 800, onChange, onHands } = {}) {
  const landmarker = await loadLandmarker();
  const tracker = handTracker({ stableMs });
  let running = true;
  let timer = null;
  let lastVideoTime = -1;

  function check() {
    if (!running) return;
    if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const now = performance.now();
      const result = landmarker.detectForVideo(video, now);
      recordStep('hands', performance.now() - now);
      onHands?.(result.landmarks);
      const event = tracker.update(result.landmarks.length > 0, now);
      // Stretch task: point at a tile with a finger. result.landmarks[0][8] is the index fingertip
      // (x, y from 0 to 1 in the video picture). Map it onto the board here and report the tile.
      if (event === 'hand') onChange?.(true);
      if (event === 'stable') { onChange?.(false); onStable(); }
    }
    timer = setTimeout(check, 1000 / fps);
  }
  check();

  return () => { running = false; clearTimeout(timer); };
}
