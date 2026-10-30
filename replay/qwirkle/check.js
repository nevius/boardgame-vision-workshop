// @ts-check
// How node replay/run.js qwirkle compares a state with a truth file. The truth is one list: the tiles on the
// board ({ row, col, color, shape }) and then the tiles in the hand (the same, plus "hand": true; their row and
// col are only where they lie on the photo). The state keeps the hand apart (state.hand, without row and col).
// The order of the hand does not matter in the game, so both hands are sorted by colour and shape first.
import { scoreCards } from '../../engine/replay.js';

/** @param {{ tiles?: object[], hand?: object[] }} state @param {{ row?: number, col?: number, hand?: boolean }[]} truth */
export function compareTruth(state, truth) {
  const byKind = (a, b) => `${a.color} ${a.shape}`.localeCompare(`${b.color} ${b.shape}`);
  const hand = (state.hand ?? []).map(({ color, shape }) => ({ color, shape, hand: true })).sort(byKind);
  const read = [...(state.tiles ?? []), ...hand];
  const board = truth.filter((tile) => !tile.hand);
  const truthHand = truth.filter((tile) => tile.hand).map(({ row, col, ...tile }) => tile).sort(byKind);
  const expected = [...board, ...truthHand];
  const score = scoreCards(read, expected);
  return { ok: score.cardsFound === score.cards && score.featuresRight === score.features, score };
}
