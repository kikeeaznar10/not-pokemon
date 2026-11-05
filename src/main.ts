/**
 * Entry point: creates the Phaser game and, in dev or E2E builds, exposes the test hooks
 * `window.__GAME__` (the Phaser.Game) and `window.__E2E__` (helpers used by Playwright; see tests/README.md).
 */
import Phaser from 'phaser';
import { createGameConfig } from './config/game';
import { events } from './core/events';
import { bindKeyboard, input, type Action } from './core/input';
import { MusicPlayer, type Track } from './world/music';
import { getGameData, hasGameData } from './data/game-data';
import type { Facing } from './data/schemas';
import { debugFlags } from './core/debug-flags';
import { rng } from './core/rng';
import { gameState, setGameState } from './core/session';
import { Autosave } from './core/autosave';
import { getOptions, loadOptions, setOptions } from './core/options';
import { saveStore } from './core/save-store';
import { volumeGain, type Options } from './logic/options';
import type { GameState } from './logic/save';
import { HUD_SCENE, type HudScene } from './scenes/hud-scene';
import { MENU_SCENE, type MenuScene, type MenuView } from './scenes/menu-scene';
import type { BattleKind } from './logic/battle';
import { createInstance, type FlexymonInstance } from './logic/instance';
import { BATTLE_SCENE, type BattleScene, type BattleView } from './scenes/battle-scene';
import { DEBUG_SCENE, type DebugScene } from './scenes/debug-scene';
import { ERROR_SCENE, type ErrorScene } from './scenes/error-scene';
import { OVERWORLD_SCENE, type NpcView, type OverworldScene } from './scenes/overworld-scene';
import type { NpcStates } from './logic/npc-state';
import { useFieldItem, type FieldItemUse } from './logic/field-items';
import type { Inventory } from './logic/inventory';
import { SHOP_SCENE, type ShopScene, type ShopView } from './scenes/shop-scene';
import { STORAGE_SCENE, type StorageScene, type StorageView } from './scenes/storage-scene';
import { PRELOAD_SCENE, type PreloadScene } from './scenes/preload-scene';
import { TITLE_SCENE, type TitleScene, type TitleView } from './scenes/title-scene';
import { NAME_SCENE, type NameScene, type NameView } from './scenes/name-scene';
import { INTRO_SCENE, type IntroScene, type IntroView } from './scenes/intro-scene';
import type { ChoiceState } from './ui/choice-box';
import type { DialogState } from './ui/dialog-box';
import type { MinimapView } from './ui/minimap';
import { RotateScreen, requestFullscreenOnFirstTap } from './ui/rotate-screen';
import { TouchControls, isTouchDevice, preventBrowserGestures, type TouchView } from './ui/touch-controls';

const game = new Phaser.Game(createGameConfig('game'));

// Controls: the keyboard feeds the Input service; each game frame starts a new input frame.
bindKeyboard(window);
game.events.on(Phaser.Core.Events.PRE_STEP, () => input.beginFrame());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) input.releaseAll();
});

// Mobile (M12): on touch devices, on-screen controls feed the Input service, browser gestures are blocked,
// the first tap asks for fullscreen, and portrait shows "Gira el móvil" and pauses the game (loop and sound).
const touchDevice = isTouchDevice(window);
let touchControls: TouchControls | null = null;
let rotateScreen: RotateScreen | null = null;
let fullscreenRequested = false;
let pausedForPortrait = false;
if (touchDevice) {
  touchControls = new TouchControls(document, input);
  touchControls.mount(document.body);
  preventBrowserGestures(document);
  requestFullscreenOnFirstTap(document, window, () => {
    fullscreenRequested = true;
  });
  if (!portraitAllowedForTests()) {
    rotateScreen = new RotateScreen(document, window, (portrait) => {
      input.releaseAll();
      touchControls?.reset();
      if (portrait && !game.isPaused) {
        game.pause();
        game.sound.pauseAll();
        pausedForPortrait = true;
      } else if (!portrait && pausedForPortrait) {
        pausedForPortrait = false;
        game.resume();
        game.sound.resumeAll();
      }
    });
    rotateScreen.mount(document.body);
  }
}

