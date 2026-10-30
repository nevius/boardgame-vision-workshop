# Mini tasks: one building block at a time

Short tasks to see how the computer vision and the small AI models work in the browser, before (or instead of)
letting an AI write code. Each one takes 2 to 5 minutes and needs no code. Each says **Do** (what you change),
**Watch** (where to look) and **Why** (what it shows). The building blocks are explained in
[engine/README.md](../engine/README.md).

You need: the page on your phone (the workshop page, https://iptch.github.io/boardgame-vision-workshop/, or your own copy), a
printed sheet from [print.html](../print.html) or a real game, and good light. **Steps** is in the bottom bar (or under **More** when the bar is full);
**Knobs** is the last tile of the Steps strip (it says "N sliders" and "knobs"); its sliders open at the bottom.

## Find and straighten (geometry, warp)

1. **Turn the edges knob until the board is lost.**
   Do: open `#tictactoe`, tap More → **Sample photos** (or take a photo of the printed sheet: on a still picture the
   board is read fully every time, on live video a locked sheet is only followed). Tap **Steps** in the bottom bar → the "knobs" tile. Move
   "Edges: high threshold" slowly to the right, then "Edges: low threshold". Tap **Reset** at the end.
   Watch: the `edges` stage gets emptier, and at some point the corner chip says "No sheet found" (the
   `found board` stage then keeps its last picture).
   Why: the board is found as a large four-sided outline in the edge picture (Canny). High thresholds keep only
   strong edges; when one side of the frame is gone, there is no closed outline left. Very low thresholds make so
   many edges that the outline melts into the table.
2. **Tilt the phone.**
   Do: same game with the camera on and Steps open: hold the phone flat above the sheet, then tilt it more and more.
   Watch: `straightened` stays a square picture, but gets blurrier on the far side, until the board is lost.
   Why: the four corners are enough to undo the perspective (a "warp"). Pixels far away are few, so they are
   stretched.

## Cut into tiles (tiles)

1. **Change the margin.**
   Do: open [tiles.html](../tiles.html), "Look for: a board (grid)", Rows 3, Cols 3, load a photo of the
   Tic-Tac-Toe sheet (or start the camera). Set Margin to 0, then to 0.3.
   Watch: the tiles under "Tiles". With 0, the grid lines show at the tile edges; with 0.3, only the middle of each
   field is left.
   Why: the straight board is cut into equal parts; the margin cuts a share off every side so the lines do not
   disturb the recognition.

## Recognise by examples (few-shot)

1. **Teach a new class with 3 photos.**
   Do: on [tiles.html](../tiles.html) with the camera on, draw a new mark (a triangle) in one field. Tap that tile
   and name it `triangle`. Draw a triangle in two more fields (or move the sheet) and name 2 more triangle tiles.
   Watch: the name and score under each tile. After 3 examples, a new triangle shows `triangle` with a score near 1;
   an empty field gets a lower score for `triangle`.
   Why: the Image Embedder (a small model, no training) turns each tile into a list of numbers. The page compares
   them with your examples (cosine similarity: 1 = looks the same) and takes the closest ones. A few examples are
   enough because the model already "knows" shapes.
2. **Confuse it.**
   Do: name only one example per class (Remove all, then 1 × `X`, 1 × `O`, 1 × `empty`). Then move the camera a
   little and change the light.
   Watch: names flip between `X` and `O`, scores drop.
   Why: one example cannot cover changes in light and angle. More examples per class = steadier names.

## Many cards (cards)

1. **Push cards together.**
   Do: open `#set`, tap **Steps** in the bottom bar, lay out 6 Set cards with gaps, then push two of them so they touch, then let
   one lie half on top of another.
   Watch: the `found cards` stage: one outline per card while there are gaps; two touching cards may become one
   big outline, and an overlap is no card at all.
   Why: `findCards` looks for four-sided outlines. Touching cards share an edge, so they can look like one shape.
   `engine.cardSized` (cards block) fixes the first case: most shapes are cards, so a shape twice as big is cut
   apart. Set does not use it yet; try it in your own game.

## Colour (color)

1. **Change the light.**
   Do: in `#set` read a few cards in daylight, then under a warm (yellow) lamp. Tap More → State.
   Watch: the `color` of each card in the state; under yellow light, `purple` and `red` get mixed up more often.
   Why: a camera sees the colour of the light too. A colour word comes from the hue of the pixels; a white card
   that looks yellow shifts every hue. The color block can measure the paper's white and correct for it.

## Squares on a card (fields)

1. **Hide a square.**
   Do: open `#ubongo` (the demo), point at an Ubongo card, then cover one light square
   of the field with a dark scrap of paper.
   Watch: More → State: the `grid` (`'#'` = square to cover) loses one `'#'`, and the solution changes.
   Why: the field is read as light squares on the straight card; a square that is not light is not part of the
   shape.

## Steady on video (steady, anchor)

1. **Move and cover the card.**
   Do: in `#ubongo` with the camera on, wait for the mode chip (top left) to say `Locked · …`. Move the phone slowly, then cover the
   card with your hand for a moment, then for a few seconds.
   Watch: the drawing follows the card smoothly; a short cover keeps it, a long one makes it fade out. Tap **Search again**
   in the bottom bar to read the card again.
   Why: once a card is confirmed, the page only follows a few strong points of it (optical flow) and reads it fully
   only now and then. A lost card is held for about 1 s.
2. **Add a piece.**
   Do: put one more Ubongo piece on the table next to the card.
   Watch: the pieces in the box at the bottom left: the new piece appears after a short moment, not at once.
   Why: on live video a new list only counts after 3 frames in a row, so one bad frame does not flicker.

## Hand gone = move done (hands)

1. **Cover the board with a hand.**
   Do: open `#tictactoe` (or `#sudoku`) with the camera on and hold your hand over the sheet, then take it away.
   Watch: the mode chip (top left): `Hand over board · paused`, then `Move done · reading`.
   Why: a small hand model (MediaPipe Hand Landmarker) runs on the camera picture. While a hand is there, the game
   does not read the board, so a half-made move is never read. (Ubongo turns this off: hands move pieces all the
   time.)

Done with these? Pick one block and use it in your own game (`games/<game>.js`), with its example in
[engine/README.md](../engine/README.md). Few-shot in your game: `engine.classify`; its scores then show in the
`scores` stage of the Steps view.
