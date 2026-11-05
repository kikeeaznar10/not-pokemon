/**
 * Menu cursor movement, shared by the ChoiceBox (M5) and later menus. Pure (no Phaser) so it can be
 * unit-tested.
 */

/** Move a cursor by `delta` over `count` options, wrapping around at both ends. */
export function moveCursor(index: number, delta: number, count: number): number {
  if (count <= 0) return 0;
  return (((index + delta) % count) + count) % count;
}

/**
 * Move a cursor on a grid of `count` options laid out row by row in `cols` columns (the battle's 2 × 2
 * menu). Moves by `dx` columns or `dy` rows; a move that would leave the grid, or land past the last
 * option, keeps the cursor where it is (no wrapping).
 */
export function moveGridCursor(index: number, dx: number, dy: number, cols: number, count: number): number {
  if (count <= 0 || cols <= 0) return 0;
  const col = (index % cols) + dx;
  const row = Math.floor(index / cols) + dy;
  if (col < 0 || col >= cols || row < 0) return index;
  const next = row * cols + col;
  return next < count ? next : index;
}
