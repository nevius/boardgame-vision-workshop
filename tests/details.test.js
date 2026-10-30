// @ts-check
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { calloutBox, setTap, tapPoint, detailsOn } from '../engine/details.js';

// The callout sits above the tap and never leaves the picture.
export function calloutStaysInside() {
  assert.deepEqual(calloutBox({ x: 100, y: 100 }, 60, 20, 400, 300), { x: 70, y: 70, width: 60, height: 20 });
  assert.equal(calloutBox({ x: 5, y: 100 }, 60, 20, 400, 300).x, 0, 'left edge');
  assert.equal(calloutBox({ x: 398, y: 100 }, 60, 20, 400, 300).x, 340, 'right edge');
  assert.equal(calloutBox({ x: 100, y: 10 }, 60, 20, 400, 300).y, 20, 'below the tap at the top edge');
}

// app.js draws again only for a game whose last draw() asked for the tap.
export function tapRedrawsOnlyWhenAsked() {
  setTap(null);
  tapPoint(); // a draw() that reads the tap
  assert.equal(setTap({ x: 1, y: 2 }), true);
  assert.equal(setTap({ x: 3, y: 4 }), false, 'nobody drew since, so nobody asked');
  assert.deepEqual(tapPoint(), { x: 3, y: 4 });
  setTap(null);
  assert.equal(tapPoint(), null);
  assert.equal(detailsOn(), false, 'Steps view is off by default');
  tapPoint();
  setTap(null); // a game switch
  assert.equal(setTap({ x: 5, y: 6 }), false, 'the game before asked, the new one did not');
  setTap(null);
}

// Clean overlay: the Qwirkle and Set starters and solutions keep labels for the Steps view (or a tap).
export function gamesUseDetails() {
  // solutions/ is missing in the participant repo's main branch (issue #98).
  const files = ['games/qwirkle.js', 'solutions/qwirkle.js', 'games/set.js', 'solutions/set.js'];
  for (const file of files.filter((f) => existsSync(new URL(`../${f}`, import.meta.url)))) {
    const text = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.match(text, /detailsOn\(\)/, file);
  }
}
