// @ts-check
// Building block "anchor": a card or sheet that stays put on live video. Once a card is confirmed, its content
// (fields, pieces, digits, …) is kept and only its position is followed from frame to frame:
// - Tracking: a few strong points inside the card are followed with OpenCV.js optical flow (calcOpticalFlowPyrLK).
//   The full detect() runs only every `every` frames (or `everyMs`), or when tracking gets poor.
// - Smoothing: the corners shown follow slowly (dead zone + average), so small shakes do not move the drawing.
// - Hold: when the card is lost, the last good position stays for `holdMs`, then the drawing fades out.
// - Unlock: a different card (other key) seen for `unlockMs` takes over. The lock icon in the top bar unlocks too.
//
//   const anchor = createAnchor();                 // once, outside detect
//   export async function detect(frame, engine) {
//     return anchor.run(frame, () => readEverything(frame, engine), {
//       key: (state) => state.card,                // which card this is (another key = another card)
//       sure: (state) => state.known,              // lock only once the card is confirmed
//     });
//   }
//
// run() calls your reading function only when needed. Every {x, y} point in the kept state moves along with the
// card (picture points, e.g. Set cards' corners). Only on live video (the page switches it on); photos and tests
// always read fully. reread: true keeps reading the content on each full detect (Tic-Tac-Toe: new marks), but
// keeps the steady position. Limits: the card must have some texture (print, edges) to follow; a fast swing
// loses it (then it is found again by the full detect); boxes as [x0, y0, x1, y1] arrays do not move along.

/** @typedef {{ x: number, y: number }} Point */
/** @typedef {import('./types.js').Frame} Frame */
/**
 * @typedef {object} RunOptions
 * @property {(state: any) => any} [key]  which object this is; another key = another object (default: always the same)
 * @property {(state: any) => boolean} [sure]  lock only when true (default: whenever corners are found)
 * @property {(state: any) => (Point[] | null | undefined)} [cornersOf]  the 4 corners in the state (default state.corners)
 * @property {boolean} [reread]  take the new content on every full detect, keep only the position steady
 * @property {number} [now]  time in ms (tests); default performance.now()
 */

// ---------------------------------------------------------------- pure rules (tested in tests/anchor.test.js)

/**
 * The corners to show: they move towards `target` slowly. Moves below `dead` (share of the card's diagonal)
 * are ignored, small moves are averaged with weight `alpha`, big moves (over `far`) follow quickly (`fast`).
 * @param {Point[] | null} shown @param {Point[]} target
 * @param {{ dead?: number, alpha?: number, far?: number, fast?: number }} [options]
 * @returns {Point[]}
 */
export function smoothCorners(shown, target, { dead = 0.004, alpha = 0.15, far = 0.15, fast = 0.6 } = {}) {
  if (!shown || shown.length !== target.length) return target.map((p) => ({ x: p.x, y: p.y }));
  const size = Math.max(1, Math.hypot(target[2].x - target[0].x, target[2].y - target[0].y));
  // One weight for all corners (the largest move decides), so the shape stays a clean quad.
  const move = Math.max(...target.map((p, i) => Math.hypot(p.x - shown[i].x, p.y - shown[i].y))) / size;
  if (move < dead) return shown;
  const w = move > far ? fast : alpha;
  return shown.map((p, i) => ({ x: p.x + (target[i].x - p.x) * w, y: p.y + (target[i].y - p.y) * w }));
}

/**
 * The average of the last few corner sets (a list of quads, newest last): shakes cancel out.
 * @param {Point[][]} recent @returns {Point[]}
 */
export function meanCorners(recent) {
  const n = recent.length;
  return recent[0].map((_, i) => ({
    x: recent.reduce((s, q) => s + q[i].x, 0) / n,
    y: recent.reduce((s, q) => s + q[i].y, 0) / n,
  }));
}

/**
 * How visible a lost card still is: 1 for `holdMs` after it was last seen, then down to 0 over `fadeMs`.
 * @param {number} lostFor ms since the card was last seen @param {number} holdMs @param {number} fadeMs
 */
export function holdOpacity(lostFor, holdMs, fadeMs) {
  if (lostFor <= holdMs) return 1;
  return Math.max(0, 1 - (lostFor - holdMs) / Math.max(1, fadeMs));
}

