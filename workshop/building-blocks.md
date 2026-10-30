# Building blocks and "how it works": notes for the 15-minute talk (for the speaker; participants may read it too)

Talk notes for the [intro slides](slides.html). The slide numbers are in the headings. The talk (slides 4–24) has
one numbering: part **A** how it sees (A1 OpenCV.js, A2 MediaPipe), part **B** how it recognises: no training (B1 rules,
B2 references, B3 geometry + memory), part **C** how it runs (C1 speed, C2 camera loop). Each slide shows its part top
right. It goes one level under the surface (the idea, one real detail, one real code excerpt). Slides with a grey
"deep dive · skip live" badge (8, 11, 15, 17, 19, 20, 22, 24) are skipped live: press **D** to jump to the next core
slide. The 15 minutes count only the 13 core slides; readers find the deep dives later. The
live demo before it (script in the [facilitator guide](facilitator.md)) has already shown what the blocks can do.

| Part | Core slides (live) | Deep dives (D skips) | Minutes |
|---|---|---|---|
| Start | 4 camera → state → move, 5 the pipeline, 6 the plan | | 2 |
| A · How it sees | 7 A1 OpenCV.js, 9 A1 why 4 points, 10 A2 Image Embedder, 12 A2 Hand Landmarker (with the hand demo) | 8, 11 | 6 |
| B · How it recognises | 13 no training: three techniques, 14 B1 rules, 16 B2 references, 18 B3 geometry + memory | 15, 17, 19, 20 | 5 |
| C · How it runs | 21 C1 why it is fast, 23 C2 camera loop | 22, 24 | 2 |

## Everything runs in the browser (slide 1)

- No server, no cloud AI. The page is static files on GitHub Pages.
- Heavy work runs as WebAssembly (WASM) on every phone. Where the browser has WebGPU, the embedder uses the
  graphics chip and gets faster. The Benchmark panel (under **More**) shows which one your phone uses, and each time next to its target
  (`detect 180 / 200 ms good`). Top line: "Your phone: good / ok / slow". Targets: `TARGETS` in `engine/bench.js`;
  a game sets its own with `config.benchTargets`.

## The big idea: camera → state (JSON) → move (slide 4)

**Probabilistic perception → JSON state → deterministic rules.**

- `detect()` guesses what lies on the table. It can be wrong; that is fine.
- The guess becomes plain JSON (the state). You can print it, save it, test it.
- `solve()` is ordinary code with the game rules. Same state in, same move out, every time.
- `draw()` paints the move on top of the picture.
- So: fuzziness only where it is needed (seeing), plain logic everywhere else.

## Where you work (slide 26)

- One file: `games/<game>.js` with `config`, `detect`, `solve`, `draw`. The contract is in `games/_blank.js`.
- Everything shared comes in as `engine`. Nobody changes `engine/` today.

## The building blocks (slide 25)

Ready-made, one small file each, examples and limits in [engine/README.md](../engine/README.md).

- **Geometry (OpenCV.js):** `findBoard`, `straighten`, `cutTiles`. Classic computer vision, no learning: the
  biggest four-sided shape, made straight, cut into tiles. Sudoku and Tic-Tac-Toe use only these.
- **Few-shot names (MediaPipe Image Embedder):** `classify`. A tile picture becomes a list of numbers; similar
  tiles give similar numbers. About 3 examples per name on `tiles.html`, no training, no big model. Qwirkle.
- **Cards and colour:** `cards` finds many cards at once and cuts touching ones apart; `color` balances the light
  from the white paper. Set.
- **Printed on a card:** `fields` reads light squares as a grid (`'.##'`), `pictures` names small printed
  pictures. Ubongo.
- **3D pieces:** `pieces3d` names coloured pieces on the table, `iso` draws cubes in 3D (turn, explode), `cover`
  fills a shape with pieces (the solver). Ubongo.
- **Live video:** `steady` stops labels from flickering, `anchor` keeps a confirmed card in place, `pick` turns a
  tap into "what is under my finger".
