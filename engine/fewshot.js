// Few-shot recognition: "this tile looks most like these reference tiles". No training.
// A reference is { label, embedding } (plus an optional small picture, thumb). An embedding is a list of
// numbers from the MediaPipe Image Embedder; similar pictures give similar numbers (cosine similarity).
//
//   const refs = await engine.fetchReferences(new URL('./mygame.refs.json', import.meta.url));
//   const { label, score } = await engine.classify(tile, refs);   // e.g. { label: 'queen', score: 0.93 }
//
// Make the references on tiles.html: tap a tile, give it a name, export the JSON into games/.
import { loadVision, VISION_WASM, MODELS } from './libs.js';
import { busy, startBusy, fetchBytes } from './busy.js';
import { recordStep, recordLoad } from './bench.js';
import { stepsOn, recordScore } from './steps.js';

// ---------- Matching (pure, unit tested) ----------

// Cosine similarity of two number lists: 1 = same direction, 0 = unrelated.
export function cosine(a, b) {
  let dot = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
}

// k nearest neighbours. references: [{ label, embedding }].
// Takes the k most similar references; the label with the highest summed similarity wins.
// Returns { label, score } with score = the best similarity of that label (0..1), or null with no references.
// While the Steps view is on, it also keeps the top 3 names of this tile there (stage "scores").
export function matchTile(embedding, references, k = 3) {
  const result = vote(embedding, references, k);
  if (result && stepsOn()) recordScore({ top: topLabels(embedding, references), label: result.label, backend: null, ms: null });
  return result;
}

