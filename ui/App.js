// @ts-check
// The whole page, laid out like a camera app (issue #163): the picture fills the screen edge to edge; over its top
// edge a solid strip, then the mode chip (the one status place) and the picture-in-picture box top left; the game's
// own buttons in a column on the right (ui/ActionRail.js); at the bottom the one action bar in thumb reach
// (Camera · the frequent page actions · More). The game name and "All pages" are at the top of More (owner 30.10.).
// The controls sheet opens from More in the bottom bar and slides up over the picture.
// Only shows what it is given; app.js does the work. The sheet rules are in ui/sheet-rules.js.
import { html } from 'htm/preact';
import { TopBar } from './TopBar.js';
import { CameraView } from './CameraView.js';
import { Sheet } from './Sheet.js';
import { StatePanel } from './StatePanel.js';
import { BenchPanel } from './BenchPanel.js';
import { CheckPanel } from './CheckPanel.js';
import { DebugOverlay } from './DebugOverlay.js';
import { BottomBar } from './BottomBar.js';
import { ActionRail } from './ActionRail.js';
import { Pip } from './Pip.js';
import { Steps } from './Steps.js';
import { HandLayer } from './HandLayer.js';
import { CameraHelp } from './CameraHelp.js';
import { afterMenu } from './sheet-rules.js';
import { modeChip } from './mode-rules.js';
import { barSlots } from './bar-rules.js';
import { currentHint, hintChip } from './hint-rules.js';
import { gameTitle } from './picker-rules.js';

/**
 * @typedef {object} UiState What the page shows. app.js changes it and calls render again.
 * @property {string[]} games
 * @property {string} game
 * @property {boolean} solution  true when the page runs the finished version (#<game>&solution)
 * @property {boolean} hasSolution  true when the game has a finished version in solutions/ (shows the small key)
 * @property {string} status  the last short message, shown in the mode chip for a moment (ui/Chip.js)
 * @property {number} statusId  counts messages, so the same text shows again
 * @property {import('../engine/busy.js').BusyJob | null} busy  what is loading or working now (engine/busy.js)
 * @property {import('../engine/actions.js').GameUi} gameUi  the game's actions, info chip and picture-in-picture
 * @property {string} stateText
 * @property {import('./sheet-rules.js').SheetSize} sheet  how far the controls sheet is open
 * @property {string} sheetLast  the last open height (remembered); More opens the sheet there
 * @property {Record<string, number>} sheetUse  taps per sheet tile for this game (remembered); most used first
 * @property {'' | 'state' | 'bench' | 'log' | 'check'} panel  the tab of the sheet ('' = the actions)
 * @property {{ report: import('../engine/bench.js').BenchReport, rows: import('../engine/bench.js').BenchRow[] } | null} bench
 * @property {import('../engine/debug.js').LogLine[]} log
 * @property {import('./CheckPanel.js').CheckView} check  "Check my game": the sample photos against their truth, per TODO (issue #149)
 * @property {boolean} update  a new deploy is stored: "New version · reload" next to the mode chip (engine/offline.js)
 * @property {boolean} steps  the Steps view is on (engine/steps.js)
 * @property {string} stepOpen  the stage the Steps view shows large when it opens (&steps=<stage>), '' = none
 * @property {import('../engine/steps.js').Step[]} stepList  the stages of the last frame
 * @property {import('../engine/steps.js').TileScore[]} stepScores  the few-shot scores per tile (last stage)
 * @property {import('../engine/knobs.js').Knob[]} knobs  the knobs with their current values (engine/knobs.js)
 * @property {boolean} live
 * @property {boolean} hasPicture  a camera picture or photo is shown (else the empty screen)
 * @property {boolean} hasReplay  the game has sample photos in replay/<game>/ (an icon on the empty screen)
 * @property {boolean} canSave
 * @property {boolean} canNext
 * @property {boolean} canTap
 * @property {boolean} manualCorners
 * @property {boolean} cornerTaps  false: the game has no "Tap corners" row
 * @property {boolean} canHands  false: the game turns hand watching off (config.hands), so no "Show hands" tile
 * @property {boolean} dragging
 * @property {boolean} fill  the picture fills the screen (cut on two sides) instead of fitting whole ("Fit" in the sheet)
 * @property {import('../engine/speed.js').SpeedChoice} speed  the Speed setting (engine/speed.js)
 * @property {string} paused  why the camera stopped by itself ('' = not stopped); shows "Tap to continue"
 * @property {boolean} locked  a card is anchored (engine/anchor.js): the mode chip says "Locked"
 * @property {boolean} frozen  the picture is frozen (❄ on the picture): camera off, last picture solved
 * @property {boolean} searching  nothing found since the last restart: detect() runs on every frame (issue #139)
 * @property {boolean} hand  a hand is over the board: detect() waits (engine/hands.js); the mode chip says so
 * @property {boolean} moveDone  the hand just left: the mode chip says "Move done · reading" for a moment (issue #145)
 * @property {string} photo  "Photo 2/5" while photos are shown, else ''
 * @property {boolean} showHands  the hand skeleton shows on the live picture (ui/HandLayer.js)
 * @property {number} hints  how many first-run hints were seen (remembered; ui/hint-rules.js)
 * @property {import('../engine/camera.js').CameraHelp | null} cameraHelp  the camera did not start: the steps to fix it (ui/CameraHelp.js)
 */

