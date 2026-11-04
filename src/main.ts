/**
 * Entry point: creates the Phaser game and, in dev or E2E builds, exposes the test hooks
 * `window.__GAME__` (the Phaser.Game) and `window.__E2E__` (helpers used by Playwright).
 */
import Phaser from 'phaser';
import { createGameConfig } from './config/game';

const game = new Phaser.Game(createGameConfig('game'));

/** Helpers for Playwright tests. They grow with the milestones (see tests/README.md). */
export interface E2EHooks {
  /** Keys of the currently active scenes, topmost last. */
  activeScenes(): string[];
  /** Key of the topmost active scene, or `null` before any scene runs. */
  currentScene(): string | null;
}

if (import.meta.env.DEV || import.meta.env.VITE_E2E === '1') {
  const hooks: E2EHooks = {
    activeScenes: () => game.scene.getScenes(true).map((s) => s.scene.key),
    currentScene: () => {
      const scenes = game.scene.getScenes(true);
      return scenes[scenes.length - 1]?.scene.key ?? null;
    },
  };
  Object.assign(window, { __GAME__: game, __E2E__: hooks });
}
