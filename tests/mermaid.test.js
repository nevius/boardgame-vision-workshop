// @ts-check
// Diagrams in the docs are Mermaid blocks (```mermaid in Markdown; GitHub draws them). The real Mermaid parser needs
// a browser, so this is a small syntax check without dependencies: it catches the mistakes that stop GitHub from
// drawing a diagram (unknown type, open brackets or quotes, unquoted labels, ':' in a timeline period) and keeps
// diagrams small. It also checks that docs/ARCHITECTURE.md names every file in engine/ and games/.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = ['flowchart', 'graph', 'sequenceDiagram', 'gantt', 'timeline', 'stateDiagram-v2', 'pie'];
const MAX_BOXES = 15; // "small, one idea each, about 12 boxes" (AGENTS.md); a little room on top
// Mermaid sizes a shape from its label, and the whole chart scales with it (issue #118). A diamond {…} grows in both
// directions, so it gets a short question; a box line longer than 40 characters gets a <br/>.
const MAX_DIAMOND = 20;
const MAX_BOX_LINE = 40;
const KEYWORDS = new Set(['subgraph', 'end', 'direction', 'classDef', 'class', 'style', 'linkStyle', 'click']);

/** Every Markdown file of the repo (not node_modules, not hidden folders). @param {string} dir @returns {string[]} */
function markdownFiles(dir = '') {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) => {
    const path = dir ? `${dir}/${e.name}` : e.name;
    if (e.isDirectory()) return e.name.startsWith('.') || e.name === 'node_modules' ? [] : markdownFiles(path);
    return e.name.endsWith('.md') ? [path] : [];
  });
}

/** @param {string} file @returns {{ where: string, code: string }[]} */
function mermaidBlocks(file) {
  const text = readFileSync(join(root, file), 'utf8');
  return [...text.matchAll(/^```mermaid\n([\s\S]*?)^```/gm)].map((m, i) => ({ where: `${file} diagram ${i + 1}`, code: m[1] }));
}

/** Problems in one diagram, as plain sentences. @param {string} code */
function mermaidProblems(code) {
  const lines = code.split('\n').filter((l) => l.trim() && !l.trim().startsWith('%%'));
  const type = lines[0]?.trim().split(/\s+/)[0] ?? '';
  if (!TYPES.includes(type)) return [`unknown diagram type "${type}"`];
  const problems = [];
  const boxes = new Set();
  for (const line of lines.slice(1)) {
    if ((line.match(/"/g) ?? []).length % 2) problems.push(`odd number of quotes: ${line.trim()}`);
    const bare = line.replace(/"[^"]*"/g, '""'); // what is left outside quoted labels
    for (const [open, close] of ['[]', '()', '{}']) {
      if (bare.split(open).length !== bare.split(close).length) problems.push(`open ${open}${close}: ${line.trim()}`);
    }
    if (type === 'timeline' && line.split(' : ')[0].includes(':')) problems.push(`':' inside a timeline period: ${line.trim()}`);
    if (type !== 'flowchart' && type !== 'graph') continue;
    // A label must be quoted: id["…"], id{"…"}, id[("…")], id(("…")). Unquoted text with (, ) or < breaks it.
    for (const m of bare.matchAll(/[\w-]+(\[\(|\(\(|\[|\{|\()([^"[\](){}]+)/g)) problems.push(`label not in quotes: ${m[0]}`);
    for (const m of line.matchAll(/[\w-]+(\{\{|\{|\(\[|\[\(|\(\(|\[\[|\[\/|\[\\|\[|\(|>)"([^"]*)"/g)) {
      const parts = m[2].split(/<br\s*\/?>/i);
      if (m[1] === '{' && parts.join(' ').length > MAX_DIAMOND) {
        problems.push(`diamond label over ${MAX_DIAMOND} characters (short question, details in the text): ${m[2]}`);
      } else if (m[1] !== '{' && parts.some((p) => p.length > MAX_BOX_LINE)) {
        problems.push(`box label line over ${MAX_BOX_LINE} characters (use <br/>): ${m[2]}`);
      }
    }
    const words = bare.replace(/-[-.]\s+[^>]*?\s*[-.]*->|-+\.?-*>|==+>|---|&/g, ' ').replace(/[[({][^\])}]*[\])}]+/g, ' ');
    const first = words.trim().split(/\s+/)[0];
    if (KEYWORDS.has(first)) continue;
    for (const id of words.split(/\s+/)) if (/^[A-Za-z_][\w-]*$/.test(id)) boxes.add(id);
  }
  if (boxes.size > MAX_BOXES) problems.push(`${boxes.size} boxes, at most ${MAX_BOXES}: split it into two diagrams`);
  return problems;
}

export function mermaidBlocksParse() {
  const blocks = markdownFiles().flatMap(mermaidBlocks);
  assert.ok(blocks.length >= 10, `only ${blocks.length} Mermaid diagrams found`);
  assert.deepEqual(blocks.flatMap((b) => mermaidProblems(b.code).map((p) => `${b.where}: ${p}`)), []);
}

export function mermaidCheckCatchesMistakes() {
  assert.deepEqual(mermaidProblems('flowchart LR\n  a["ok"] --> b["ok"]'), []);
  assert.equal(mermaidProblems('flowcart LR\n  a --> b').length, 1);
  assert.ok(mermaidProblems('flowchart LR\n  a[detect() runs] --> b').length > 0);
  assert.ok(mermaidProblems('flowchart LR\n  a["open] --> b').length > 0);
  assert.ok(mermaidProblems('timeline\n  0:00 : Start').length > 0);
  assert.deepEqual(mermaidProblems('flowchart LR\n  a{"Time to detect?"} --> b["short<br/>lines only"]'), []);
  assert.ok(mermaidProblems('flowchart LR\n  a{"Rate limit: time for detect()?"} --> b["x"]').length > 0);
  assert.ok(mermaidProblems(`flowchart LR\n  a["${'x'.repeat(41)}"] --> b["x"]`).length > 0);
  for (const shape of ['(["', '[/"', '[\\"']) {
    assert.ok(mermaidProblems(`flowchart LR\n  a${shape}${'x'.repeat(41)}"] --> b["x"]`).some((p) => p.includes('over 40')));
  }
  const big = Array.from({ length: 20 }, (_, i) => `  n${i} --> n${i + 1}`).join('\n');
  assert.ok(mermaidProblems(`flowchart TD\n${big}`).some((p) => p.includes('boxes')));
}

export function architectureNamesEveryEngineAndGameFile() {
  const text = readFileSync(join(root, 'docs/ARCHITECTURE.md'), 'utf8');
  const files = ['engine', 'games'].flatMap((dir) => readdirSync(join(root, dir)).map((f) => `${dir}/${f}`));
  assert.deepEqual(files.filter((f) => !text.includes(f)), []);
}
