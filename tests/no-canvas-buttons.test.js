// @ts-check
// Issue #73: games draw only on the board. Buttons go through engine.setActions (icons at the bottom right),
// text through engine.setInfo (the corner chip). This check fails when a game draws or hit-tests buttons itself.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const BUTTONS = /\bdrawButtons\b|\binBox\(|\bsetChip\b|\bbuttonAt\b|\bdrawBar\b/;

export function noGameDrawsButtonsOnTheCanvas() {
  // solutions/ is missing in the participant repo's main branch (issue #98).
  for (const dir of ['games', 'solutions'].filter((d) => existsSync(new URL(`../${d}/`, import.meta.url)))) {
    for (const file of readdirSync(new URL(`../${dir}/`, import.meta.url)).filter((f) => f.endsWith('.js'))) {
      const code = readFileSync(new URL(`../${dir}/${file}`, import.meta.url), 'utf8');
      assert.ok(!BUTTONS.test(code), `${dir}/${file} draws buttons on the picture; use engine.setActions instead`);
    }
  }
}
