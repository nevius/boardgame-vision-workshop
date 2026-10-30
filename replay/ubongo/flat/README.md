# Old drawn Ubongo pictures (2D)

Drawn test pictures from before the owner's photos (made by `node replay/make-test-images.js`): a flat blue
card with one field and flat pieces from the old **placeholder** piece set (`I3`, `L3`, `T4`, … in
`games/ubongo.js`). They are not real Ubongo 3D cards or pieces.

Since issue #47 the camera prefers the real pieces (`red5`, `green5`, `green4`), so the pieces on these pictures
are no longer named right: `node replay/run.js ubongo/flat` says `differs` (wrong: `pieces`). The grids still
read right; `tests/ubongo.test.js` checks the grids and solves them with the pieces from the truth files.
The real photos are one folder up (`replay/ubongo/`).
