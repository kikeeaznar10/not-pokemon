/**
 * Menu cursor movement, shared by the ChoiceBox (M5) and later menus. Pure (no Phaser) so it can be
 * unit-tested.
 */

/** Move a cursor by `delta` over `count` options, wrapping around at both ends. */
export function moveCursor(index: number, delta: number, count: number): number {
  if (count <= 0) return 0;
  return (((index + delta) % count) + count) % count;
}
