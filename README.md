# board-vision workshop

Point a phone camera at a real board game: the browser reads the game state and suggests a move.
Everything runs on the phone, in the browser. No server, no AI at request time. GitHub Pages hosts the page.

See it working first: https://iptch.github.io/boardgame-vision-workshop/ (this workshop's page). The finished version runs on the workshop leader's
site: https://jannistriestocode.github.io/board-vision/#ubongo&solution

## Workshop links

Open these in the browser (GitHub itself only shows the source of `.html` files):

| Page | What it is |
|---|---|
| [Intro slides](https://iptch.github.io/boardgame-vision-workshop/workshop/slides.html) | The slides from the start of the workshop. Arrow keys, space or swipe; **F** for full screen. |
| [Demo launcher](https://iptch.github.io/boardgame-vision-workshop/workshop/) | One tap per live demo (Ubongo, hands, Set) and a pre-flight check. |
| [Start page](https://iptch.github.io/boardgame-vision-workshop/) | The page on your phone: pick a game, tap **Steps** (bottom bar) and its **Knobs**. |
| [Demo (finished version, the workshop leader's site)](https://jannistriestocode.github.io/board-vision/#ubongo&solution) | The finished Ubongo; `#set&solution` for Set. |
| [Device check](https://iptch.github.io/boardgame-vision-workshop/check.html) | Tests your phone and laptop browser and loads the big libraries once. |
| [Print sheets](https://iptch.github.io/boardgame-vision-workshop/print.html) | Sudoku and Tic-Tac-Toe to print on A4. |
| [Find and straighten](https://iptch.github.io/boardgame-vision-workshop/warp.html) | Debug page: how the board is found and straightened. |
| [Tiles and references](https://iptch.github.io/boardgame-vision-workshop/tiles.html) | Debug page: the cut tiles and their best matches. |
| [All pages](https://iptch.github.io/boardgame-vision-workshop/links.html) | Every page, game, demo and doc in one list (also: More → **All pages**). |

To read: [mini tasks](workshop/tasks.md), [game checklist](workshop/game-checklist.md),
[building blocks talk](workshop/building-blocks.md), [facilitator guide](workshop/facilitator.md).
Your own copy has the same pages under `https://<your-name>.github.io/<repo>/`.

## Make your own copy

1. On GitHub, click **Use this template** → **Create a new repository**. (Tick **Include all branches** if you
   want the `solutions` branch too.)
2. In your new repo: **Settings → Pages → Source: GitHub Actions**. The next push to `main` (or
   **Actions → Deploy to GitHub Pages → Run workflow**) publishes the page.
3. Open `https://<your-name>.github.io/<repo>/` on your phone. Pick a game, or add `#<game>` to the link.
4. Open the device check page [`check.html`](check.html) (`…/<repo>/check.html`) on your phone and your laptop:
   it tests the browser and downloads the big libraries once.

## Three paths

Pick one, alone or in pairs. All three end with something running on your phone.

- **Explore:** open the start page (https://iptch.github.io/boardgame-vision-workshop/) on your phone and point it at a
  game. Tap **Steps** in the bottom bar to see each stage of the picture, live, then tap **Knobs** and turn the sliders to see
  what changes. No code needed. Then try the [mini tasks](workshop/tasks.md): one per building block,
  2–5 minutes each. **First step:** open the start page on your phone and tap Steps.
- **Adapt:** finish a starter game. Each one is half done; the TODOs at the top of the file say what is open.
  From quickest: Tic-Tac-Toe (`games/tictactoe.js`), Sudoku (`games/sudoku.js`), Set (`games/set.js`),
  Qwirkle (`games/qwirkle.js`). Ubongo (`games/ubongo.js`) is the demo. **First step:** open
  `games/tictactoe.js` and read the TODOs at the top. Want to understand the code, not only prompt your AI tool?
  Follow the guided **Track 1** lesson, [workshop/learn/tictactoe.md](workshop/learn/tictactoe.md) (23–40 min),
  with `pnpm learn tictactoe --watch` telling you per TODO what is still wrong. Want more: **Track 2**,
  [workshop/learn/set.md](workshop/learn/set.md) (seven steps of 5–20 min, `pnpm learn set --watch`).
- **Own game:** bring a game and build it from scratch in `games/<game>.js`. **First step:** check your game
  against the [game checklist](workshop/game-checklist.md), then copy `games/_blank.js` (see "Where you work" below).

### Prompts for your AI tool

Copy one (the copy button on each block), replace `<game>`, paste it into your AI tool. Each prompt makes the tool
check its own work: `pnpm learn tictactoe` for Track 1, `pnpm learn set` for Track 2, `node replay/run.js <game>` (photo vs. `.truth.json`)
for every game, `pnpm test` before you push.

<details><summary><b>Explore</b>: understand the pipeline</summary>

```text
Read engine/README.md and docs/ARCHITECTURE.md, then games/<game>.js. Walk me through one frame: camera
frame → detect() → state JSON → solve() → draw(). For each engine building block it calls, name the
Steps stage in the app that shows its output, and what a failure there would look like.
```

```text
List every threshold and knob games/<game>.js uses. For each: what pixel statistic it compares, what
goes wrong in the Steps view when it is too low or too high, and how to measure that on the photos in
replay/<game>/ with node replay/run.js <game>. Do not change code.
```

</details>

<details><summary><b>Adapt</b>: finish a starter</summary>

```text
Work on the first open TODO in games/<game>.js. First run node replay/run.js <game> and show which
photos differ from their .truth.json. Then make the smallest change that turns them ok, rerun, and
report before/after. Change only games/<game>.js.
```

```text
Before implementing the TODO in games/<game>.js, write a unit test in tests/<game>.test.js that runs on
the photos in replay/<game>/ and compares with the truth files. Show it failing for the right reason,
then implement until it passes. Finish with pnpm test.
```

```text
Explain the threshold you chose in games/<game>.js: which feature it reads, the per-class min/max of
that feature over the replay photos (print them), the margin between classes, and why that margin
survives a phone camera (blur, shadow, white balance). Point me to the Steps stage that shows it.
```

</details>

<details><summary><b>Own game</b>: start from scratch</summary>

```text
I want to build <game>. Check it against workshop/game-checklist.md and engine/README.md: which building
blocks fit, what the state JSON between detect() and solve() should look like, and which part is the
riskiest to detect. Propose the smallest first version. No code yet.
```

```text
Copy games/_blank.js to games/<game>.js and add it to games/list.js. I put photos in replay/<game>/;
write a <photo>.truth.json for each from what you see, I will correct them. Implement detect() with the
building blocks we chose and iterate until node replay/run.js <game> says ok for every photo. Keep
solve() trivial until detection is right.
```

</details>

<details><summary><b>Per starter</b>: Tic-Tac-Toe, Sudoku, Set, Qwirkle</summary>

**Tic-Tac-Toe** (`games/tictactoe.js`; the guided Track 1 has more prompts):

```text
Do TODO 1 in games/tictactoe.js (X or O). Measure one ink feature per cell on the replay photos, print
its values for X and O cells, pick a cut with a clear margin. Run pnpm learn tictactoe after each change
and stop when TODO 1 is green.
```

```text
Do TODO 2 in games/tictactoe.js with minimax. First add unit tests for a forced win, a forced block and
a full board (null). Verify with pnpm learn tictactoe.
```

**Sudoku** (`games/sudoku.js`):

```text
Do TODO 1 in games/sudoku.js: read digits few-shot with reference pictures (engine/README.md, the
building block for small pictures). Run node replay/run.js sudoku, report accuracy per photo against the
truth, list the digit pairs it confuses and how you separate them.
```

```text
Do TODO 2 in games/sudoku.js: a backtracking solver with constraint propagation. Unit-test it first on a
known puzzle and on a contradictory grid (a misread digit), which must return null, not hang.
```

**Set** (`games/set.js`):

```text
Do TODO 1-3 in games/set.js one at a time. For each, print the feature you threshold across all cards in
replay/set/, choose the cut with the largest margin, and verify with node replay/run.js set before you
start the next TODO.
```

```text
Do TODO 4 in games/set.js (find a set). Unit tests first: a 12-card layout with exactly one set, and one
with none. Then run node replay/run.js set.
```

**Qwirkle** (`games/qwirkle.js`):

```text
Do TODO 1 in games/qwirkle.js (shape) with few-shot references. Report which shapes get confused on the
replay photos (node replay/run.js qwirkle) and why, before tuning anything.
```

```text
Do TODO 2 and 3 in games/qwirkle.js. For TODO 2, propose the rule that tells hand tiles from board tiles
and its failure cases before coding. For TODO 3, write unit tests from the official scoring rules
first (a line of six scores 12), then implement. Verify with node replay/run.js qwirkle and pnpm test.
```

</details>

## Where you work

Only in `games/<game>.js`. Copy `games/_blank.js`, add the name to `games/list.js`, and fill in
`detect()`, `solve()` and `draw()`. The comments in `games/_blank.js` explain the rules.

Build your game from ready-made **building blocks** (cards, fields, colour, small pictures, 3D pieces, 3D view,
solver, steady labels, tap pick): each one with an example, the games that use it and its limits in
[engine/README.md](engine/README.md). How it all fits together: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
Workshop material (slides, talk notes, game checklist): [workshop/](workshop/facilitator.md).

## Get started

You need Node.js (version 22 or newer).

```sh
corepack enable    # once per laptop: makes the `pnpm` command available (comes with Node.js)
pnpm install       # once: dev tools only (the page itself never needs an install)
pnpm dev           # local page that reloads on every save; it prints the address
pnpm test          # unit tests + syntax + type check + "is style.css up to date?" + security audit
```

The laptop webcam works on `localhost` without HTTPS. For the phone, push to `main`: GitHub Pages publishes it
in about a minute. Tests run on your laptop only (`pnpm test`); a red test never stops the page from going live.

**Styles:** the page uses Tailwind classes. `tailwind.css` is the source, `style.css` is built from it and
committed. `pnpm dev` rebuilds it on every save; commit it with your change.

Without a browser (for you or your AI tool): `node replay/run.js <game>` prints one JSON line per photo in
`replay/<game>/`: the state, the move, and whether it matches the expected state. See
[replay/README.md](replay/README.md).

## Stuck?

The branch `solutions` has finished versions of the starter games in `solutions/`. On that branch, add
`&solution` to the address (`…/#set&solution`) to run one.
