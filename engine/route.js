// Turns the URL hash ("#qwirkle") into a game name from the list. Unknown names fall back to the default.
// "#set&solution" also picks set; solutionFromHash says whether to load solutions/set.js instead.
export function gameFromHash(hash, games, fallback) {
  const name = hashParts(hash)[0];
  return games.includes(name) ? name : fallback;
}

// True when the hash asks for the finished version: "#<game>&solution" (for the workshop owner).
export function solutionFromHash(hash) {
  return hashParts(hash).slice(1).includes('solution');
}

// The small demo flags after the game name (issue #133, used by the launcher workshop/index.html):
//   &card=A24    Ubongo: this card from the repo's known cards counts as confirmed (no "Card looks right ✓").
//   &replay      start the game's replay photos right away (the backup when the camera fails).
//   &hands=show  draw the hand skeleton and the hand chip on the picture.
//   &camera      start the camera right away (the launcher's pre-flight asked for the permission).
//   &steps=rules open the Steps view with this stage shown large (issue #159, the ▶ buttons on the slides);
//                &steps alone opens the view. Stage names as in the Steps strip: rules, scores, fingerprint, …
// Unknown flags are ignored. card is upper case (or null), steps is a stage name, '' (view only) or null (off).
/** @param {string | undefined} hash @returns {{ card: string | null, replay: boolean, hands: boolean, camera: boolean, steps: string | null }} */
export function flagsFromHash(hash) {
  const parts = hashParts(hash).slice(1);
  const card = parts.find((p) => p.startsWith('card='))?.slice(5).toUpperCase() || null;
  const step = parts.find((p) => p === 'steps' || p.startsWith('steps='));
  const steps = step === undefined ? null : step.slice(6);
  return { card, replay: parts.includes('replay'), hands: parts.includes('hands=show'), camera: parts.includes('camera'), steps };
}

// The flags each game opens with, for the "All pages" list (links.js, issue #179). &card= is added per known card
// (pages.json) and &steps=<stage> has no fixed list of stages. A test fails when a flag above is missing here.
export const FLAGS = ['replay', 'camera', 'steps', 'hands=show'];

function hashParts(hash) {
  return decodeURIComponent(String(hash || '').replace(/^#/, '')).split('&').map((part) => part.trim().toLowerCase());
}

// The games that have a finished version in solutions/ (the ⋯ sheet shows the small key only for these).
// Found by asking the server for solutions/<game>.js: no list to keep up to date, and a copy without
// solutions/ (the participant repo's main branch) shows no key. Not linked anywhere: solutions stay hidden.
// _blank (the empty starter) never has one: not asked, so the console shows no 404 for it (issue #201).
/** @param {string[]} games @param {(url: string) => Promise<boolean>} exists @returns {Promise<string[]>} */
export async function findSolutionGames(games, exists) {
  const found = await Promise.all(games.map((game) => game !== '_blank' && exists(`./solutions/${game}.js`).catch(() => false)));
  return games.filter((_, i) => found[i]);
}

// The hash that turns solution mode on or off for a game: "#ubongo&solution" ↔ "#ubongo".
/** @param {string} game @param {boolean} on */
export function solutionHash(game, on) {
  return on ? `#${game}&solution` : `#${game}`;
}
