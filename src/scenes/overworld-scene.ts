/**
 * OverworldScene — draws one zone's Tiled map and lets the player walk on it (M3), and moves between
 * maps through warps (M4).
 *
 * - Start it with {@link OverworldData}: the zone id (a key of `zones.json`) and optionally the tile and
 *   facing; without a position the map's `default` spawn point is used.
 * - The map was loaded and checked at boot (`GameData.maps`); its JSON goes into Phaser's tilemap
 *   cache under the map path (e.g. `maps/test.tmj`). Tileset images and the player sheet are loaded by
 *   Preload.
 * - Layers: `ground` (depth 0), `deco` (1), the player (2), `above` (3); `collision` is never drawn.
 *   Blocking: solid tiles and the map edges, except off-map tiles covered by a step warp.
 * - Camera: follows the player, clamped to the map. A map smaller than the screen (interiors) is
 *   centred on a black background.
 * - Warps (`src/logic/warp.ts`): finishing a step on a `step` warp, or pressing A while standing still
 *   facing an `action` warp, locks input, fades out (`WARP_FADE_MS`), restarts this scene on the
 *   target, fades in and unlocks. Safe steps are reset on every map entry.
 * - Debug teleport (M4): `debug:teleport` moves the player to a zone's `default` spawn the same way;
 *   while `debug:menu` is open the player does not move.
 * - NPCs (M5): every `npcs.json` entry whose `map` is this zone appears on its spawn tile and wanders
 *   (`src/world/npc.ts`, rules in `src/logic/npc-wander.ts`). NPCs never step onto solid tiles, warp
 *   tiles, the player or another NPC; the player can never step onto an NPC. While a step is in progress
 *   both its tiles count as taken, for the player and for NPCs.
 * - Talking (M5): standing still, A while facing an NPC (one standing on, or arriving at, the tile in
 *   front) makes it turn to the player and stop; its lines (`src/logic/talk.ts`) show in the DialogBox
 *   with its `voice`. The player cannot move until the last box closes. NPCs take priority over
 *   `action` warps.
 * - Battles (M6): {@link OverworldScene.startBattle} locks input, flashes the screen for `BATTLE_FLASH_MS`,
 *   then launches the BattleScene and puts this scene to sleep (map, player and NPCs keep their state).
 *   On `battle:ended` it wakes up on the same tile, fades in and resets the safe steps. The debug command
 *   `debug:battle` starts a wild battle against a fresh flexymon of any species.
 * - Emits `zone:entered` once built (main.ts plays the zone music) and `player:moved` after placing
 *   the player and after every step.
 */
import Phaser from 'phaser';
import { TILE_SIZE } from '../config/game';
import { events } from '../core/events';
import { input } from '../core/input';
import { log } from '../core/log';
import { rng } from '../core/rng';
import { getGameData } from '../data/game-data';
import type { Facing, Zone } from '../data/schemas';
import { findSpawn, isBlocked, type MapInfo } from '../data/tiled';
import { t } from '../i18n';
import type { BattleKind } from '../logic/battle';
import { BATTLE_FLASH_MS, WARP_FADE_MS } from '../logic/constants';
import { createInstance } from '../logic/instance';
import { resetSafeSteps } from '../logic/encounter';
import { FACING_DELTA } from '../logic/npc-state';
import { talkLines } from '../logic/talk';
import { blockedWithWarps, insideWarp, warpAt, warpDestination, type WarpTarget } from '../logic/warp';
import { ChoiceBox, type ChoiceState } from '../ui/choice-box';
import { DialogBox, type DialogState } from '../ui/dialog-box';
import { cameraBounds } from '../world/camera';
import { NpcActor, npcsOnMap } from '../world/npc';
import { BATTLE_SCENE, type BattleSceneData } from './battle-scene';
import { Player } from '../world/player';

/** Scene key of {@link OverworldScene}. */
export const OVERWORLD_SCENE = 'Overworld';

