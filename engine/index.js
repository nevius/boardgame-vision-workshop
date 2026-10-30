// The engine: shared helpers that games/<game>.js gets as its "engine" argument.
// Keep this list small. Each function is filled in by the issue named next to it.
// Building blocks (issue #65): what each one does, an example and its limits are in engine/README.md.
export { loadVision, loadOpenCV, openCVLoadTime } from './libs.js';
export { openCamera, loadPhoto } from './camera.js';   // issue #2
export { findBoard, findCards, straighten, drawQuads, setManualCorners } from './warp.js'; // issue #3
export { tapCorners } from './corners.js';                                                // issue #3
export { boardPoint } from './geometry.js';                                              // issue #10: draw on a board
export { cutTiles, cropTiles, dominantColor, averageColor, colorName, pixelEmbedding } from './tiles.js'; // issue #4
export {
  embed, classify, matchTile, embedderInfo,
  loadReferences, saveReferences, fetchReferences, referencesToJSON, referencesFromJSON,
} from './fewshot.js';                                  // issue #4
export { watchHand } from './hands.js';                // issue #5
export { timed, recordStep } from './bench.js';       // issue #6: time your own steps for the benchmark panel
export { setActions, setInfo, setPip } from './actions.js'; // issue #73: icon buttons, corner chip, picture-in-picture
export { showStep } from './steps.js';                 // issue #103: a picture of your own in the Steps view
export { detailsOn, tapPoint, drawCallout } from './details.js'; // issue #163: labels only in Steps, a tap shows one name
export { knob } from './knobs.js';                     // issue #105: a number you can turn with a slider in the Steps view
// Building blocks (issue #65), one file each. Pure ones also work in draw() and in tests (import the file directly).
export { cardSized, straightLying, turnQuarter, findColorFrame } from './cards.js';        // cards: many cards, straight, lying
export { findFields, readGrid } from './fields.js';                                       // fields: light squares → grids
export { paperColor, paperTint, usualPaper, paperGains, hue } from './color.js';          // color: white balance from paper
export {
  findPatches, groupNear, cutOut, toRef, fromRef, likeness, rankByRefs, bestCombination, loadRefs,
} from './pictures.js';                                                                   // pictures: small icons → names
export { findBlobs, splitBlob, nameBlobs, pieceCatalogue, tableCamera } from './pieces3d.js'; // pieces3d: 3D pieces on a table
export { isoPolygons, fitView, drawPolygons, explodeOffsets, placementCubes } from './iso.js'; // iso: 3D cube view
export { coverGrid, orientations, firstWorking } from './cover.js';                        // cover: polycube solver
export { createVotes, holdSteady } from './steady.js';                                    // steady: labels that do not flicker
export { createAnchor, cardsBox } from './anchor.js';                                     // anchor: a card that stays put (issue #69)
export { areaCorners, areaAt, inBox, canvasPoint } from './pick.js';                      // pick: tap → region or button
