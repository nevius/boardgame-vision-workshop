// Draws a fake board for tile tests: rows × cols cells, each with one of three symbols
// ('dot': red disc, 'cross': black X, 'empty': nothing), slightly moved, sized and noisy per cell.
// Pure code (no canvas), so tests/tiles.test.js and the self-test on tiles.html use the same picture.
// Returns { image: { width, height, data }, labels: labels[row][col] }.
export const LABELS = ['dot', 'cross', 'empty'];

export function fakeBoard({ rows = 4, cols = 6, cell = 64, seed = 7 } = {}) {
  let state = seed;
  const random = () => ((state = (state * 1103515245 + 12345) % 2147483648) / 2147483648);
  const width = cols * cell;
  const height = rows * cell;
  const data = new Uint8ClampedArray(width * height * 4);
  const labels = [];
  for (let row = 0; row < rows; row++) {
    labels.push([]);
    for (let col = 0; col < cols; col++) {
      const label = LABELS[(row * cols + col + row) % LABELS.length];
      labels[row].push(label);
      const cx = (col + 0.5) * cell + (random() - 0.5) * cell * 0.12;
      const cy = (row + 0.5) * cell + (random() - 0.5) * cell * 0.12;
      const size = cell * (0.28 + random() * 0.08);
      for (let y = row * cell; y < (row + 1) * cell; y++) {
        for (let x = col * cell; x < (col + 1) * cell; x++) {
          let rgb = [228, 218, 196]; // paper
          const dx = x - cx;
          const dy = y - cy;
          if (x % cell < 2 || y % cell < 2) rgb = [90, 80, 70]; // grid line
          else if (label === 'dot' && dx * dx + dy * dy < size * size) rgb = [200, 40, 40];
          else if (label === 'cross' && Math.max(Math.abs(dx), Math.abs(dy)) < size
            && Math.min(Math.abs(dx - dy), Math.abs(dx + dy)) < size * 0.35) rgb = [30, 30, 30];
          const noise = (random() - 0.5) * 24;
          const i = (y * width + x) * 4;
          data[i] = rgb[0] + noise;
          data[i + 1] = rgb[1] + noise;
          data[i + 2] = rgb[2] + noise;
          data[i + 3] = 255;
        }
      }
    }
  }
  return { image: { width, height, data }, labels };
}

// The first `perClass` tiles of each label become references; all other tiles are to be recognised.
// Returns { references: [{ label, row, col }], rest: [{ label, row, col }] }.
export function splitReferences(labels, perClass = 3) {
  const taken = new Map();
  const references = [];
  const rest = [];
  labels.forEach((line, row) => line.forEach((label, col) => {
    const count = taken.get(label) ?? 0;
    if (count < perClass) { taken.set(label, count + 1); references.push({ label, row, col }); }
    else rest.push({ label, row, col });
  }));
  return { references, rest };
}