/**
 * The unlock rule: a different key must be seen without a break for `unlockMs`. Returns the new pending
 * candidate (or null) and whether to switch now.
 * @param {{ key: any, since: number } | null} pending @param {any} lockedKey @param {any} seenKey
 * @param {number} now @param {number} unlockMs
 * @returns {{ pending: { key: any, since: number } | null, change: boolean }}
 */
export function unlockRule(pending, lockedKey, seenKey, now, unlockMs) {
  if (seenKey == null || seenKey === lockedKey) return { pending: null, change: false };
  const next = pending && pending.key === seenKey ? pending : { key: seenKey, since: now };
  return { pending: next, change: now - next.since >= unlockMs };
}

/**
 * The perspective map that takes the 4 points `from` to the 4 points `to`, as a function point → point.
 * @param {Point[]} from @param {Point[]} to @returns {(p: Point) => Point}
 */
export function quadMap(from, to) {
  // Solve the 8 unknowns h0…h7 of x' = (h0 x + h1 y + h2) / (h6 x + h7 y + 1), y' likewise.
  const rows = [];
  from.forEach((p, i) => {
    const q = to[i];
    rows.push([p.x, p.y, 1, 0, 0, 0, -p.x * q.x, -p.y * q.x, q.x]);
    rows.push([0, 0, 0, p.x, p.y, 1, -p.x * q.y, -p.y * q.y, q.y]);
  });
  for (let c = 0; c < 8; c++) {
    let pivot = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(rows[r][c]) > Math.abs(rows[pivot][c])) pivot = r;
    [rows[c], rows[pivot]] = [rows[pivot], rows[c]];
    if (Math.abs(rows[c][c]) < 1e-12) return (p) => p; // a broken quad: leave the points where they are
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = rows[r][c] / rows[c][c];
      for (let k = c; k < 9; k++) rows[r][k] -= f * rows[c][k];
    }
  }
  const h = rows.map((row, i) => row[8] / row[i]);
  return (p) => {
    const w = h[6] * p.x + h[7] * p.y + 1;
    return { x: (h[0] * p.x + h[1] * p.y + h[2]) / w, y: (h[3] * p.x + h[4] * p.y + h[5]) / w };
  };
}

/**
 * A copy of a plain-JSON state where every {x, y} point is moved by `map` (rounded to 0.1 px).
 * @template T @param {T} state @param {(p: Point) => Point} map @returns {T}
 */
export function moveState(state, map) {
  /** @param {any} v @returns {any} */
  const walk = (v) => {
    if (Array.isArray(v)) return v.map(walk);
    if (!v || typeof v !== 'object') return v;
    if (typeof v.x === 'number' && typeof v.y === 'number') {
      const q = map(v);
      return { ...v, x: Math.round(q.x * 10) / 10, y: Math.round(q.y * 10) / 10 };
    }
    return Object.fromEntries(Object.entries(v).map(([k, w]) => [k, walk(w)]));
  };
  return walk(state);
}

/**
 * For many cards anchored together (cornersOf for Set): the box around all of state.cards, or null.
 * @param {{ cards?: { corners: Point[] }[] }} state @returns {Point[] | null}
 */
export function cardsBox(state) {
  const points = (state?.cards ?? []).flatMap((c) => c.corners ?? []);
  if (points.length === 0) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
}

// ---------------------------------------------------------------- the page's switches

let liveVideo = false;
/** @type {Set<Anchor>} */
const anchors = new Set();
/** @type {((locked: boolean) => void) | null} */
let listener = null;

/** True while the live camera runs (the page sets it with setAnchorLive). @returns {boolean} */
export const isLiveVideo = () => liveVideo;

/** For the page: anchors work only on live video (on) and forget everything when switched off. @param {boolean} on */
export function setAnchorLive(on) {
  liveVideo = on;
  if (!on) unlockAll();
}

/** For the page (lock icon): forget all anchored cards, so the next frame reads them again. */
export function unlockAll() {
  anchors.forEach((a) => a.unlock());
}

/** For the page: is any card anchored now, and how visible (0–1; below 1 while a lost card fades out). */
export function anchorStatus() {
  let opacity = 0;
  anchors.forEach((a) => { opacity = Math.max(opacity, a.opacity); });
  return { locked: opacity > 0, opacity: opacity || 1 };
}

/** For the page: called whenever an anchor locks or unlocks. @param {(locked: boolean) => void} fn */
export function onAnchor(fn) {
  listener = fn;
}

// ---------------------------------------------------------------- tracking (OpenCV.js)

