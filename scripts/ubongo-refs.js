// @ts-check
// Makes games/ubongo.refs.json: the reference cut-outs of the piece pictures on Ubongo cards (issue #56), from the
// card photos in replay/ubongo/cards/ and their truth files (pieces per roll). Needs pnpm install (dev tools).
// The check also scores the owner's newer card-27 photos (replay/ubongo/cards-owner/, issue #158), which are not
// used for references.
//   node scripts/ubongo-refs.js          write games/ubongo.refs.json, then print the score per card
//   node scripts/ubongo-refs.js --check  only print the score: with all references, and with each card's own
//                                        pictures left out (how well a new card would read; for an owner photo:
//                                        the photos of the same card left out)
import { writeFileSync } from 'node:fs';
import jpeg from 'jpeg-js';
import * as engine from '../engine/index.js';
import { CARDS, OWNER_CARDS, cardOf, loadCard, makeRefs, scoreCard } from '../replay/ubongo/icons-check.js';
import { readPictures } from '../games/ubongo.js';

const photos = [];
for (const name of CARDS) photos.push(await loadCard(name, engine, jpeg));
const refs = makeRefs(photos);
const checked = [...photos];
if (process.argv.includes('--check')) for (const name of OWNER_CARDS) checked.push(await loadCard(name, engine, jpeg));
if (!process.argv.includes('--check')) {
  const text = `{"about":"Ubongo piece pictures on cards (issue #56), made by scripts/ubongo-refs.js","refs":[\n${refs.map((r) => JSON.stringify(r)).join(',\n')}\n]}\n`;
  writeFileSync(new URL('../games/ubongo.refs.json', import.meta.url), text);
  console.log(`games/ubongo.refs.json: ${refs.length} references`);
}

/** @param {string} title @param {(photo: any) => any[]} refsFor */
function table(title, refsFor) {
  console.log(`\n${title}\n| card | pictures right | rolls right | rolls passing the cube count | of them right | unsure | ms |\n|---|---|---|---|---|---|---|`);
  let right = 0;
  let total = 0;
  for (const photo of checked) {
    const r = refsFor(photo);
    const start = performance.now();
    readPictures(photo.big, photo.fields, r);
    const ms = Math.round(performance.now() - start);
    const rows = scoreCard(photo, r);
    const sum = (/** @type {(x: any) => number} */ f) => rows.reduce((n, x) => n + f(x), 0);
    right += sum((x) => x.right);
    total += sum((x) => x.total);
    const counted = rows.filter((x) => x.counted);
    console.log(`| ${photo.name} | ${sum((x) => x.right)}/${sum((x) => x.total)} | ${rows.filter((x) => x.whole).length}/${rows.length} | ${counted.length} | ${counted.filter((x) => x.whole).length} | ${sum((x) => x.unsure)} | ${ms} |`);
    for (const x of rows) if (!x.whole) console.log(`|  | roll ${x.roll}: read ${x.read.join(' ')} | | ${x.counted ? 'passes' : 'fails'} | | | |`);
  }
  console.log(`all: ${right}/${total} pictures right (${Math.round((100 * right) / total)} %)`);
}
table('With all references', () => refs);
if (process.argv.includes('--check')) table('Each card left out of the references', (photo) => makeRefs(photos.filter((p) => cardOf(p.name) !== cardOf(photo.name))));
