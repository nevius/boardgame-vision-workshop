// Pure helpers for check.html: which browser is this, and what should the participant do about it.
// No DOM here, so tests can run in node.

// Reads the user agent string. Returns { os: 'ios'|'android'|'desktop', browser, version }.
// version is the iOS/Safari version on iPhone (Safari 26 = iOS 26), the Chrome version on Android.
export function readBrowser(ua = '') {
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && /Mobile\//.test(ua));
  if (ios) {
    // Every browser on iPhone is Safari inside. "Version/26.4" is the Safari (= iOS) version.
    const m = ua.match(/Version\/(\d+)(?:\.(\d+))?/) || ua.match(/OS (\d+)_(\d+)/);
    const browser = /CriOS/.test(ua) ? 'chrome' : /FxiOS/.test(ua) ? 'firefox' : 'safari';
    return { os: 'ios', browser, version: m ? `${m[1]}.${m[2] || 0}` : null };
  }
  if (/Android/.test(ua)) {
    const other = /SamsungBrowser|Firefox|OPR|EdgA|UCBrowser|wv\)/.test(ua);
    const m = ua.match(/Chrome\/(\d+)/);
    return { os: 'android', browser: m && !other ? 'chrome' : 'other', version: m ? Number(m[1]) : null };
  }
  return { os: 'desktop', browser: 'any', version: null };
}

// One check result for the browser itself: { ok, text, fix }.
export function browserCheck(ua) {
  const b = readBrowser(ua);
  if (b.os === 'ios') {
    if (b.version !== null && olderThan(b.version, '26.4')) {
      return { ok: false, text: `iPhone with iOS ${b.version}`, fix: 'Update iOS to 26.4 or later (Settings → General → Software Update).' };
    }
    return { ok: true, text: `iPhone, iOS ${b.version ?? '(version unknown)'}` };
  }
  if (b.os === 'android') {
    if (b.browser !== 'chrome') return { ok: false, text: 'Android, not Chrome', fix: 'Use Chrome on Android.' };
    return { ok: true, text: `Android, Chrome ${b.version}` };
  }
  return { ok: true, text: 'Laptop or desktop browser' };
}

// How to install the app on this device (issue #151): one plain line, never a pop-up. On iPhone the home screen
// app also keeps the device cache longer. installed = the page already runs as the app (isInstalled).
export function installHint(ua, installed = false) {
  if (installed) return { ok: true, text: 'running as the installed app' };
  const b = readBrowser(ua);
  if (b.os === 'ios') return { ok: true, text: 'Safari: Share button → Add to Home Screen. Opens full screen and keeps the cache longer.' };
  if (b.os === 'android') return { ok: true, text: 'Chrome: menu ⋮ → Install app (or Add to Home screen). Opens full screen.' };
  return { ok: true, text: 'optional on a laptop: Chrome or Edge, install icon at the right end of the address bar.' };
}

// Whether the page runs as the home screen app. Takes window, so tests can pass a stand-in.
export function isInstalled(win) {
  return Boolean(win.matchMedia?.('(display-mode: standalone)').matches || win.navigator?.standalone);
}

// Plain text for "Copy result": one line per check.
export function resultText(results, ua) {
  const lines = results.map((r) => `${r.ok ? 'OK  ' : 'FAIL'} ${r.name}: ${r.text}${r.ms != null ? ` (${r.ms} ms)` : ''}`);
  return [`board-vision device check, ${new Date().toISOString().slice(0, 10)}`, ua, ...lines].join('\n');
}

// '26.10' vs '26.4': compares major, then minor, as numbers.
export function olderThan(version, wanted) {
  const [a, b] = version.split('.').map(Number);
  const [c, d] = wanted.split('.').map(Number);
  return a < c || (a === c && b < d);
}