- **Hands (MediaPipe Hand Landmarker):** `watchHand`. While a hand is over the board, the page waits, so a move
  half done is not read.

## How it works: the pipeline and the plan (slides 5–6)

- Slide 5, the pipeline (what runs where, not the parts): camera loop → OpenCV.js (find, straighten) → MediaPipe (names, hands) → your game (JSON → move).
- Slide 6, the plan: parts A, B, C, then the workshop. Say once: grey "deep dive" slides are for later reading.
- Under all of it: WebAssembly and the GPU, inside the browser. The labels in the boxes (A1, A2, C1, C2) are the
  slides that follow.

## A1 · OpenCV.js pipeline (slides 7–9)

- Slide 7, the real Steps pictures of a Set photo: grey → blur → threshold (bright patches) → edges →
  `findContours` → 4 corners → `warpPerspective`. OpenCV is classic C++ computer vision, built to WebAssembly.
- Slide 8 (deep dive), the code from `engine/warp.js`: threshold (Otsu picks the cut-off), outlines, then `convexHull` and
  `approxPolyDP` smooth the outline until four corners are left. A finger on the edge does not break it.
- Slide 9, why 4 points are enough: a flat board seen at an angle is one 3×3 matrix (homography) with 8 unknowns;
  each corner gives two equations (x and y), so four corners give exactly eight. `getPerspectiveTransform` solves
  it, `warpPerspective` paints the straight picture.

## A2 · MediaPipe (slides 10–12)

- Slide 10, Image Embedder: MobileNetV3-small (a small network Google trained on millions of photos) turns a tile
  into 1024 numbers. We compare them with about 3 reference photos per name. Few-shot, no training. The
  screenshots are the Qwirkle tiles and their scores.
- Slide 11 (deep dive), cosine similarity: the numbers are an arrow; similar pictures point the same way (cosine near 1).
  Ten lines in `engine/fewshot.js`; the top 3 references vote.
- Slide 12, Hand Landmarker: a palm detector finds a box, then 21 keypoints (wrist + 4 per finger). We only ask
  "hand or no hand?": while a hand is there, wait; gone for 800 ms = move done, `detect()` runs once.
  The four "try this" lines on the slide are the hand demo (facilitator guide, "Hands (1 minute)").

## B · How it recognises things: no training (slides 13–20)

Say it plainly: **nothing in this repo is trained.** Every game uses one of three techniques; a new thing is a new
rule or a new reference, never more data. (The Image Embedder and the Hand Landmarker were trained by Google; we only
use their output.) Each core slide has a ▶ button: the app opens on a replay photo with the Steps view already on that
technique (`&steps=<stage>`, works offline once cached).

| Game | Board / cards | Pieces / symbols | Technique |
|---|---|---|---|
| Set | white cards (`findCards`) | count, hue, ink share, box fill → if / else | rules |
| Tic-Tac-Toe | dark frame (`findBoard`) | ink share per cell, then X vs O | rules |
| Sudoku | dark frame (`findBoard`) | digit mask vs references drawn by code (`matchTile`) | references |
| Qwirkle | dark board | shape mask vs references drawn by code (`matchTile`) | references |
| Ubongo | red frame, light squares (`engine/fields.js`) → fingerprint → known card | printed pictures vs photo cut-outs (`engine/pictures.js`); table pieces vs cube catalogue (`engine/pieces3d.js`) | geometry + memory, references |

`engine.classify` (MediaPipe embedder) is offered (`tiles.html`, TODO hints in `games/sudoku.js` and
`games/qwirkle.js`); no finished game uses it today.

- Slide 13, overview: three boxes (B1, B2, B3), one real picture each. "Measure then if / else", "closest reference wins",
  "shape then look it up".
- Slide 14, **B1 · Set (rules)**: per card four numbers. Number = how many ink outlines. Colour = hue of the ink after the
  card paper is made white (60–200° green, 200–330° purple, else red). Fill = ink inside ÷ ink on the outline
  (above 0.85 solid; a clean paper hole = empty; else striped). Shape = solidity (a squiggle has dents) and box fill
  (a diamond fills about half its box, an oval almost all). ▶ opens Steps on `rules`: tap it, every card with its
  numbers and the names they gave.
