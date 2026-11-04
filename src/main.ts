/**
 * Entry point: creates the Phaser game and, in dev or E2E builds, exposes the test hooks
 * `window.__GAME__` (the Phaser.Game) and `window.__E2E__` (helpers used by Playwright; see tests/README.md).
 */
import Phaser from 'phaser';
import { createGameConfig } from './config/game';
import { bindKeyboard, input } from './core/input';
import { getGameData, hasGameData } from './data/game-data';
import type { Facing } from './data/schemas';
import { DEBUG_SCENE, type DebugScene } from './scenes/debug-scene';
import { ERROR_SCENE, type ErrorScene } from './scenes/error-scene';
import { OVERWORLD_SCENE, type OverworldScene } from './scenes/overworld-scene';
import { PRELOAD_SCENE, type PreloadScene } from './scenes/preload-scene';

const game = new Phaser.Game(createGameConfig('game'));

// Controls: the keyboard feeds the Input service; each game frame starts a new input frame.
bindKeyboard(window);
game.events.on(Phaser.Core.Events.PRE_STEP, () => input.beginFrame());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) input.releaseAll();
});

/** Number of entries in each content collection. */
export interface DataSummary {
  flexymon: number;
  attacks: number;
  items: number;
  npcs: number;
  zones: number;
  shops: number;
  secretNames: number;
}

/** Helpers for Playwright tests. They grow with the milestones (see tests/README.md). */
export interface E2EHooks {
  /** Keys of the currently active scenes, bottom to top. */
  activeScenes(): string[];
  /** Key of the topmost active scene, ignoring the Debug overlay; `null` before any scene runs. */
  currentScene(): string | null;
  /** Counts of the loaded content, or `null` if data is not loaded (yet, or it failed). */
  dataSummary(): DataSummary | null;
  /** The `file › path › message` lines shown by the ErrorScene (empty if it is not showing). */
  dataErrors(): string[];
  /** True once Preload has loaded every asset; `failedAssets()` lists any that failed. */
  preloadComplete(): boolean;
  /** Keys of assets that failed to load in Preload. */
  failedAssets(): string[];
  /** True if a texture with this key (the asset path) is loaded. */
  hasTexture(key: string): boolean;
  /** True if a sound with this key (the asset path) is in the audio cache. */
  hasSound(key: string): boolean;
  /** The player's map, tile (as in Tiled), facing and whether a step is in progress; `null` outside the overworld. */
  playerTile(): { map: string; x: number; y: number; facing: Facing; moving: boolean } | null;
  /** The Debug overlay's lines while it is shown (F2), else `null` (also when debugging is disabled). */
  debugLines(): string[] | null;
}

if (import.meta.env.DEV || import.meta.env.VITE_E2E === '1') {
  const preload = (): PreloadScene => game.scene.getScene(PRELOAD_SCENE) as PreloadScene;
  const hooks: E2EHooks = {
    activeScenes: () => game.scene.getScenes(true).map((s) => s.scene.key),
    currentScene: () => {
      const scenes = game.scene.getScenes(true).filter((sc) => sc.scene.key !== DEBUG_SCENE);
      return scenes[scenes.length - 1]?.scene.key ?? null;
    },
    dataSummary: () => {
      if (!hasGameData()) return null;
      const d = getGameData();
      return {
        flexymon: d.flexymon.size,
        attacks: d.attacks.size,
        items: d.items.size,
        npcs: d.npcs.size,
        zones: d.zones.size,
        shops: d.shops.size,
        secretNames: d.secretNames.length,
      };
    },
    dataErrors: () => {
      const scene = game.scene.getScene(ERROR_SCENE) as ErrorScene;
      return game.scene.isActive(ERROR_SCENE) ? [...scene.lines] : [];
    },
    preloadComplete: () => preload().complete,
    failedAssets: () => [...preload().failed],
    hasTexture: (key) => game.textures.exists(key),
    hasSound: (key) => game.cache.audio.exists(key),
    playerTile: () =>
      game.scene.isActive(OVERWORLD_SCENE)
        ? (game.scene.getScene(OVERWORLD_SCENE) as OverworldScene).playerTile()
        : null,
    debugLines: () => {
      if (!game.scene.isActive(DEBUG_SCENE)) return null;
      const scene = game.scene.getScene(DEBUG_SCENE) as DebugScene;
      return scene.shown ? scene.lines() : null;
    },
  };
  Object.assign(window, { __GAME__: game, __E2E__: hooks });
}