const WORK = 480;   // tracking runs on a grey copy whose long side is at most this
const POINTS = 40;  // strong points to follow inside the card
const RECENT = 6;   // positions averaged before smoothing
const FAR = 0.25;   // a jump of this share of the card's diagonal is a real move, not a shake

/** A grey, smaller copy of the frame as a cv.Mat, and its scale (work pixels per frame pixel). @param {any} cv @param {Frame} frame */
export function greyMat(cv, frame) {
  const scale = Math.min(1, WORK / Math.max(frame.width, frame.height));
  const w = Math.max(1, Math.round(frame.width * scale));
  const h = Math.max(1, Math.round(frame.height * scale));
  const grey = new Uint8Array(w * h);
  const d = frame.data;
  for (let y = 0; y < h; y++) {
    const row = Math.min(frame.height - 1, Math.floor(y / scale)) * frame.width;
    for (let x = 0; x < w; x++) {
      const i = (row + Math.min(frame.width - 1, Math.floor(x / scale))) * 4;
      grey[y * w + x] = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
    }
  }
  const mat = new cv.Mat(h, w, cv.CV_8UC1);
  mat.data.set(grey);
  return { mat, scale };
}

/**
 * Follows a quad from one grey picture to the next: strong points inside it, optical flow, then one
 * turn, shift and stretch (affine) fitted to the points. Returns the moved corners, or null when too few points held.
 * @param {any} cv @param {{ mat: any, scale: number }} before @param {{ mat: any, scale: number }} after @param {Point[]} corners
 * @returns {Point[] | null}
 */
export function trackQuad(cv, before, after, corners) {
  const s = before.scale;
  const mask = cv.Mat.zeros(before.mat.rows, before.mat.cols, cv.CV_8UC1);
  const quad = cv.matFromArray(4, 1, cv.CV_32SC2, corners.flatMap((p) => [Math.round(p.x * s), Math.round(p.y * s)]));
  const quads = new cv.MatVector();
  quads.push_back(quad);
  cv.fillPoly(mask, quads, new cv.Scalar(255));
  const from = new cv.Mat();
  const to = new cv.Mat();
  const status = new cv.Mat();
  const err = new cv.Mat();
  const inliers = new cv.Mat();
  /** @type {any} */
  let fit = null;
  try {
    cv.goodFeaturesToTrack(before.mat, from, POINTS, 0.01, 6, mask, 5);
    if (from.rows < 6) return null;
    cv.calcOpticalFlowPyrLK(before.mat, after.mat, from, to, status, err, new cv.Size(15, 15), 2);
    const a = [];
    const b = [];
    for (let i = 0; i < from.rows; i++) {
      if (!status.data[i] || err.data32F[i] > 20) continue;
      a.push(from.data32F[2 * i], from.data32F[2 * i + 1]);
      b.push(to.data32F[2 * i] / s * after.scale, to.data32F[2 * i + 1] / s * after.scale);
    }
    const n = a.length / 2;
    if (n < 6 || n < from.rows * 0.5) return null;
    const pa = cv.matFromArray(n, 1, cv.CV_32FC2, a);
    const pb = cv.matFromArray(n, 1, cv.CV_32FC2, b);
    fit = cv.estimateAffine2D(pa, pb, inliers, cv.RANSAC, 2);
    pa.delete();
    pb.delete();
    let kept = 0;
    for (let i = 0; i < inliers.rows; i++) kept += inliers.data[i] ? 1 : 0;
    if (fit.empty() || kept < Math.max(6, n * 0.6)) return null;
    const m = fit.data64F;
    return corners.map((p) => {
      const x = p.x * s;
      const y = p.y * s;
      return { x: (m[0] * x + m[1] * y + m[2]) / after.scale, y: (m[3] * x + m[4] * y + m[5]) / after.scale };
    });
  } finally {
    [mask, quad, quads, from, to, status, err, inliers].forEach((m) => m.delete());
    fit?.delete();
  }
}

// ---------------------------------------------------------------- one anchor

/** @typedef {ReturnType<typeof createAnchor>} Anchor */

/**
 * @param {{ every?: number, everyMs?: number, holdMs?: number, fadeMs?: number, unlockMs?: number, smooth?: Parameters<typeof smoothCorners>[2],
 *   loadCV?: () => Promise<any> }} [options]
 *   every / everyMs: full detect every so many frames (10) or ms (500), whichever comes first, so another card
 *   is noticed soon. holdMs: keep a lost card (1000). fadeMs: then fade (500).
 *   unlockMs: another card seen this long takes over (700; with everyMs about 1 s in all). loadCV: how to get OpenCV.js (default engine/libs.js).
 */
