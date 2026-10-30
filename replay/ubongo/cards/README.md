# Ubongo 3D test photos (owner, 17 Oct 2026)

Test pictures only, for the agents' tests. Not a list of learned cards: cards are learned in each phone's browser.

- `cards/`: puzzle cards without pieces. A cards (a24, a27): 3 pieces per roll, rolls 1–2 and 3–4 = top field,
  5–7 and 8–10 = bottom field. B cards (b24, b27): 4 pieces, one picture per number, 1–5 top, 6–10 bottom.
- `pieces/`: all 16 pieces (4 per colour: blue, red, green/teal, yellow), from above and at an angle.

Truth files (`<card>.truth.json`): kind of card, fingerprint, top grid, and `pieces` per roll (group label → the
pieces its pictures show, issue #56). The pieces per roll were named by eye and checked with the solver (every roll
solves its field). `node scripts/ubongo-refs.js` makes the reference cut-outs in `games/ubongo.refs.json` from
these photos; `--check` prints the score per card.