/**
 * E2E builds only: `localStorage['flexymon.e2e.allowPortrait'] === '1'` turns the portrait guard off, so the
 * older browser tests can still drive the game on the portrait phone profiles (`playwright.config.ts`).
 */
function portraitAllowedForTests(): boolean {
  if (!(import.meta.env.DEV || import.meta.env.VITE_E2E === '1')) return false;
  try {
    return window.localStorage.getItem('flexymon.e2e.allowPortrait') === '1';
  } catch {
    return false;
  }
}

// Zone music (M4): crossfades run on the game loop, so they survive Overworld restarts on warps.
const music = new MusicPlayer((key) => game.sound.add(key, { loop: true }) as unknown as Track);
game.events.on(Phaser.Core.Events.STEP, (_time: number, delta: number) => music.update(delta));
events.on('zone:entered', ({ zone }) => {
  const z = getGameData().zones.get(zone);
  if (z) music.play(z.music);
});

// Options (M10): read from `flexymon.options`; the music volume follows the option.
music.setGain(volumeGain(loadOptions().music));
events.on('options:changed', (o) => music.setGain(volumeGain(o.music)));

// Saving (M10): auto-save at every save point and when the page is hidden or closed.
const autosave = new Autosave({ store: saveStore, getState: gameState, setState: setGameState });
autosave.start(window);
events.on('debug:delete_save', () => {
  autosave.disable();
  saveStore.remove();
  window.location.reload();
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
  /** Key of the topmost active scene, ignoring the Debug overlay and the HUD (M10); `null` before any scene runs. */
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
  /**
   * NPCs on the current map: id, tile (the step's start while moving), facing, moving, talking; from M8
   * also `state` (`ready`/`cooldown` for enemies, `null` otherwise) and `alert` ("!" bubble showing).
   * `[]` outside the overworld.
   */
  npcs(): NpcView[];
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
  /** Team, storage box and team slots in the game state (M7). */
  party(): { team: FlexymonInstance[]; storage: FlexymonInstance[]; teamSlots: number };
  /** Steps left without encounter rolls in the overworld, or `null` outside it (M7). */
  safeSteps(): number | null;
  /** Whether wild encounters roll (debug flag, M7). */
  encountersEnabled(): boolean;
  /** Switch wild encounters on or off (same as the debug menu's option, M7). */
  setEncounters(on: boolean): void;
  /** The player's euros in the game state (M8). */
  euros(): number;
  /** Set the player's euros (M8). */
  setEuros(n: number): void;
  /** Enemy NPC states in the game state (M8): id → `ready` / `cooldown` (missing = `ready`). */
  npcStates(): NpcStates;
  /** The bag in the game state (M9): item id → count. */
  items(): Inventory;
  /** Replace the bag (M9). */
  setItems(items: Inventory): void;
  /**
   * Replace team, storage and/or team slots with fresh flexymon of these species (M9; `currentHp` optional).
   * Fields left out stay as they are.
   */
  setParty(party: {
    team?: { speciesId: string; currentHp?: number }[];
    storage?: { speciesId: string; currentHp?: number }[];
    teamSlots?: number;
  }): void;
  /** Use an item outside battle through `useFieldItem` (M9): the result's `use`, or the refusal reason. */
  useFieldItem(itemId: string, targetUid?: string): FieldItemUse | { error: string };
  /** The open shop screen (M9): ui, mode, euros, menu, item, quantity, total, prompt, message; else `null`. */
  shop(): ShopView | null;
  /** The open storage box (M9): column, cursor, species per column, team slots, message; else `null`. */
  storage(): StorageView | null;
  /** Reasons of every `save:request` since the page loaded (M9: `healer`, `shop`; M10: `map`, `battle`, `menu`). */
  saveRequests(): string[];
  /** Reasons of every save written since the page loaded (M10; `quiet` = page hidden / closed). */
  savesWritten(): string[];
  /** The raw `flexymon.save.v1` text, or `null` (M10). */
  savedGame(): string | null;
  /** True while the "Guardando…" icon shows (M10). */
  saveIcon(): boolean;
  /** The open Start menu (M10): ui, menu, detail page, options, description, message; else `null`. */
  menu(): MenuView | null;
  /** The current options (M10). */
  options(): Options;
  /** Replace the options (M10; stored and applied like the options screen does). */
  setOptions(options: Options): void;
  /** Music option gain applied to the music player (0–1, M10). */
  musicGain(): number;
  /** Merge these fields into the game state (M10 tests: bonuses, NPC states…); the position follows the player. */
  patchState(patch: Partial<GameState>): void;
  /** The title screen (M11): ui, menu options and cursor, confirm box, whether a save exists; else `null`. */
  title(): TitleView | null;
  /**
   * From the title (M11): continue a valid save, or start a new game with the default name at the spawn,
   * skipping the menu, the name and the intro (what Start did before M11). False if the title is not showing.
   */
  quickStart(): boolean;
  /** The name screen (M11): name, cursor, cell labels, message; else `null`. */
  nameEntry(): NameView | null;
  /** The intro (M11): step, actors' tiles, dialogue, handover, secret message, jingle plays; else `null`. */
  intro(): IntroView | null;
  /** The player's name in the game state (M11). */
  playerName(): string;
  /** The touch overlay (M12): shown, each control's box in CSS pixels, controls held; `shown: false` on desktop. */
  touchControls(): TouchView;
  /** Actions the Input service holds down right now (M12: keys and touch alike). */
  inputDown(): Action[];
  /** The portrait guard (M12): `shown` ("Gira el móvil" on screen), `paused` (the game loop), `touch` (touch device). */
  rotateScreen(): { shown: boolean; paused: boolean; touch: boolean };
  /** True once the first tap asked for fullscreen (M12). */
  fullscreenRequested(): boolean;
  /** The minimap in the overworld (M12): shown / visible, frame, dot, tile…; `null` outside the overworld. */
  minimap(): MinimapView | null;
}

if (import.meta.env.DEV || import.meta.env.VITE_E2E === '1') {
  // Running, or paused under a Shop / Storage (M9) or Menu (M10) overlay.
  const overworld = (): OverworldScene | null =>
    game.scene.isActive(OVERWORLD_SCENE) || game.scene.isPaused(OVERWORLD_SCENE)
      ? (game.scene.getScene(OVERWORLD_SCENE) as OverworldScene)
      : null;
  const saveRequests: string[] = [];
  events.on('save:request', ({ reason }) => saveRequests.push(reason));
  const fresh = (members: { speciesId: string; currentHp?: number }[]): FlexymonInstance[] =>
    members.map((m) => {
      const species = getGameData().flexymon.get(m.speciesId);
      if (!species) throw new Error(`unknown species "${m.speciesId}"`);
      const inst = createInstance(species, rng);
      return m.currentHp === undefined ? inst : { ...inst, currentHp: m.currentHp };
    });
  const preload = (): PreloadScene => game.scene.getScene(PRELOAD_SCENE) as PreloadScene;
  const hooks: E2EHooks = {
    activeScenes: () => game.scene.getScenes(true).map((s) => s.scene.key),
    currentScene: () => {
      const scenes = game.scene
        .getScenes(true)
        .filter((sc) => sc.scene.key !== DEBUG_SCENE && sc.scene.key !== HUD_SCENE);
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
    playerTile: () => overworld()?.playerTile() ?? null,
    currentMusic: () => music.currentKey(),
    debugMode: () =>
      game.scene.isActive(DEBUG_SCENE) ? (game.scene.getScene(DEBUG_SCENE) as DebugScene).mode : null,
    overworldLocked: () => overworld()?.isLocked() ?? false,
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
    setTeam: (members) => setGameState({ ...gameState(), team: fresh(members) }),
    party: () => {
      const gs = gameState();
      return structuredClone({ team: gs.team, storage: gs.storage, teamSlots: gs.teamSlots });
    },
    safeSteps: () =>
      game.scene.isActive(OVERWORLD_SCENE) || game.scene.isSleeping(OVERWORLD_SCENE)
        ? (game.scene.getScene(OVERWORLD_SCENE) as OverworldScene).safeSteps
        : null,
    encountersEnabled: () => debugFlags.encounters,
    setEncounters: (on) => {
      debugFlags.encounters = on;
    },
    euros: () => gameState().euros,
    setEuros: (n) => setGameState({ ...gameState(), euros: n }),
    npcStates: () => ({ ...gameState().npcs }),
    items: () => ({ ...gameState().items }),
    setItems: (items) => setGameState({ ...gameState(), items: { ...items } }),
    setParty: (p) => {
      const gs = gameState();
      setGameState({
        ...gs,
        ...(p.team ? { team: fresh(p.team) } : {}),
        ...(p.storage ? { storage: fresh(p.storage) } : {}),
        ...(p.teamSlots !== undefined ? { teamSlots: p.teamSlots } : {}),
      });
    },
    useFieldItem: (itemId, targetUid) => {
      const r = useFieldItem(gameState(), getGameData(), itemId, targetUid);
      if (!r.ok) return { error: r.reason };
      setGameState(r.state);
      return r.use;
    },
    shop: () =>
      game.scene.isActive(SHOP_SCENE) ? (game.scene.getScene(SHOP_SCENE) as ShopScene).view() : null,
    storage: () =>
      game.scene.isActive(STORAGE_SCENE) ? (game.scene.getScene(STORAGE_SCENE) as StorageScene).view() : null,
    saveRequests: () => [...saveRequests],
    savesWritten: () => [...autosave.written],
    savedGame: () => saveStore.raw(),
    saveIcon: () =>
      game.scene.isActive(HUD_SCENE) ? (game.scene.getScene(HUD_SCENE) as HudScene).saving : false,
    menu: () =>
      game.scene.isActive(MENU_SCENE) ? (game.scene.getScene(MENU_SCENE) as MenuScene).view() : null,
    options: () => ({ ...getOptions() }),
    setOptions: (o) => setOptions(o),
    musicGain: () => music.getGain(),
    patchState: (patch) => setGameState({ ...gameState(), ...structuredClone(patch) }),
    title: () =>
      game.scene.isActive(TITLE_SCENE) ? (game.scene.getScene(TITLE_SCENE) as TitleScene).view() : null,
    quickStart: () =>
      game.scene.isActive(TITLE_SCENE)
        ? (game.scene.getScene(TITLE_SCENE) as TitleScene).quickStart()
        : false,
    nameEntry: () =>
      game.scene.isActive(NAME_SCENE) ? (game.scene.getScene(NAME_SCENE) as NameScene).view() : null,
    intro: () =>
      game.scene.isActive(INTRO_SCENE) ? (game.scene.getScene(INTRO_SCENE) as IntroScene).view() : null,
    playerName: () => gameState().player.name,
    touchControls: () => touchControls?.view() ?? { shown: false, controls: [], pressed: [] },
    inputDown: () =>
      (['up', 'down', 'left', 'right', 'a', 'b', 'start', 'map', 'debug'] as const).filter((a) =>
        input.isDown(a),
      ),
    rotateScreen: () => ({ shown: rotateScreen?.shown ?? false, paused: game.isPaused, touch: touchDevice }),
    fullscreenRequested: () => fullscreenRequested,
    minimap: () => overworld()?.minimapView() ?? null,
    debugLines: () => {
      if (!game.scene.isActive(DEBUG_SCENE)) return null;
      const scene = game.scene.getScene(DEBUG_SCENE) as DebugScene;
      return scene.shown ? scene.lines() : null;
    },
  };
  Object.assign(window, { __GAME__: game, __E2E__: hooks });
}