/** @typedef {import('../engine/actions.js').Action} Action */

/**
 * @param {{
 *   ui: UiState,
 *   canvasRef: import('preact').RefObject<HTMLCanvasElement>,
 *   videoRef: import('preact').RefObject<HTMLVideoElement>,
 *   handRef: import('preact').RefObject<HTMLCanvasElement>,
 *   actions: {
 *     pick: (name: string) => void, solution: () => void, camera: () => void, save: () => void, photos: (files: File[]) => void,
 *     replay: () => void, next: () => void, corners: () => void, steps: () => void, knob: (name: string, value: number) => void, resetKnobs: () => void, panel: (name: '' | 'state' | 'bench' | 'log' | 'check') => void,
 *     sheet: (size: import('./sheet-rules.js').SheetSize) => void,
 *     used: (id: string) => void,
 *     check: () => void, openChecked: (photo: string) => void,
 *     copyBench: () => void, resetBench: () => void, clearLog: () => void,
 *     drop: (files: File[]) => void, drag: (on: boolean) => void, fill: () => void,
 *     speed: (choice: import('../engine/speed.js').SpeedChoice) => void, resume: () => void,
 *     search: () => void, freeze: () => void, hands: () => void, update: () => void, clearCache: () => void,
 *     hint: () => void, hintsAgain: () => void, closeHelp: () => void, reload: () => void,
 *   },
 * }} props
 */
