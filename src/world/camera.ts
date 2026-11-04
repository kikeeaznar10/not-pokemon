/** Camera helpers for the overworld (pure, no Phaser, so they can be unit-tested). */

/** Base screen size in pixels (same as `src/config/game.ts`; repeated here to stay Phaser-free). */
const SCREEN = { width: 16 * 32, height: 9 * 32 };

/**
 * Camera bounds for a map of `mapW × mapH` pixels: the map itself, or — on an axis where the map is
 * smaller than the screen (interiors) — a screen-sized range centred on it, so the map sits in the
 * middle of a black screen. Example: a 320 × 256 interior → `{ x: -96, y: -16, width: 512, height: 288 }`.
 */
export function cameraBounds(
  mapW: number,
  mapH: number,
  screen: { width: number; height: number } = SCREEN,
): { x: number; y: number; width: number; height: number } {
  const axis = (map: number, size: number): [number, number] =>
    map >= size ? [0, map] : [(map - size) / 2, size];
  const [x, width] = axis(mapW, screen.width);
  const [y, height] = axis(mapH, screen.height);
  return { x, y, width, height };
}