- Slide 15 (deep dive): the code of `readShape` and `colorOfHue` in `solutions/set.js`; white balance; a wrong read
  is fixed by moving a threshold; live video votes over 10 frames (`steady`).
- Slide 16, **B2 · Sudoku (references)**: cell → ink mask → 8 × 8 numbers (`pixelEmbedding`) → cosine with every
  reference → the closest wins (`matchTile`), below 0.5 = not sure. The references are digits drawn by code.
  ▶ opens Steps on `scores`: tap a cell, see the best and the runner-up with their scores.
- Slide 17 (deep dive): three kinds of references. Drawn by code (Sudoku, Qwirkle), cut from photos (Ubongo
  pictures, `games/ubongo.refs.json` made by `node scripts/ubongo-refs.js`), photos + embedder (`classify`,
  offered). Qwirkle is only mentioned here. Its solver (`solutions/qwirkle.js`) ranks all legal moves by points
  (`rankMoves`, "Next move" steps through the top 6) and adds plain rule hints, no AI (`explainMove`): a line of 5
  whose 6th tile you hold ("keep it, +12 later"), a line of 5 others may finish ("risky": fewer than 3 copies of
  that tile seen on board + hand), and playing fewer tiles to keep a pair that fits ("keeps 2 tiles").
- Slide 18, **B3 · Ubongo (geometry + memory)**: red frame and light squares → the shape of both fields = the
  fingerprint; a fingerprint this browser confirmed = that card. Printed pictures → cut-out → closest reference.
  Table pieces → coloured blobs → best fit in a catalogue of cube shapes per colour. Then the solver: plain search
  (`engine/cover.js`). ▶ opens Steps on `fingerprint`: the string, "known card ✓" or "new card", each table piece with
  its catalogue scores.
- Slide 19 (deep dive): the fingerprint format (`#` square, `.` none, `,` next row, `|` second field); "Card looks
  right ✓" saves it in `localStorage`; `&card=A24` pre-confirms; catalogue = every turn of every piece, no piece
  twice; `anchor` holds a confirmed card.
- Slide 20 (deep dive): make it learn something new = add a reference (`tiles.html`, `ubongo-refs.js`, "Card looks
  right ✓") or move a threshold. Enough because the board is printed and only a few dozen things must be told apart.

## C1 · Fast in the browser (slides 21–22)

- WebAssembly runs OpenCV near machine speed; SIMD handles several pixels in one instruction.
- MediaPipe runs its model on the GPU (WebGL) and falls back to the CPU (WebAssembly) when that fails: the code on
  slide 22. WebGPU, on newer phones, is a faster way to the GPU; the browser picks.
- About 22 MB is downloaded once and then comes from the browser cache; `check.html` does that download up front.
- The table: targets from `engine/bench.js` and what the sandbox measured. Each phone's own numbers: More → Benchmark.

## C2 · The camera loop (slides 23–24)

- `getUserMedia` starts the camera once. `requestVideoFrameCallback` wakes the loop on each new video frame.
- At most 5 `detect()` runs per second, and only when a 64×48 grey thumbnail changed; else the last answer stays.
- `detect()` gets a 960 px copy → state (JSON) → `solve()` → `draw()` on a Canvas 2D on top of the video.
- The next frame waits until `detect()` is done, so a slow phone never piles up work; Auto switches to Saver.

## Workshop: three paths (slide 27)

Alone or in pairs. The participant README names the same three, with a first step each.

- **Explore:** the demo on the phone, **Steps** in the bottom bar, then turn the Knobs. No code.
- **Adapt:** finish a starter, quickest first: Tic-Tac-Toe, Sudoku, Set, Qwirkle (the TODOs at the top of each
  file). Ubongo is the demo.
- **Own game:** check the [game checklist](game-checklist.md), copy `games/_blank.js`, swap in blocks.

Slides 28–33 (testing, AI tool, when stuck, what happens next, go) need no notes: read them out, then start
the setup. Slide 34 is further reading for later.
