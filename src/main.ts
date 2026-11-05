/**
 * Entry point: creates the Phaser game and, in dev or E2E builds, exposes the test hooks
 * `window.__GAME__` (the Phaser.Game) and `window.__E2E__` (helpers used by Playwright; see tests/README.md).
 */
import Phaser from 'phaser';
import { createGameConfig } from './config/game';
import { events } from './core/events';
import { bindKeyboard, input } from './core/input';
import { MusicPlayer, type Track } from './world/music';
import { getGameData, hasGameData } from './data/game-data';
import type { Facing } from './data/schemas';
import { rng } from './core/rng';
import { gameState, setGameState } from './core/session';
import type { BattleKind } from './logic/battle';
import { createInstance, type FlexymonInstance } from './logic/instance';
import { BATTLE_SCENE, type BattleScene, type BattleView } from './scenes/battle-scene';
import { DEBUG_SCENE, type DebugScene } from './scenes/debug-scene';
import { ERROR_SCENE, type ErrorScene } from './scenes/error-scene';
import { OVERWORLD_SCENE, type OverworldScene } from './scenes/overworld-scene';
import { PRELOAD_SCENE, type PreloadScene } from './scenes/preload-scene';
import type { ChoiceState } from './ui/choice-box';
import type { DialogState } from './ui/dialog-box';

const game = new Phaser.Game(createGameConfig('game'));

// Controls: the keyboard feeds the Input service; each game frame starts a new input frame.
bindKeyboard(window);
game.events.on(Phaser.Core.Events.PRE_STEP, () => input.beginFrame());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) input.releaseAll();
});

// Zone music (M4): crossfades run on the game loop, so they survive Overworld restarts on warps.
const music = new MusicPlayer((key) => game.sound.add(key, { loop: true }) as unknown as Track);
game.events.on(Phaser.Core.Events.STEP, (_time: number, delta: number) => music.update(delta));
events.on('zone:entered', ({ zone }) => {
  const z = getGameData().zones.get(zone);
  if (z) music.play(z.music);
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
  /** Debug overlay mode: `hidden`, `info` or `menu` (teleport list); `null` when debugging is disabled. */
  debugMode(): string | null;
  /** Sound key of the zone music playing (or fading in), or `null`. */
  currentMusic(): string | null;
  /** True while the overworld ignores movement (warp fade, debug menu, dialogue or choice box). */
  overworldLocked(): boolean;
  /** NPCs on the current map: id, tile (the step's start while moving), facing, moving, talking. `[]` outside the overworld. */
  npcs(): { id: string; x: number; y: number; facing: Facing; moving: boolean; talking: boolean }[];
  /** The open dialogue box (page, visible text, full text, typed, more, voicePlays), or `null`. */
  dialogue(): DialogState | null;
  /** Open a ChoiceBox in the overworld with these options (test helper). */
  openChoice(options: string[]): void;
  /** The open choice box (options, cursor), or `null`. */
  choice(): ChoiceState | null;
  /** Index chosen in the last `openChoice`, `null` if cancelled with B, `undefined` while none. */
  choiceResult(): number | null | undefined;
  /**
   * Start a battle from the overworld against a fresh `speciesId` (default `raton`), `kind` `wild` (default)
   * or `npc`; the RNG is seeded with `seed` when the battle starts. False if the overworld refused
   * (locked, mid-step, a box open, not in the overworld).
   */
  startBattle(seed: number, speciesId?: string, kind?: BattleKind): boolean;
  /** The battle screen as data (ui, menu, message, both sides' logic HP and shown HP), or `null`. */
  battle(): BattleView | null;
  /** The player's team in the game state. */
  team(): FlexymonInstance[];
  /** Replace the team with fresh flexymon of these species (optionally with `currentHp` set). */
  setTeam(members: { speciesId: string; currentHp?: number }[]): void;
}

if (import.meta.env.DEV || import.meta.env.VITE_E2E === '1') {
  const overworld = (): OverworldScene | null =>
    game.scene.isActive(OVERWORLD_SCENE) ? (game.scene.getScene(OVERWORLD_SCENE) as OverworldScene) : null;
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
    currentMusic: () => music.currentKey(),
    debugMode: () =>
      game.scene.isActive(DEBUG_SCENE) ? (game.scene.getScene(DEBUG_SCENE) as DebugScene).mode : null,
    overworldLocked: () =>
      game.scene.isActive(OVERWORLD_SCENE) &&
      (game.scene.getScene(OVERWORLD_SCENE) as OverworldScene).isLocked(),
    npcs: () => overworld()?.npcList() ?? [],
    dialogue: () => overworld()?.dialogState() ?? null,
    openChoice: (options) => overworld()?.openChoice(options),
    choice: () => overworld()?.choiceState() ?? null,
    choiceResult: () => overworld()?.choiceResult(),
    startBattle: (seed, speciesId = 'raton', kind = 'wild') =>
      overworld()?.startBattle({ speciesId, kind, seed }) ?? false,
    battle: () =>
      game.scene.isActive(BATTLE_SCENE) ? (game.scene.getScene(BATTLE_SCENE) as BattleScene).view() : null,
    team: () => structuredClone(gameState().team),
    setTeam: (members) => {
      const data = getGameData();
      const team = members.map((m) => {
        const species = data.flexymon.get(m.speciesId);
        if (!species) throw new Error(`setTeam: unknown species "${m.speciesId}"`);
        const inst = createInstance(species, rng);
        return m.currentHp === undefined ? inst : { ...inst, currentHp: m.currentHp };
      });
      setGameState({ ...gameState(), team });
    },
    debugLines: () => {
      if (!game.scene.isActive(DEBUG_SCENE)) return null;
      const scene = game.scene.getScene(DEBUG_SCENE) as DebugScene;
      return scene.shown ? scene.lines() : null;
    },
  };
  Object.assign(window, { __GAME__: game, __E2E__: hooks });
}