/** Where to put the player. `fadeIn` is set by warps (the screen starts black and fades in). */
export interface OverworldData {
  map: string;
  x?: number;
  y?: number;
  facing?: Facing;
  fadeIn?: boolean;
}

/** What {@link OverworldScene.startBattle} needs: the opponent species, the kind and an optional seed. */
export interface BattleRequest {
  speciesId: string;
  kind?: BattleKind;
  seed?: number;
}

/** Number of white flashes in the battle transition. */
const BATTLE_FLASHES = 3;

/** Longest frame time fed to movement (ms), so a stalled tab does not teleport the player. */
const MAX_FRAME_MS = 250;

/** Tile layers drawn, with their depth. */
const DRAWN_LAYERS: [name: string, depth: number][] = [
  ['ground', 0],
  ['deco', 1],
  ['above', 3],
];

/** The walking-around scene. */
export class OverworldScene extends Phaser.Scene {
  private target!: OverworldData;
  private zone!: Zone;
  private info!: MapInfo;
  private player: Player | null = null;
  /** Solid tiles and map edges for the player (warp tiles outside the map are open). */
  private blocked: (x: number, y: number) => boolean = () => true;
  private npcs: NpcActor[] = [];
  private dialog: DialogBox | null = null;
  private choice: ChoiceBox | null = null;
  /** Result of the last {@link openChoice} (`undefined` = none chosen yet). For the E2E hooks. */
  private lastChoice: number | null | undefined = undefined;
  /** True during a warp fade: the player cannot move. */
  private locked = false;
  private debugMenuOpen = false;
  /** Steps left without encounter rolls (used by encounters in M7). */
  safeSteps = 0;

  constructor() {
    super(OVERWORLD_SCENE);
  }

  init(data: OverworldData): void {
    this.target = data;
    this.player = null;
    this.npcs = [];
    this.dialog = null;
    this.choice = null;
    this.locked = false;
    const zone = getGameData().zones.get(data.map);
    if (!zone) throw new Error(`Overworld: unknown zone "${data.map}"`);
    this.zone = zone;
  }

  create(): void {
    const loaded = getGameData().maps.get(this.zone.id);
    if (!loaded) throw new Error(`Overworld: map of "${this.zone.id}" not loaded`);
    this.info = loaded.info as MapInfo;
    const info = this.info;
    const file = this.zone.file;
    if (!this.cache.tilemap.exists(file)) {
      this.cache.tilemap.add(file, {
        format: Phaser.Tilemaps.Formats.TILED_JSON,
        data: structuredClone(loaded.json),
      });
    }

    const map = this.make.tilemap({ key: file });
    const tilesets = info.tilesetImages
      .map((ts) => map.addTilesetImage(ts.name, ts.path))
      .filter((ts): ts is Phaser.Tilemaps.Tileset => ts !== null);
    for (const [name, depth] of DRAWN_LAYERS) {
      if (map.getLayerIndex(name) === null) continue;
      map.createLayer(name, tilesets)?.setDepth(depth);
    }
    this.blocked = blockedWithWarps(info, info.warps, (x, y) => isBlocked(info, x, y));

    const spawn = findSpawn(info) ?? { x: 0, y: 0 };
    const x = this.target.x ?? spawn.x;
    const y = this.target.y ?? spawn.y;
    this.player = new Player(this, x, y, this.target.facing ?? 'down');
    this.npcs = npcsOnMap(getGameData().npcs.values(), this.zone.id).map((n) => new NpcActor(this, n, rng));
    this.dialog = new DialogBox(this);
    this.choice = new ChoiceBox(this);
    this.safeSteps = resetSafeSteps();

    const cam = this.cameras.main;
    cam.setBackgroundColor(0x000000);
    const b = cameraBounds(map.widthInPixels, map.heightInPixels);
    cam.setBounds(b.x, b.y, b.width, b.height);
    cam.startFollow(this.player.sprite, true, 1, 1, -TILE_SIZE / 2, -TILE_SIZE / 2);
    if (this.target.fadeIn) {
      this.locked = true;
      cam.fadeIn(WARP_FADE_MS, 0, 0, 0);
      cam.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => {
        this.locked = false;
      });
    }

