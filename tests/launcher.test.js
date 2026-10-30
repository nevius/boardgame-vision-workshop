// The demo launcher (workshop/index.html, issue #133): each button opens the right address on both sites.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEMO, DEMOS, demoHref } from '../workshop/launcher.js';
import { flagsFromHash, gameFromHash, solutionFromHash } from '../engine/route.js';
import { games } from '../games/list.js';

export function buttonsOpenTheRightAddress() {
  const href = Object.fromEntries(DEMOS.map((d) => [d.id, demoHref(d.hash, true)]));
  assert.deepEqual(href, {
    ubongo: '../#ubongo&solution&card=A24&camera',
    'ubongo-backup': '../#ubongo&solution&card=A24&replay',
    hands: '../#tictactoe&solution&hands=show&camera',
    set: '../#set&solution&hands=show&camera',
    'set-backup': '../#set&solution&replay',
  });
  // Without solutions/ (the participant copy) every button opens the owner's demo site.
  for (const d of DEMOS) assert.equal(demoHref(d.hash, false), `${DEMO}${d.hash}`);
}

export function everyDemoIsAFinishedGameWithItsFlags() {
  for (const d of DEMOS) {
    const game = gameFromHash(d.hash, games, '');
    assert.equal(d.hash.slice(1).split('&')[0], game, d.id);
    assert.equal(solutionFromHash(d.hash), true, d.id);
    const flags = flagsFromHash(d.hash);
    assert.equal(flags.replay || flags.camera, true, `${d.id}: starts by itself`);
    assert.equal(flags.replay && flags.camera, false, d.id);
  }
  assert.equal(flagsFromHash(DEMOS.find((d) => d.id === 'ubongo').hash).card, 'A24');
  // Live demos show the hand skeleton by default (issue #133, decision 1); Ubongo has no hand watching (config.hands).
  for (const id of ['hands', 'set']) assert.equal(flagsFromHash(DEMOS.find((d) => d.id === id).hash).hands, true, id);
}

// Plan B (issue #150): one line per thing that can go wrong, visible without JavaScript; the QR codes are there.
export function planBAndQrCodesAreOnThePage() {
  const html = readFileSync(new URL('../workshop/index.html', import.meta.url), 'utf8');
  const planB = html.match(/<ul id="plan-b"[^>]*>([\s\S]*?)<\/ul>/)?.[1] ?? '';
  const items = [...planB.matchAll(/<li><b>([^<]+):<\/b>/g)].map((m) => m[1]);
  assert.deepEqual(items, ['No Wi-Fi', 'No camera', 'Pages not live yet', 'Phone too slow']);
  assert.ok(planB.includes(`href="${DEMO}"`), 'plan B links the owner demo');
  assert.ok(planB.includes('pnpm dev'), 'plan B names the laptop fallback');
  for (const name of ['launcher', 'demo', 'repo', 'print']) assert.ok(html.includes(`src="qr/${name}.svg"`), `QR ${name}`);
}
