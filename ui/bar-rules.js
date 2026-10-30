// @ts-check
// Which actions sit in the bottom bar (issue #163), as a small pure function (tested in tests/bar-rules.test.js).
// The bar holds at most BAR_SLOTS equal buttons, icon + label, centred in thumb reach. Camera on/off is always
// first and More (the ⋯ sheet) always last. The slots between are filled in this order:
//   1. a list the game holds open right now (`choices` with `open: true`, e.g. Ubongo's Pieces while fixing a piece
//      picture): it keeps a slot, so its list shows above the bar even with the sheet closed;
//   2. then the rest in the order given. ui/App.js gives Sample photos (only on the empty screen), the page's play
//      buttons (Search again, Freeze, Next photo), then Steps and Save photo. The game's own buttons are not here:
//      they sit in their own column on the right (ui/ActionRail.js, owner 30.10.). A list that does not fit opens
//      inside the sheet (ui/Sheet.js), so lists need no fixed slot.
// What does not fit goes into the sheet. Left to right the buttons keep the order given.
// No Preact here, so the tests run in plain Node.

/** Buttons in the bar, Camera and More included: five fit a 320 px phone at 64 px each. */
export const BAR_SLOTS = 5;

/**
 * @template {{ id: string, choices?: unknown[], open?: boolean }} T
 * @param {T} camera  always first
 * @param {T[]} wanted  the actions in order of importance
 * @param {T} more  always last
 * @returns {{ bar: T[], rest: T[] }}  bar = the buttons left to right, rest = into the sheet
 */
export function barSlots(camera, wanted, more) {
  const room = BAR_SLOTS - 2;
  const held = wanted.filter((a) => a.choices?.length && a.open === true).slice(0, room);
  const others = wanted.filter((a) => !held.includes(a)).slice(0, room - held.length);
  const picked = wanted.filter((a) => held.includes(a) || others.includes(a));
  return { bar: [camera, ...picked, more], rest: wanted.filter((a) => !picked.includes(a)) };
}
