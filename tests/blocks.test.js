// @ts-check
// The building blocks (issue #65): each block file is listed in engine/README.md and exported from engine/index.js,
// and no game file imports from another game file (games share code only through engine/).
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import * as engine from '../engine/index.js';

const BLOCKS = ['cards', 'fields', 'color', 'pictures', 'pieces3d', 'iso', 'cover', 'steady', 'pick'];
const read = (/** @type {string} */ path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

export function everyBlockIsDocumentedAndExported() {
  const readme = read('engine/README.md');
  const index = read('engine/index.js');
  for (const block of BLOCKS) {
    assert.match(readme, new RegExp(`^## ${block}$`, 'm'), `engine/README.md explains ${block}`);
    assert.ok(index.includes(`from './${block}.js'`), `engine/index.js exports ${block}`);
  }
  const names = [...readme.matchAll(/engine\.([a-zA-Z]+)\b/g)].map((m) => m[1]).filter((n) => n !== 'js');
  for (const name of names) assert.ok(name in engine, `engine.${name} (used in engine/README.md) exists`);
}

export function gamesDoNotImportOtherGames() {
  // solutions/ is missing in the participant repo's main branch (issue #98).
  for (const folder of ['games', 'solutions'].filter((f) => existsSync(new URL(`../${f}/`, import.meta.url)))) {
    for (const file of readdirSync(new URL(`../${folder}/`, import.meta.url)).filter((f) => f.endsWith('.js'))) {
      const imports = [...read(`${folder}/${file}`).matchAll(/^\s*import\b[^'"]*['"]([^'"]+)['"]/gm)].map((m) => m[1]);
      for (const from of imports) assert.ok(!from.startsWith('./') && !from.startsWith('../games/') && !from.startsWith('../solutions/'), `${folder}/${file} imports ${from}`);
    }
  }
}