export function createAnchor({ every = 10, everyMs = 500, holdMs = 1000, fadeMs = 500, unlockMs = 700, smooth, loadCV } = {}) {
  /** @type {{ key: any, state: any, from: Point[] } | null} */
  let locked = null;
  /** @type {Point[] | null} */ let raw = null;    // where the card is now (tracked or found)
  /** @type {Point[][]} */ let recent = [];          // the last few raw positions, averaged before smoothing
  /** @type {Point[] | null} */ let shown = null;  // where it is drawn (smoothed)
  /** @type {{ mat: any, scale: number } | null} */ let grey = null;
  /** @type {{ key: any, since: number } | null} */ let pending = null;
  let lastSeen = 0;
  let since = 0;      // frames since the last full detect
  let readAt = 0;     // time of the last full detect
  let poor = false;   // tracking failed: full detect on the next frame

  const anchor = {
    opacity: 0,
    /** Forget the card: the next frame reads everything again. */
    unlock() {
      const was = locked !== null;
      locked = null; raw = null; shown = null; pending = null; poor = false; recent = [];
      grey?.mat.delete();
      grey = null;
      anchor.opacity = 0;
      if (was) listener?.(false);
    },
    /**
     * One frame. read() is your full detection; it runs only when needed.
     * @template S @param {Frame} frame @param {() => S | Promise<S>} read @param {RunOptions} [options] @returns {Promise<S>}
     */
    async run(frame, read, { key = () => true, sure = () => true, cornersOf = (s) => s?.corners, reread = false, now = performance.now() } = {}) {
      if (!liveVideo) return read();
      anchors.add(anchor);
      const cv = await (loadCV ?? (await import('./libs.js')).loadOpenCV)();
      const next = greyMat(cv, frame);
      const before = grey;
      grey = next;
      const full = !locked || poor || pending || since >= every - 1 || now - readAt >= everyMs;
      if (!full && before && raw) {
        const moved = trackQuad(cv, before, next, raw);
        before.mat.delete();
        if (moved) {
          since++;
          raw = remember(moved);
          lastSeen = now;
          return /** @type {S} */ (view(now));
        }
        poor = true; // lost by tracking: read fully now
      } else before?.mat.delete();

      since = 0;
      readAt = now;
      poor = false;
      const found = await read();
      const corners = found ? cornersOf(found) : null;
      if (!corners || corners.length !== 4) return locked ? (view(now) ?? found) : found;
      const k = key(found);
      if (locked && k !== locked.key) {
        // Another card in view: it takes over once seen steadily; until then the old one is held.
        const rule = unlockRule(pending, locked.key, k, now, unlockMs);
        pending = rule.pending;
        if (!rule.change) return view(now) ?? found;
        anchor.unlock();
        anchors.add(anchor);
      }
      pending = null;
      raw = remember(corners);
      lastSeen = now;
      if (locked) {
        if (reread) locked = { key: k, state: found, from: corners };
        return /** @type {S} */ (view(now));
      }
      shown = smoothCorners(shown, corners, smooth);
      if (!sure(found)) return moveState(found, quadMap(corners, shown));
      locked = { key: k, state: found, from: corners };
      listener?.(true);
      return /** @type {S} */ (view(now));
    },
  };

  // A new raw position joins the last few (a big jump starts over: the card really moved).
  /** @param {Point[]} corners */
  function remember(corners) {
    const last = recent[recent.length - 1];
    const size = Math.hypot(corners[2].x - corners[0].x, corners[2].y - corners[0].y) || 1;
    if (last && Math.max(...corners.map((p, i) => Math.hypot(p.x - last[i].x, p.y - last[i].y))) / size > FAR) recent = [];
    recent.push(corners);
    if (recent.length > RECENT) recent.shift();
    return corners;
  }

  // The kept state at the smoothed position, or null once a lost card has faded out (then it unlocks).
  /** @param {number} now */
  function view(now) {
    if (!locked || !raw) return null;
    anchor.opacity = holdOpacity(now - lastSeen, holdMs, fadeMs);
    if (anchor.opacity <= 0) { anchor.unlock(); return null; }
    shown = smoothCorners(shown, meanCorners(recent), smooth);
    return moveState(locked.state, quadMap(locked.from, shown));
  }

  return anchor;
}
