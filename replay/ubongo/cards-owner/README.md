# Ubongo 3D: more photos of card 27 (owner, 29 Oct 2026)

Card **B27** (4-piece side) on the dark wood table (straight, tilted) and on a light grey fabric sofa (straight,
at an angle), plus the other side, **A27**, upside down on the fabric. No pieces on the card. Truth files are copies
of `../cards/b27.truth.json` and `../cards/a27.truth.json` (check: the A27 photo is assumed to be the back of B27;
the fingerprint must confirm it).

Run: `node replay/run.js ubongo/cards-owner --solution`.

Result (issue #158): all 5 photos read both shapes (print) and the grid right; the A27 photo is turned around
automatically and its fingerprint matches `../cards/a27.truth.json`, so it is the back of B27. The runner still
says `differs` on `pieces` for every card photo (here and in `../cards/`): the pieces per roll are checked by
`node scripts/ubongo-refs.js --check`, which scores these photos too. `tests/ubongo.test.js`
(`readsCard27OnWoodAndFabric`) checks print and grid.

Issue #171 (card held sideways): `a27-fabric-90.jpg`, `b27-fabric-90.jpg` and `b27-fabric-270.jpg` are copies of
`a27-fabric-upside-down.jpg` and `b27-fabric-top.jpg` turned a quarter clockwise (90) or counter-clockwise (270) by a
script, with copies of their truth files. A card that is clearly wider than high is turned a quarter before it is
read; all three read the same shapes, grid and piece pictures as the photos they come from.
