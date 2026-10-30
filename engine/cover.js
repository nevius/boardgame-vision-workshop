// @ts-check
// Building block "cover": fill a shape of squares with pieces made of cubes, 1 or more layers high
// (exact cover by backtracking, as in Ubongo). Pure: plain JSON in, plain JSON out.
//
//   const move = coverGrid(['##', '##'], [{ name: 'a', cubes: [[0, 0, 0], [0, 0, 1]] }, …], 1);
//   // → [{ piece: 'a', cells: [[layer, row, col], …] }, …] or null when the pieces do not fit
//
// A cube is [layer, row, col]: layer 0 lies on the table, row grows down, col grows right.
// Pieces may be turned every way a solid can turn (24 ways), never mirrored (a real piece cannot be).
// Used by solutions/ubongo.js (in games/ubongo.js the solver is the workshop task). Limit: plain backtracking, fine for a few pieces (Ubongo has 3–4).

/** @typedef {{ name: string, cubes: number[][] }} CoverPiece */
/** @typedef {{ piece: string, cells: number[][] }} Placement */

// Moves cubes to start at 0, 0, 0 and sorts them (bottom layer first, then reading order).
/** @param {number[][]} cubes */
export function normalize(cubes) {
  const low = [0, 1, 2].map((i) => Math.min(...cubes.map((cube) => cube[i])));
  return cubes.map((cube) => cube.map((n, i) => n - low[i]))
    .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
}

// All different ways a piece can lie: every turn of a solid (24), never a mirror image. Each one normalized.
// Quarter turns around the three axes, repeated until nothing new turns up.
/** @param {number[][]} cubes @returns {number[][][]} */
export function orientations(cubes) {
  /** @type {((cube: number[]) => number[])[]} */
  const turns = [
    ([l, r, c]) => [r, -l, c], // tip forward
    ([l, r, c]) => [c, r, -l], // tip sideways
    ([l, r, c]) => [l, c, -r], // turn flat on the table
  ];
  const result = new Map();
  const todo = [normalize(cubes)];
  while (todo.length) {
    const shape = /** @type {number[][]} */ (todo.pop());
    const key = JSON.stringify(shape);
    if (result.has(key)) continue;
    result.set(key, shape);
    for (const turn of turns) todo.push(normalize(shape.map(turn)));
  }
  return [...result.values()];
}

// Orientations per piece shape, worked out once.
/** @type {Map<string, number[][][]>} */
const known = new Map();
/** @param {number[][]} cubes */
function waysOf(cubes) {
  const key = JSON.stringify(cubes);
  if (!known.has(key)) known.set(key, orientations(cubes));
  return /** @type {number[][][]} */ (known.get(key));
}

/**
 * Fills every '#' of grid `layers` high with exactly these pieces (each used once). Returns the placements in the
 * order they were placed, or null when there is no way. Backtracking: take the first empty space (bottom layer
 * first, reading order); some piece must fill it with its own first cube.
 * @param {string[]} grid rows of '#' (to fill) and '.' (not part of the shape)
 * @param {CoverPiece[]} pieces
 * @param {number} [layers]
 * @returns {Placement[] | null}
 */
export function coverGrid(grid, pieces, layers = 1) {
  // space[layer][row][col] = true while empty.
  const space = Array.from({ length: layers }, () => grid.map((row) => [...row].map((ch) => ch === '#')));
  const open = space.flat(2).filter(Boolean).length;
  if (open === 0 || pieces.length === 0) return null;
  // Quick "no": the cubes must fill the shape exactly.
  if (pieces.reduce((n, p) => n + p.cubes.length, 0) !== open) return null;
  const used = pieces.map(() => false);
  /** @type {Placement[]} */
  const placements = [];
  const free = (l, r, c) => l >= 0 && l < layers && space[l][r]?.[c] === true;

  const firstEmpty = () => {
    for (let l = 0; l < layers; l++) for (let r = 0; r < grid.length; r++) {
      const c = space[l][r].indexOf(true);
      if (c >= 0) return [l, r, c];
    }
    return null;
  };
  const fill = () => {
    const at = firstEmpty();
    if (!at) return true;
    const [l, r, c] = at;
    for (let i = 0; i < pieces.length; i++) {
      if (used[i]) continue;
      for (const shape of waysOf(pieces[i].cubes)) {
        const [l0, r0, c0] = shape[0];
        const cells = shape.map(([dl, dr, dc]) => [l + dl - l0, r + dr - r0, c + dc - c0]);
        if (!cells.every(([z, y, x]) => free(z, y, x))) continue;
        cells.forEach(([z, y, x]) => { space[z][y][x] = false; });
        used[i] = true;
        placements.push({ piece: pieces[i].name, cells });
        if (fill()) return true;
        placements.pop();
        used[i] = false;
        cells.forEach(([z, y, x]) => { space[z][y][x] = true; });
      }
    }
    return false;
  };
  return fill() ? placements : null;
}

/**
 * Several unsure readings, each with options (best first): the first choice of one option per reading, no option
 * twice, that `works` says yes to. Tries at most `maxTries` choices. Returns the names sorted, or null.
 * Example: pieces of one colour look alike on camera, so try the other good matches until the shape is solvable.
 * @param {string[][]} options per reading
 * @param {(names: string[]) => boolean} works
 * @param {number} [maxTries]
 * @param {number} [maxMs] stop after this many ms as well (live video: a phone must not hang on one frame)
 * @returns {string[] | null}
 */
export function firstWorking(options, works, maxTries = 500, maxMs = Infinity) {
  /** @type {string[] | null} */
  let found = null;
  let tries = 0;
  const until = performance.now() + maxMs;
  const walk = (k, names) => {
    if (found || tries > maxTries || (maxMs !== Infinity && performance.now() > until)) return;
    if (k === options.length) {
      tries++;
      if (works(names)) found = [...names].sort();
      return;
    }
    for (const name of options[k]) if (!names.includes(name)) walk(k + 1, [...names, name]);
  };
  walk(0, []);
  return found;
}
