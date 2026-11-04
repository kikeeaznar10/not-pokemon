/**
 * Phaser game configuration: base resolution, pixel-art rendering, scaling and the scene list.
 * Everything in the game is positioned in units of this 512 × 288 base (16 × 9 tiles of 32 px).
 */
import Phaser from 'phaser';
import { BootScene } from '../scenes/boot-scene';
import { DebugScene } from '../scenes/debug-scene';
import { ErrorScene } from '../scenes/error-scene';
import { OverworldScene } from '../scenes/overworld-scene';
import { PreloadScene } from '../scenes/preload-scene';

/** Size of one map tile in base pixels. */
export const TILE_SIZE = 32;
/** Base width in pixels (16 tiles). */
export const GAME_WIDTH = 16 * TILE_SIZE;
/** Base height in pixels (9 tiles). */
export const GAME_HEIGHT = 9 * TILE_SIZE;

/** Build the Phaser config, mounting the canvas inside `parent` (an element id). */
export function createGameConfig(parent: string): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#000000',
    pixelArt: true,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    // Scenes never read the keyboard: the Input service (src/core/input.ts) does. Pointer/touch stay on.
    input: { keyboard: false },
    // No physics: movement is grid-based and handled by the game rules.
    // DebugScene is last so it draws on top of everything.
    scene: [BootScene, PreloadScene, ErrorScene, OverworldScene, DebugScene],
  };
}
