/**
 * Phaser game configuration: base resolution, pixel-art rendering, scaling and the scene list.
 * Everything in the game is positioned in units of this 512 × 288 base (16 × 9 tiles of 32 px).
 */
import Phaser from 'phaser';
import { BattleScene } from '../scenes/battle-scene';
import { BootScene } from '../scenes/boot-scene';
import { DebugScene } from '../scenes/debug-scene';
import { ErrorScene } from '../scenes/error-scene';
import { HudScene } from '../scenes/hud-scene';
import { IntroScene } from '../scenes/intro-scene';
import { NameScene } from '../scenes/name-scene';
import { MenuScene } from '../scenes/menu-scene';
import { OverworldScene } from '../scenes/overworld-scene';
import { PreloadScene } from '../scenes/preload-scene';
import { ShopScene } from '../scenes/shop-scene';
import { StorageScene } from '../scenes/storage-scene';
import { TitleScene } from '../scenes/title-scene';

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
    // Title, Name and Intro (M11) come before the overworld. Shop, Storage (M9) and Menu (M10) draw over the paused overworld. Hud (M10, the save icon) draws over
    // every game scene; DebugScene is last so it draws on top of everything.
    scene: [
      BootScene,
      PreloadScene,
      ErrorScene,
      TitleScene,
      NameScene,
      IntroScene,
      OverworldScene,
      BattleScene,
      ShopScene,
      StorageScene,
      MenuScene,
      HudScene,
      DebugScene,
    ],
  };
}