function vote(embedding, references, k) {
  if (!references || references.length === 0) return null;
  const nearest = references
    .map((ref) => ({ label: ref.label, similarity: cosine(embedding, ref.embedding) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k);
  const votes = new Map();
  for (const { label, similarity } of nearest) votes.set(label, (votes.get(label) ?? 0) + similarity);
  const [label] = [...votes.entries()].reduce((a, b) => (b[1] > a[1] ? b : a));
  const score = nearest.find((n) => n.label === label).similarity;
  return { label, score: Math.round(score * 1000) / 1000 };
}

// The n best names for a tile: [{ label, score }], best first, score = the best similarity of that name.
// Only for showing (the Steps view); matchTile decides the name.
export function topLabels(embedding, references, n = 3) {
  const best = new Map();
  for (const ref of references ?? []) {
    const similarity = cosine(embedding, ref.embedding);
    if (!(best.get(ref.label) >= similarity)) best.set(ref.label, similarity);
  }
  return [...best.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([label, similarity]) => ({ label, score: Math.round(similarity * 1000) / 1000 }));
}

// ---------- References as JSON (pure, unit tested) ----------

// references → JSON text to save in games/<game>.refs.json. Numbers are rounded to keep the file small.
export function referencesToJSON(references) {
  const list = references.map(({ label, embedding, thumb }) => ({
    label,
    embedding: embedding.map((n) => Math.round(n * 10000) / 10000),
    ...(thumb ? { thumb } : {}),
  }));
  return JSON.stringify({ model: 'mobilenet_v3_small', references: list });
}

// JSON text (or the parsed object) → references. Throws a plain message if the file does not fit.
export function referencesFromJSON(json) {
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  const list = Array.isArray(data) ? data : data?.references;
  if (!Array.isArray(list)) throw new Error('No "references" list in this JSON.');
  return list.map((ref, i) => {
    if (typeof ref.label !== 'string' || !Array.isArray(ref.embedding)) {
      throw new Error(`Reference ${i + 1} needs a "label" and an "embedding" list.`);
    }
    return { label: ref.label, embedding: ref.embedding.map(Number), ...(ref.thumb ? { thumb: ref.thumb } : {}) };
  });
}

// Load references a game ships next to its code. url: e.g. new URL('./set.refs.json', import.meta.url).
export async function fetchReferences(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load references from ${url} (${response.status}).`);
  return referencesFromJSON(await response.json());
}

// ---------- Saved in the browser (IndexedDB) ----------
// One list of references per name (usually the game name). Private browsing or a full disk may block
// IndexedDB; then loading gives [] and saving returns false instead of throwing.

export async function loadReferences(name) {
  try {
    const db = await openDB();
    const value = await request(db.transaction('references').objectStore('references').get(name));
    db.close();
    return value ? referencesFromJSON(value) : [];
  } catch (err) {
    console.warn('loadReferences:', err);
    return [];
  }
}

// Returns true when saved.
export async function saveReferences(name, references) {
  try {
    const db = await openDB();
    const tx = db.transaction('references', 'readwrite');
    tx.objectStore('references').put(JSON.parse(referencesToJSON(references)), name);
    await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
    db.close();
    return true;
  } catch (err) {
    console.warn('saveReferences:', err);
    return false;
  }
}

function openDB() {
  const open = indexedDB.open('board-vision', 1);
  open.onupgradeneeded = () => open.result.createObjectStore('references');
  return request(open);
}

function request(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ---------- The MediaPipe Image Embedder ----------

let embedderPromise = null;
let backend = null;   // 'GPU' or 'CPU' once loaded
const times = [];     // the last few embed() times in ms

// Loads the Image Embedder once: GPU (WebGPU/WebGL) first, CPU (WASM) if that fails.
function loadEmbedder(delegates = ['GPU', 'CPU']) {
  embedderPromise ??= (async () => {
    const start = performance.now();
    const vision = await loadVision();
    const fileset = await vision.FilesetResolver.forVisionTasks(VISION_WASM);
    // Downloaded here (not by MediaPipe) so the busy indicator can show how far it is.
    const model = await busy('Loading picture model…', (job) => fetchBytes(MODELS.imageEmbedder, job.bytes));
    const starting = startBusy('Starting picture model…'); // the WASM runtime loads here too
    try {
      for (const delegate of delegates) {
        try {
          const embedder = await vision.ImageEmbedder.createFromOptions(fileset, {
            baseOptions: { modelAssetBuffer: model, delegate },
            l2Normalize: true,
          });
          backend = delegate;
          recordLoad('embedder', performance.now() - start, delegate);
          return embedder;
        } catch (err) {
          if (delegate === delegates.at(-1)) throw err;
        }
      }
    } catch (err) {
      starting.fail(`Could not start the picture model: ${err.message}`);
      throw err;
    } finally {
      starting.done(); // harmless after fail()
    }
  })();
  embedderPromise.catch(() => { embedderPromise = null; });
  return embedderPromise;
}

// One picture (ImageData, canvas, img, video) → embedding (a list of 1024 numbers).
export async function embed(image) {
  let embedder = await loadEmbedder();
  const start = performance.now();
  let result;
  try {
    result = embedder.embed(image);
  } catch (err) {
    if (backend !== 'GPU') throw err;
    // Some phones load the GPU version but cannot run it: switch to CPU once.
    embedder.close();
    embedderPromise = null;
    embedder = await loadEmbedder(['CPU']);
    result = embedder.embed(image);
  }
  times.push(performance.now() - start);
  recordStep('embed', times.at(-1));
  if (times.length > 20) times.shift();
  return Array.from(result.embeddings[0].floatEmbedding);
}

// Embed a tile and match it: { label, score }, or null with no references. options.k: see matchTile.
// While the Steps view is on, the tile (when it is ImageData), its top 3 names, the backend and the embed time
// go there (stage "scores").
export async function classify(tile, references, { k = 3 } = {}) {
  const embedding = await embed(tile);
  const result = vote(embedding, references, k);
  if (result && stepsOn()) {
    const image = tile?.data ? tile : undefined;
    recordScore({ top: topLabels(embedding, references), label: result.label, image, backend, ms: Math.round(times.at(-1)) });
  }
  return result;
}

// Which backend runs ('GPU', 'CPU' or null before the first embed) and the average ms per tile.
export function embedderInfo() {
  const msPerTile = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;
  return { backend, msPerTile };
}
