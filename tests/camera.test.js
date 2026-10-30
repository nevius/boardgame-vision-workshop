import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cameraErrorText, cameraHelp, photoName } from '../engine/camera.js';

export function explainsCameraErrors() {
  assert.match(cameraErrorText({ name: 'NotAllowedError' }), /permission/i);
  assert.match(cameraErrorText({ name: 'NotReadableError' }), /busy/i);
  assert.match(cameraErrorText({ name: 'NotFoundError' }), /No camera/);
  assert.match(cameraErrorText({ name: 'NotAllowedError' }, { secure: false }), /https/);
  assert.match(cameraErrorText({ name: 'Weird', message: 'boom' }), /Weird: boom/);
}

export function namesSnapshotsByGameAndTime() {
  assert.equal(photoName('qwirkle', new Date(2026, 9, 16, 14, 5, 1)), 'qwirkle-2026-10-16-140501.jpg');
}

// Issue #153: each camera error gets the right steps for each phone, from one place (app panel and device check).
const IPHONE = { os: 'ios', browser: 'safari' };
const IPHONE_CHROME = { os: 'ios', browser: 'chrome' };
const ANDROID = { os: 'android', browser: 'chrome' };
const LAPTOP = { os: 'desktop', browser: 'any' };

export function givesCameraHelpPerErrorAndPhone() {
  for (const device of [IPHONE, IPHONE_CHROME, ANDROID, LAPTOP]) {
    for (const [name, kind] of [['NotAllowedError', 'denied'], ['SecurityError', 'denied'], ['NotFoundError', 'none'],
      ['NotReadableError', 'busy'], ['TrackStartError', 'busy'], ['Weird', 'other']]) {
      const help = cameraHelp({ name }, { device });
      assert.equal(help.kind, kind, `${name} on ${device.os}`);
      assert.ok(help.steps.length >= 1 && help.steps.length <= 4, `${name} on ${device.os}: 1–4 steps`);
      assert.ok(help.title.length > 0);
    }
    // Not on https: the secure-page steps, whatever the error.
    assert.equal(cameraHelp({ name: 'NotAllowedError' }, { secure: false, device }).kind, 'insecure');
    assert.equal(cameraHelp({ name: 'NoMediaDevices' }, { secure: false, device }).kind, 'insecure');
    // On https but without camera access in this browser: another browser, not the https steps.
    assert.equal(cameraHelp({ name: 'NoMediaDevices' }, { device }).kind, 'browser');
  }
}

export function cameraHelpStepsFitThePhone() {
  const steps = (device) => cameraHelp({ name: 'NotAllowedError' }, { device }).steps.join(' ');
  assert.match(steps(IPHONE), /Website Settings/);
  assert.match(steps(IPHONE), /Settings app → Apps → Safari → Camera/);
  assert.doesNotMatch(steps(IPHONE), /Android/);
  assert.match(steps(IPHONE_CHROME), /Apps → Chrome → Camera/);
  assert.doesNotMatch(steps(IPHONE_CHROME), /Website Settings/);
  assert.match(steps(ANDROID), /Permissions/);
  assert.match(steps(ANDROID), /Apps → Chrome → Permissions → Camera/);
  assert.doesNotMatch(steps(ANDROID), /Safari/);
  assert.match(steps(LAPTOP), /left of the address/);
  // The official help page for the phone; none on errors where no setting helps.
  assert.match(cameraHelp({ name: 'NotAllowedError' }, { device: IPHONE }).link?.url ?? '', /support\.apple\.com/);
  assert.match(cameraHelp({ name: 'NotAllowedError' }, { device: ANDROID }).link?.url ?? '', /support\.google\.com/);
  assert.equal(cameraHelp({ name: 'NotReadableError' }, { device: IPHONE }).link, null);
  // Every step ends a sentence; the steps mention "Try again" where trying again helps.
  assert.match(steps(IPHONE), /Try again/);
  assert.match(cameraHelp({ name: 'NotReadableError' }, { device: ANDROID }).steps.join(' '), /Try again/);
}

export function helpPanelOffersTryAgainAndSamples() {
  const src = readFileSync(new URL('../ui/CameraHelp.js', import.meta.url), 'utf8');
  assert.match(src, /Try again/);
  assert.match(src, /Use sample photos instead/);
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(app, /cameraHelp: err\.help/, 'a failed camera start opens the help panel');
  const check = readFileSync(new URL('../engine/checks.js', import.meta.url), 'utf8');
  assert.match(check, /cameraHelp\(/, 'the device check uses the same texts');
}
