// @ts-check
// The demo launcher (workshop/index.html, issue #133): one tap per live demo, plus a pre-flight check.
// The demos need the finished games (solutions/). This site has them → the buttons open this site's app.
// The participant copy without solutions/ → the buttons open the owner's demo site (DEMO) instead.
// The pure part (which address each button opens) is tested in tests/launcher.test.js.

// The owner's demo site (same as DEMO in export/config.js; a test checks).
export const DEMO = 'https://jannistriestocode.github.io/board-vision/';

// The buttons. hash: the app address (flags in engine/route.js). Hands: Tic-Tac-Toe on the printed sheet, because
// the sheet is flat and white, so the skeleton stands out, and every move is one hand in and out. Not on Ubongo:
// it turns hand watching off (config.hands = false), so there is no skeleton to show.
export const DEMOS = [
  { id: 'ubongo', label: 'Ubongo live', about: 'Card A24 already confirmed, camera on', hash: '#ubongo&solution&card=A24&camera' },
  { id: 'ubongo-backup', label: 'Ubongo backup', about: 'The replay photos, no camera', hash: '#ubongo&solution&card=A24&replay' },
  { id: 'hands', label: 'Hands live', about: 'Tic-Tac-Toe sheet, hand skeleton on', hash: '#tictactoe&solution&hands=show&camera' },
  { id: 'set', label: 'Set live', about: 'Camera on', hash: '#set&solution&hands=show&camera' },
  { id: 'set-backup', label: 'Set backup', about: 'The replay photos, no camera', hash: '#set&solution&replay' },
];

// The address a button opens: this site's app ("../" from workshop/) when it has solutions/, else the demo site.
/** @param {string} hash @param {boolean} local */
export function demoHref(hash, local) {
  return `${local ? '../' : DEMO}${hash}`;
}

// ---------------------------------------------------------------- the page (browser only)

if (typeof document !== 'undefined' && document.getElementById('demos')) page();

async function page() {
  // Reload (issue #196: no F5 in a full-screen app): takes a waiting new version first.
  document.getElementById('reload')?.addEventListener('click', async () => { (await import('../engine/offline.js')).applyUpdate(); });
  const { browserCheck, installHint, isInstalled } = await import('../engine/device.js');
  const { httpsCheck, cameraCheck, wasmCheck, wakeLockCheck, loadModel } = await import('../engine/checks.js');
  const { loadOpenCV, loadVision, MODELS, LIBRARY_FILES } = await import('../engine/libs.js');
  const { downloadRows, withNote } = await import('../ui/download-rows.js');

  const local = await fetch('../solutions/ubongo.js', { method: 'HEAD', cache: 'no-store' }).then((r) => r.ok, () => false);
  const box = /** @type {HTMLElement} */ (document.getElementById('demos'));
  for (const demo of DEMOS) {
    const link = document.createElement('a');
    link.className = 'demo';
    link.href = demoHref(demo.hash, local);
    link.dataset.demo = demo.id;
    link.innerHTML = '<strong></strong><span></span>';
    /** @type {HTMLElement} */ (link.firstChild).textContent = demo.label;
    /** @type {HTMLElement} */ (link.lastChild).textContent = demo.about;
    box.append(link);
  }
  // One line: how to put the app on the home screen (issue #151).
  /** @type {HTMLElement} */ (document.getElementById('install')).textContent = `Install: ${installHint(navigator.userAgent, isInstalled(window)).text}`;
  const where = /** @type {HTMLElement} */ (document.getElementById('where'));
  if (!local) {
    // The browser cache is per site: a pre-flight here does not warm the demo site.
    where.innerHTML = 'The demos open the owner\'s demo site. Pre-flight here warms <em>this</em> site only: for the demos, run it on <a></a>.';
    const a = /** @type {HTMLAnchorElement} */ (where.querySelector('a'));
    a.href = `${DEMO}workshop/`;
    a.textContent = `${DEMO}workshop/`;
  }

  const list = /** @type {HTMLElement} */ (document.getElementById('checks'));
  const summary = /** @type {HTMLElement} */ (document.getElementById('summary'));
  const button = /** @type {HTMLButtonElement} */ (document.getElementById('preflight'));
  /** @type {WakeLockSentinel | null} */
  let lock = null;

  button.addEventListener('click', async () => {
    button.disabled = true;
    list.textContent = '';
    summary.textContent = 'Checking…';
    summary.className = '';
    let failed = 0;
    // One line per item: a green tick or a red reason.
    // line: a download row to finish (issue #162); else a new line.
    /** @param {string} name @param {() => any} check @param {HTMLLIElement} [line] */
    const step = async (name, check, line) => {
      if (!line) {
        line = document.createElement('li');
        line.className = 'wait';
        line.textContent = `… ${name}`;
        list.append(line);
      }
      let result;
      try {
        result = await check();
      } catch (err) {
        result = { ok: false, text: err.message || String(err), fix: 'Reload the page. If it stays red, try another browser or Wi-Fi.' };
      }
      if (!result.ok) failed++;
      line.className = result.ok ? 'good' : 'bad';
      line.textContent = `${result.ok ? '✓' : '✗'} ${name}: ${result.text}`;
      if (result.fix) {
        const fix = document.createElement('div');
        fix.className = 'fix';
        fix.textContent = result.fix;
        line.append(fix);
      }
      return result;
    };
    await step('Browser', () => browserCheck(navigator.userAgent));
    await step('HTTPS', httpsCheck);
    await step('Camera', cameraCheck);
    await lock?.release().catch(() => {});
    lock = (await step('Wake lock', wakeLockCheck)).lock ?? null;
    await step('WebAssembly', wasmCheck);
    // The big files download side by side, with MB and time left per file (issue #162); then each one starts.
    const files = downloadRows(list, LIBRARY_FILES);
    const file = (/** @type {string} */ name) => /** @type {NonNullable<ReturnType<typeof files.get>>} */ (files.get(name));
    await step('OpenCV.js', async () => { const d = await file('OpenCV.js').ready; await loadOpenCV(); return withNote({ ok: true, text: 'loaded' }, d); }, file('OpenCV.js').line);
    await step('MediaPipe WASM', async () => { const d = await file('MediaPipe WASM').ready; await loadVision(); return withNote({ ok: true, text: 'loaded' }, d); }, file('MediaPipe WASM').line);
    await step('Image Embedder model', async () => { const d = await file('Image Embedder model').ready; return withNote(await loadModel('ImageEmbedder', MODELS.imageEmbedder, d.bytes), d); }, file('Image Embedder model').line);
    await step('Hand Landmarker model', async () => { const d = await file('Hand Landmarker model').ready; return withNote(await loadModel('HandLandmarker', MODELS.handLandmarker, d.bytes), d); }, file('Hand Landmarker model').line);
    summary.textContent = failed ? `${failed} problem(s): see the red lines.` : 'All good: ready for the demos.';
    summary.className = failed ? 'bad' : 'good';
    button.disabled = false;
  });
}
