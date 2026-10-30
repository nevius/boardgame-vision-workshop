// @ts-check
// The checker for Ubongo solutions, separate from the solver in solutions/ubongo.js. Used by node replay/run.js ubongo
// (it loads replay/<game>/check.js when there is one) and by tests/ubongo.test.js.
import { cubesOf, LAYERS } from '../../games/ubongo.js';
import { orientations } from '../../engine/cover.js';

// True when the move fills every '#' of state.grid exactly LAYERS high (each square once per layer, nothing
// outside the shape or above the top layer), uses each piece of state.pieces once, each piece in one of its turns.
/** @param {{ grid: string[], pieces: string[] }} state @param {{ placements: { piece: string, cells: number[][] }[] } | null} move */
export function checkMove(state, move) {
  const { grid, pieces } = state;
  if (!pieces.length && !move) return true; // a card photo without pieces: nothing to place
  if (!move) return false;
  const placed = move.placements.map((p) => p.piece).sort();
  if (JSON.stringify(placed) !== JSON.stringify([...pieces].sort())) return false;
  const filled = new Set();
  for (const { piece, cells } of move.placements) {
    const low = [0, 1, 2].map((i) => Math.min(...cells.map((cube) => cube[i])));
    const shape = JSON.stringify(cells.map((cube) => cube.map((n, i) => n - low[i])).sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]));
    if (!orientations(cubesOf(piece)).some((o) => JSON.stringify(o) === shape)) return false;
    for (const [l, r, c] of cells) {
      const key = `${l},${r},${c}`;
      if (l < 0 || l >= LAYERS || grid[r]?.[c] !== '#' || filled.has(key)) return false;
      filled.add(key);
    }
  }
  return filled.size === LAYERS * grid.join('').split('').filter((ch) => ch === '#').length;
}
