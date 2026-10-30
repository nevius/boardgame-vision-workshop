// @ts-check
// Building block "steady": labels that do not flicker on live video. Two helpers:
//
// 1. createVotes (many objects, e.g. Set cards): follows each card from frame to frame (by its position) and keeps
// votes per feature over the last frames. A feature shows the value most frames agree on; when too few
// frames agree it becomes null ("?" on the screen) instead of a word that flickers or is wrong.
// No pictures here, only the plain JSON cards that detect() returns, so it is easy to test.
//
//   const votes = createVotes({ features: ['color', 'number', 'shape', 'fill'] });
//   const steady = votes.update(state.cards);   // once per frame, same cards with voted features
//
// 2. holdSteady (one value, e.g. the list of Ubongo pieces seen): a new value counts only after it was seen in
//    `frames` frames in a row; until then the value shown before stays.
//
//   const hold = holdSteady(3);
//   const shown = hold(seen);   // once per frame
//
// Used by solutions/set.js (votes) and games/ubongo.js (hold). Limit: cards are followed by position only, so
// two cards that swap places in one frame swap their votes.

/** @typedef {{ x: number, y: number }} Point */
/** @typedef {{ corners: Point[], [feature: string]: any }} VoteCard */
/** @typedef {{ center: Point, size: number, history: any[][], lastSeen: number }} Track */

/**
 * @param {{ features: string[], frames?: number, limit?: number, near?: number }} options
 *   frames: how many frames vote (default 10). limit: share of those frames that must agree (default 0.6).
 *   near: a card is the same card as before when its middle moved less than this share of its size (0.5).
 */
export function createVotes({ features, frames = 10, limit = 0.6, near = 0.5 }) {
  /** @type {Track[]} */
  let tracks = [];
  let frame = 0;

  /** @param {VoteCard[]} cards @returns {VoteCard[]} */
  function update(cards) {
    frame++;
    const found = cards.map((card) => ({ center: middle(card.corners), size: diagonal(card.corners) }));
    // Pair every card with the nearest track, closest pairs first; a track takes one card at most.
    const pairs = [];
    found.forEach((f, c) => tracks.forEach((t, k) => {
      const d = Math.hypot(f.center.x - t.center.x, f.center.y - t.center.y);
      if (d < near * Math.max(f.size, t.size)) pairs.push({ c, k, d });
    }));
    pairs.sort((a, b) => a.d - b.d);
    /** @type {(Track | undefined)[]} */
    const trackOf = [];
    const taken = new Set();
    for (const { c, k } of pairs) {
      if (trackOf[c] || taken.has(k)) continue;
      trackOf[c] = tracks[k];
      taken.add(k);
    }
    // Cards no track was close to start a new track. Tracks not seen for a while are dropped.
    found.forEach((f, c) => {
      if (!trackOf[c]) tracks.push((trackOf[c] = { ...f, history: [], lastSeen: frame }));
      const track = /** @type {Track} */ (trackOf[c]);
      Object.assign(track, f, { lastSeen: frame });
      track.history.push(features.map((name) => cards[c][name] ?? null));
      if (track.history.length > frames) track.history.shift();
    });
    tracks = tracks.filter((t) => frame - t.lastSeen < frames);
    return cards.map((card, c) => {
      const history = /** @type {Track} */ (trackOf[c]).history;
      const voted = { ...card };
      features.forEach((name, f) => { voted[name] = winner(history.map((h) => h[f]), limit); });
      return voted;
    });
  }

  return { update, reset: () => { tracks = []; } };
}

// The value most votes agree on, if at least limit of all votes (null votes count as "not sure"). Else null.
/** @param {any[]} votes @param {number} limit */
export function winner(votes, limit) {
  const counts = new Map();
  for (const v of votes) if (v != null) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = null;
  let most = 0;
  for (const [v, n] of counts) if (n > most) [best, most] = [v, n];
  return votes.length && most / votes.length >= limit ? best : null;
}

/**
 * A value that changes only after the same new value came `frames` times in a row (compared as JSON).
 * The first value counts at once. Returns a function: value of this frame → value to show (the same object
 * when the new value counts).
 * @template T @param {number} [frames] @returns {(value: T) => T}
 */
export function holdSteady(frames = 3) {
  let last = '';
  let times = 0;
  /** @type {T | null} */
  let shown = null;
  return (value) => {
    const key = JSON.stringify(value);
    times = key === last ? times + 1 : 1;
    last = key;
    if (times >= frames || shown === null) shown = value;
    return shown;
  };
}

/** @param {Point[]} corners */
function middle(corners) {
  const n = Math.max(1, corners.length);
  return { x: corners.reduce((s, p) => s + p.x, 0) / n, y: corners.reduce((s, p) => s + p.y, 0) / n };
}

/** @param {Point[]} corners */
function diagonal(corners) {
  return corners.length >= 3 ? Math.hypot(corners[2].x - corners[0].x, corners[2].y - corners[0].y) : 0;
}
