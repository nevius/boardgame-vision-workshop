# board-vision: rules for AI coding tools

Workshop repo: phone camera → board game state in the browser → suggested move.
The person you work with is a workshop participant building one game in a short time. Keep answers short.

## Product rules
- **Browser only.** Static files, GitHub Pages. No server, no backend, no API calls at runtime, no AI at request time.
- **No build step.** Plain HTML + ES modules. Libraries via the import map in `index.html` (CDN, exact versions).
- **Only small, ready-made building blocks:** OpenCV.js (WASM), MediaPipe Tasks Vision (Image Embedder, Hand
  Landmarker). No large models, no vision LLMs, no training. "Few-shot" = embedder + reference images + similarity.
- Must work on iPhone Safari and Android Chrome.

## Where to work
- **Edit only `games/<game>.js`** (and add its name to `games/list.js`). Everything else is shared template code.
- A game exports `config`, `detect(frame, engine) → state`, `solve(state) → move`, `draw(ctx, state, move)`.
  The state is plain JSON. The contract with comments: `games/_blank.js`; types: `engine/types.js`.
- Use the building blocks in `engine/` through the `engine` argument; read [engine/README.md](engine/README.md)
  before writing detection code. The whole picture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- Guided tracks: for `games/tictactoe.js` read the lesson [workshop/learn/tictactoe.md](workshop/learn/tictactoe.md),
  for `games/set.js` [workshop/learn/set.md](workshop/learn/set.md), first; each explains every TODO, the hints and
  the expected checker output. Check with `pnpm learn tictactoe` or `pnpm learn set`.
  Prefer explaining over solving when the participant follows a track.
- No game file imports from another game file.
- Games never draw buttons or status text on the canvas (a test checks); they use `engine.setInfo`,
  `engine.setActions` (up to 4 icons) and `engine.setPip`.

## UI rules
- Use the tokens in `ui/tokens.css` (`bg-accent`, `rounded-ui`, `min-h-tap`, …): no new colours or sizes.
- One status place: the mode chip. Your game talks through `engine.setInfo` (short, what to do first),
  `engine.setActions` (bottom bar) and `engine.setPip`; never draw buttons or text in the middle of the picture.

## Code style
- Every file starts with `// @ts-check`; types are JSDoc comments (`pnpm typecheck`).
- Small files, plain comments, obvious names.
- Tailwind classes written out in full (`bg-sky-600`), never glued from pieces.

## Test
- `pnpm install` once. `pnpm dev` = local page with live reload. `pnpm test` = all checks.
- Fast checks while working: `pnpm learn <game>` (guided tracks), `pnpm unit`, `pnpm typecheck`, `node replay/run.js <game>` on the photos in
  `replay/<game>/`.
- Pushing to `main` publishes the page on GitHub Pages. Tests run locally only; they never block a push.
