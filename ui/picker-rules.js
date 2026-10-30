// @ts-check
// The game picker on the empty screen (issue #152): one card per game in games/list.js with a small picture and
// what you need to play it. A game that is not in the table below (your own) gets the plain picture and its file
// name. Pictures are small (240 × 160 px) files in ui/pictures/. Pure, tested in tests/picker-rules.test.js.

/** @typedef {{ name: string, title: string, picture: string, needs: string }} GameCard */

/** What the picker knows about the games that come with the template. */
const KNOWN = /** @type {Record<string, { title: string, picture: string, needs: string }>} */ ({
  _blank: { title: 'Blank game', picture: 'ui/pictures/_blank.svg', needs: 'Nothing: write your own game' },
  set: { title: 'Set', picture: 'ui/pictures/set.webp', needs: 'Set cards' },
  qwirkle: { title: 'Qwirkle', picture: 'ui/pictures/qwirkle.webp', needs: 'Qwirkle tiles' },
  sudoku: { title: 'Sudoku', picture: 'ui/pictures/sudoku.webp', needs: 'Print sheet, page 1' },
  tictactoe: { title: 'Tic-Tac-Toe', picture: 'ui/pictures/tictactoe.webp', needs: 'Print sheet, page 2 and a pen' },
  ubongo: { title: 'Ubongo 3D', picture: 'ui/pictures/ubongo.webp', needs: 'Ubongo 3D card A24 and its pieces' },
});

/**
 * The cards, in the order of games/list.js.
 * @param {string[]} games
 * @returns {GameCard[]}
 */
export function gameCards(games) {
  return games.map((name) => {
    const known = Object.hasOwn(KNOWN, name) ? KNOWN[name] : null;
    return known ? { name, ...known } : { name, title: name, picture: 'ui/pictures/_blank.svg', needs: 'Your own game' };
  });
}

/**
 * The friendly name of a game ("Blank game", "Ubongo 3D"); your own game keeps its file name.
 * @param {string} name
 */
export function gameTitle(name) {
  return Object.hasOwn(KNOWN, name) ? KNOWN[name].title : name;
}
