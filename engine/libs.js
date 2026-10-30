// Loads the big libraries only when needed. Versions are pinned in the import map in index.html.
import { recordLoad } from './bench.js';
import { busy } from './busy.js';

let visionPromise = null;
let cvPromise = null;
let cvLoadMs = null;

// MediaPipe Tasks Vision (Image Embedder, Hand Landmarker).
export function loadVision() {
  visionPromise ??= busy('Loading MediaPipe…', () => import('@mediapipe/tasks-vision'));
  visionPromise.catch(() => { visionPromise = null; }); // offline: the next try loads again
  return visionPromise;
}

// OpenCV.js (WASM). Resolves with cv once it is ready to use.
export function loadOpenCV() {
  // Careful: cv has its own .then(), so never "await cv" directly; that never finishes.
  const start = performance.now();
  cvPromise ??= busy('Loading OpenCV (~10 MB the first time)…', () => import('@techstark/opencv-js').then((mod) => new Promise((resolve, reject) => {
    const cv = /** @type {any} */ (mod.default);
    // If the WASM never starts, say so instead of loading forever.
    const timer = setTimeout(() => reject(new Error('OpenCV did not start within 2 minutes')), 120000);
    const done = () => { clearTimeout(timer); delete cv.then; cvLoadMs = Math.round(performance.now() - start); recordLoad('opencv', cvLoadMs, 'WASM'); resolve(cv); };
    if (cv.Mat) done();
    else cv.onRuntimeInitialized = done;
  })));
  cvPromise.catch(() => { cvPromise = null; }); // offline: the next try loads again
  return cvPromise;
}

// How long the first OpenCV.js load took (download + WASM start), in milliseconds. null until loaded.
export function openCVLoadTime() {
  return cvLoadMs;
}

// Where MediaPipe finds its WASM files. Keep the version equal to the import map in index.html.
export const VISION_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm';

// The model files. Issues #4 and #5 use these same URLs, so check.html fills the browser cache for them.
export const MODELS = {
  imageEmbedder: 'https://storage.googleapis.com/mediapipe-models/image_embedder/mobilenet_v3_small/float32/1/mobilenet_v3_small.tflite',
  handLandmarker: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
};

// The big files the pre-flight downloads with progress (issue #162), in the order of its list. url() gives the
// address the library itself loads later, so that load comes from the cache: OpenCV.js through the import map,
// MediaPipe's WASM file the way its FilesetResolver picks it (SIMD or not; needs the small library first).
/** @type {{ name: string, url: () => Promise<string | null> }[]} */
export const LIBRARY_FILES = [
  { name: 'OpenCV.js', url: async () => import.meta.resolve?.('@techstark/opencv-js') ?? null },
  { name: 'MediaPipe WASM', url: async () => (await (await loadVision()).FilesetResolver.forVisionTasks(VISION_WASM)).wasmBinaryPath },
  { name: 'Image Embedder model', url: async () => MODELS.imageEmbedder },
  { name: 'Hand Landmarker model', url: async () => MODELS.handLandmarker },
];