export function App({ ui, canvasRef, videoRef, handRef, actions }) {
  /** @param {DragEvent} e */
  const onDrop = (e) => {
    e.preventDefault();
    actions.drag(false);
    actions.drop([...(e.dataTransfer?.files ?? [])]);
  };
  const open = ui.sheet !== 'closed';
  const game = ui.gameUi;
  // The frequent actions, in order of importance: the page's play buttons first (in thumb reach), then the game's,
  // then Steps and Save. ui/bar-rules.js picks the ones that fit the bottom bar (a list the game holds open always
  // does); the others go to the top of the sheet, where a list opens inside the sheet.
  // Sample photos sit in the bar while nothing is on screen (owner 30.10.); with a picture they move into the sheet.
  const samplesInBar = ui.hasReplay && !ui.hasPicture && !ui.live;
  const wanted = /** @type {Action[]} */ ([
    samplesInBar && { id: 'replay', icon: 'folder-open', label: 'Sample photos', onTap: actions.replay },
    // Search again (issue #139): forgets a locked card or board and reads the picture fresh. The lock itself shows
    // in the mode chip; locking happens by itself, so this one button replaces the old lock icon.
    ui.hasPicture && !ui.frozen && { id: 'search', icon: 'rotate-ccw', label: 'Search again', onTap: actions.search },
    (ui.live || ui.frozen) && { id: 'freeze', icon: 'snowflake', label: ui.frozen ? 'Live' : 'Freeze', active: ui.frozen, onTap: actions.freeze },
    ui.canNext && { id: 'next', icon: 'step-forward', label: 'Next photo', onTap: actions.next },
    ui.hasPicture && { id: 'steps', icon: 'layers', label: 'Steps', active: ui.steps, onTap: actions.steps },
    ui.canSave && { id: 'save', icon: 'image-down', label: 'Save photo', onTap: actions.save },
  ].filter(Boolean));
  const { bar, rest } = barSlots(
    { id: 'camera', icon: ui.live ? 'camera-off' : 'camera', label: ui.live ? 'Stop' : 'Camera', active: ui.live, onTap: actions.camera },
    wanted,
    { id: 'more', icon: 'ellipsis', label: 'More', active: open, onTap: () => actions.sheet(afterMenu(ui.sheet, ui.sheetLast)) },
  );
  // The sheet: what did not fit the bar first (Steps among them, so it stays near the top, issue #163), then the rare ones.
  const rows = /** @type {Action[]} */ ([
    ...rest,
    !samplesInBar && { id: 'replay', icon: 'folder-open', label: 'Sample photos', onTap: actions.replay },
    ui.hasReplay && { id: 'check', icon: 'list-checks', label: 'Check my game', active: ui.panel === 'check', onTap: actions.check },
    ui.cornerTaps && ui.canTap && { id: 'corners', icon: 'scan', label: ui.manualCorners ? 'Forget corners' : 'Tap corners', active: ui.manualCorners, onTap: actions.corners },
    ui.canHands && { id: 'hands', icon: 'hand', label: 'Show hands', active: ui.showHands, onTap: actions.hands },
    { id: 'reload', icon: 'refresh-cw', label: 'Reload', onTap: actions.reload },
    { id: 'clear-cache', icon: 'trash-2', label: 'Clear cache', onTap: actions.clearCache },
    { id: 'hints', icon: 'lightbulb', label: 'Show hints again', onTap: actions.hintsAgain },
    ...game.actions.filter((a) => a.more),
  ].filter(Boolean));
  // The game's own buttons (and the solution key) stay on the right side of the picture, always one tap away
  // (owner 30.10.: no detour through the sheet).
  const rail = /** @type {Action[]} */ ([
    ...game.actions.filter((a) => !a.more),
    ui.hasSolution && { id: 'solution', icon: 'key-round', label: ui.solution ? 'Solution on' : 'Solution', active: ui.solution, onTap: actions.solution },
  ].filter(Boolean));
  // A first-run hint shows in the mode chip (errors stay in front); a tap on the chip shows the next one.
  const mode = modeChip({ ...ui, info: game.info });
  const hint = mode.tone === 'error' ? null : hintChip(ui.hints);
  return html`
    <div
      class="flex h-dvh flex-col overflow-hidden bg-neutral-950 text-neutral-100 select-none"
      onDragOver=${(/** @type {DragEvent} */ e) => { e.preventDefault(); if (!ui.dragging) actions.drag(true); }}
      onDragLeave=${() => actions.drag(false)}
      onDrop=${onDrop}
    >
      <main class="relative min-h-0 flex-1">
        <${CameraView} canvasRef=${canvasRef} videoRef=${videoRef} dragging=${ui.dragging} fill=${ui.fill && ui.live}
          empty=${!ui.hasPicture} games=${ui.games} game=${ui.game} onPick=${actions.pick} paused=${ui.paused} onContinue=${actions.resume}
          />
        <${HandLayer} canvasRef=${handRef} fill=${ui.fill} on=${ui.showHands && ui.live} />
        ${ui.cameraHelp && html`<${CameraHelp} help=${ui.cameraHelp} hasReplay=${ui.hasReplay} onAgain=${actions.camera} onReplay=${actions.replay} onClose=${actions.closeHelp} />`}
        ${ui.hasPicture && html`
          ${ui.steps && html`<${Steps} open=${ui.stepOpen} steps=${ui.stepList} scores=${ui.stepScores} knobs=${ui.knobs} onKnob=${actions.knob} onResetKnobs=${actions.resetKnobs} />`}
          ${game.pip && html`<${Pip} pip=${game.pip} />`}
          <${ActionRail} actions=${rail} />
        `}
        <${TopBar}
          photo=${ui.photo} solution=${ui.solution} chip=${hint ?? mode} onChip=${hint ? actions.hint : undefined}
          flash=${ui.status} flashId=${ui.statusId} progress=${ui.busy?.progress ?? null} update=${ui.update} onUpdate=${actions.update}
        />
        ${open && html`
          <!-- A tap outside the sheet closes it (and does not reach the game). -->
          <div class="absolute inset-0 z-20" aria-hidden="true" onClick=${() => actions.sheet('closed')}></div>
          <${Sheet}
            size=${ui.sheet} tab=${ui.panel} rows=${rows} fill=${ui.fill} speed=${ui.speed}
            games=${ui.games} game=${ui.game} title=${gameTitle(ui.game)} onPick=${actions.pick}
            solution=${ui.solution} hasSolution=${ui.hasSolution} onSolution=${actions.solution}
            use=${ui.sheetUse} onUse=${actions.used} onSize=${actions.sheet} onTab=${actions.panel} onPhotos=${actions.photos} onFill=${actions.fill} onSpeed=${actions.speed}
          >
            ${ui.panel === 'state' && html`<${StatePanel} text=${ui.stateText} />`}
            ${ui.panel === 'bench' && ui.bench && html`<${BenchPanel}
              report=${ui.bench.report} rows=${ui.bench.rows} onCopy=${actions.copyBench} onReset=${actions.resetBench}
            />`}
            ${ui.panel === 'check' && html`<${CheckPanel} check=${ui.check} onRun=${actions.check} onOpen=${actions.openChecked} />`}
            ${ui.panel === 'log' && html`<${DebugOverlay} lines=${ui.log} onClear=${actions.clearLog} />`}
          <//>
        `}
      </main>
      <${BottomBar} actions=${bar} ring=${hint ? currentHint(ui.hints)?.bar : ''} />
    </div>
  `;
}
