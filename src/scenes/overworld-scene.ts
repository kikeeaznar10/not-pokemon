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
 * - Emits `zone:entered` once built (main.ts plays the zone music) and `player:moved` after placing
 *   the player and after every step.
 */
import Phaser from 'phaser';
import { TILE_SIZE } from '../config/game';
import { events } from '../core/events';
import { input } from '../core/input';
import { log } from '../core/log';
import { getGameData } from '../data/game-data';
import type { Facing, Zone } from '../data/schemas';
import { findSpawn, isBlocked, type MapInfo } from '../data/tiled';
import { WARP_FADE_MS } from '../logic/constants';
import { resetSafeSteps } from '../logic/encounter';
import { FACING_DELTA } from '../logic/npc-state';
import { blockedWithWarps, warpAt, warpDestination, type WarpTarget } from '../logic/warp';
import { cameraBounds } from '../world/camera';
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
  private blocked: (x: number, y: number) => boolean = () => true;
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
    const frozen = this.locked || this.debugMenuOpen;
    const dir = frozen ? null : input.direction();
    const fresh = dir !== null && input.justPressed(dir);
    const moves = player.update(dir, Math.min(delta, MAX_FRAME_MS), this.blocked, fresh);
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
      const warp = warpAt(this.info.warps, s.x + d.x, s.y + d.y, 'action');
      if (warp) this.warpTo(warpDestination(warp, s));
    }
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

  /** Debug: go to a zone's `default` spawn (tile 0, 0 if the map has none). */
  private teleport(zoneId: string): void {
    const loaded = getGameData().maps.get(zoneId);
    if (!loaded || !this.player) return;
    const spawn = findSpawn(loaded.info as MapInfo) ?? { x: 0, y: 0 };
    this.warpTo({ map: zoneId, x: spawn.x, y: spawn.y, facing: 'down' });
  }

  /** The player's tile and facing (for hooks and the debug overlay), or `null` before the map is built. */
  playerTile(): { map: string; x: number; y: number; facing: Facing; moving: boolean } | null {
    if (!this.player) return null;
    const s = this.player.state;
    return { map: this.zone.id, x: s.x, y: s.y, facing: s.facing, moving: s.step !== null };
  }

  /** True while input is locked (warp fade) or the debug menu is open. */
  isLocked(): boolean {
    return this.locked || this.debugMenuOpen;
  }

  private emitMoved(): void {
    const t = this.playerTile();
    if (t) events.emit('player:moved', { map: t.map, x: t.x, y: t.y, facing: t.facing });
  }
}