    const offs = [
      events.on('debug:teleport', ({ map: zoneId }) => this.teleport(zoneId)),
      events.on('debug:battle', ({ speciesId }) => {
        this.startBattle({ speciesId });
      }),
      events.on('battle:ended', () => this.returnFromBattle()),
      events.on('debug:menu', ({ open }) => {
        this.debugMenuOpen = open;
      }),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => offs.forEach((off) => off()));

    log(`Overworld: entered ${this.zone.id} at ${x},${y}`);
    events.emit('zone:entered', { zone: this.zone.id });
    this.emitMoved();
  }

  override update(_time: number, delta: number): void {
    const player = this.player;
    if (!player) return;
    const dt = Math.min(delta, MAX_FRAME_MS);
    const talking = this.isTalking();
    if (this.dialog?.isOpen) this.dialog.update(dt);
    else if (this.choice?.isOpen) this.choice.update();
    for (const npc of this.npcs) npc.update(dt, (nx, ny) => this.blockedForNpc(npc, nx, ny), rng);

    const frozen = this.locked || this.debugMenuOpen || talking;
    const dir = frozen ? null : input.direction();
    const fresh = dir !== null && input.justPressed(dir);
    const moves = player.update(dir, dt, (px, py) => this.blockedForPlayer(px, py), fresh);
    if (moves.some((m) => m.type === 'step_end')) {
      this.emitMoved();
      const s = player.state;
      const warp = warpAt(this.info.warps, s.x, s.y, 'step');
      if (warp) {
        this.warpTo(warpDestination(warp, s));
        return;
      }
    }
    if (!frozen && input.justPressed('a') && !player.state.step) {
      const s = player.state;
      const d = FACING_DELTA[s.facing];
      const npc = this.npcs.find((n) => {
        const at = n.arrival();
        return at.x === s.x + d.x && at.y === s.y + d.y;
      });
      if (npc) {
        this.talkTo(npc);
        return;
      }
      const warp = warpAt(this.info.warps, s.x + d.x, s.y + d.y, 'action');
      if (warp) this.warpTo(warpDestination(warp, s));
    }
  }

  /**
   * Start a battle against one fresh flexymon of `speciesId` (zero bonus, full HP). Refused (returns
   * false) while input is locked, a box is open or the player is mid-step; also while asleep in a battle.
   */
  startBattle(req: BattleRequest): boolean {
    const player = this.player;
    const species = getGameData().flexymon.get(req.speciesId);
    if (!player || !species || this.isLocked() || player.state.step || !this.sys.isActive()) return false;
    this.locked = true;
    const data: BattleSceneData = {
      kind: req.kind ?? 'wild',
      opponent: [createInstance(species, rng)],
      ...(req.seed !== undefined ? { seed: req.seed } : {}),
    };
    const cam = this.cameras.main;
    const each = BATTLE_FLASH_MS / BATTLE_FLASHES;
    for (let i = 0; i < BATTLE_FLASHES; i++) {
      this.time.delayedCall(i * each, () => cam.flash(each, 255, 255, 255, true));
    }
    this.time.delayedCall(BATTLE_FLASH_MS, () => {
      log(`Overworld: battle vs ${req.speciesId}`);
      this.scene.launch(BATTLE_SCENE, data);
      this.scene.sleep();
    });
    return true;
  }

  /** Wake up after a battle on the same tile: fade in, reset safe steps, unlock. */
  private returnFromBattle(): void {
    if (!this.sys.isSleeping()) return;
    this.scene.wake();
    this.safeSteps = resetSafeSteps();
    const cam = this.cameras.main;
    cam.resetFX();
    cam.fadeIn(WARP_FADE_MS, 0, 0, 0);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => {
      this.locked = false;
    });
    this.emitMoved();
  }

  /** Lock input, fade out, then restart on the target (which fades in and unlocks). */
  warpTo(target: WarpTarget): void {
    if (this.locked) return;
    this.locked = true;
    const cam = this.cameras.main;
    cam.fadeOut(WARP_FADE_MS, 0, 0, 0);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const data: OverworldData = { ...target, fadeIn: true };
      this.scene.restart(data);
    });
  }

  /** Start a conversation with `npc`; the player is frozen until the last box closes. */
  private talkTo(npc: NpcActor): void {
    const player = this.player;
    if (!player || !this.dialog) return;
    npc.beginTalk(player.state.facing);
    log(`Overworld: talking to ${npc.npc.id}`);
    this.dialog.open(talkLines(npc.npc, t), {
      voice: npc.npc.voice,
      onClose: () => npc.finishTalk(rng),
    });
  }

  /** Player blocking: solid tiles, map edges (except warp tiles) and any tile an NPC occupies. */
  private blockedForPlayer(x: number, y: number): boolean {
    return this.blocked(x, y) || this.npcs.some((n) => n.occupies(x, y));
  }

  /** NPC blocking: solid tiles, map edges, warp tiles, the player's tiles and the other NPCs' tiles. */
  private blockedForNpc(self: NpcActor, x: number, y: number): boolean {
    if (isBlocked(this.info, x, y)) return true;
    if (this.info.warps.some((w) => insideWarp(w, x, y))) return true;
    const p = this.player?.state;
    if (p && ((p.x === x && p.y === y) || (p.step && p.step.to.x === x && p.step.to.y === y))) return true;
    return this.npcs.some((n) => n !== self && n.occupies(x, y));
  }

  /** True while a dialogue or choice box is open. */
  isTalking(): boolean {
    return !!(this.dialog?.isOpen || this.choice?.isOpen);
  }

  /** The NPCs on this map with their tile and state (for hooks and tests). */
  npcList(): { id: string; x: number; y: number; facing: Facing; moving: boolean; talking: boolean }[] {
    return this.npcs.map((n) => {
      const s = n.state;
      return { id: n.npc.id, x: s.x, y: s.y, facing: s.facing, moving: s.step !== null, talking: s.talking };
    });
  }

  /** The open dialogue box, or `null`. */
  dialogState(): DialogState | null {
    return this.dialog?.state() ?? null;
  }

  /** The open choice box, or `null`. */
  choiceState(): ChoiceState | null {
    return this.choice?.state() ?? null;
  }

  /**
   * Open a ChoiceBox with `options` (test hook; real uses arrive with M7/M9). The player is frozen until
   * it closes; the result is read with {@link choiceResult}.
   */
  openChoice(options: string[]): void {
    this.lastChoice = undefined;
    this.choice?.open(options, {
      onChoose: (i) => {
        this.lastChoice = i;
      },
    });
  }

  /** Index chosen in the last {@link openChoice}, `null` if cancelled, `undefined` if none yet. */
  choiceResult(): number | null | undefined {
    return this.lastChoice;
  }

  /** Debug: go to a zone's `default` spawn (tile 0, 0 if the map has none). */
  private teleport(zoneId: string): void {
    const loaded = getGameData().maps.get(zoneId);
    if (!loaded || !this.player || !this.sys.isActive()) return;
    const spawn = findSpawn(loaded.info as MapInfo) ?? { x: 0, y: 0 };
    this.warpTo({ map: zoneId, x: spawn.x, y: spawn.y, facing: 'down' });
  }

  /** The player's tile and facing (for hooks and the debug overlay), or `null` before the map is built. */
  playerTile(): { map: string; x: number; y: number; facing: Facing; moving: boolean } | null {
    if (!this.player) return null;
    const s = this.player.state;
    return { map: this.zone.id, x: s.x, y: s.y, facing: s.facing, moving: s.step !== null };
  }

  /** True while the player cannot move: warp fade, debug menu, or a dialogue/choice box is open. */
  isLocked(): boolean {
    return this.locked || this.debugMenuOpen || this.isTalking();
  }

  private emitMoved(): void {
    const t = this.playerTile();
    if (t) events.emit('player:moved', { map: t.map, x: t.x, y: t.y, facing: t.facing });
  }
}
