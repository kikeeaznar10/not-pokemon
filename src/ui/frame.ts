/**
 * The game's box style (`docs/ART.md` › Style guide): a cream fill inside a dark outer line
 * and a soft blue inner line, like the handheld RPG dialogue boxes the art follows. Every dialogue box, choice
 * box, grid menu and battle panel is drawn with {@link framedBox}.
 */
import type Phaser from 'phaser';

/** Box colours. */
export const FRAME = { fill: 0xfcf8ec, border: 0x283048, accent: 0x68a8d8 } as const;

/**
 * Add a framed box at (`x`, `y`) of `w` × `h` (origin top-left) and return its parts, the fill first, ready to go
 * at the start of a container's children.
 */
export function framedBox(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
): Phaser.GameObjects.Rectangle[] {
  const fill = scene.add.rectangle(x, y, w, h, FRAME.fill).setOrigin(0).setStrokeStyle(2, FRAME.border);
  const inner = scene.add
    .rectangle(x + 3, y + 3, Math.max(0, w - 6), Math.max(0, h - 6))
    .setOrigin(0)
    .setStrokeStyle(2, FRAME.accent);
  return [fill, inner];
}
