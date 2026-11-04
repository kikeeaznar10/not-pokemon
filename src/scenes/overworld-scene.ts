/**
 * OverworldScene — draws one zone's Tiled map and lets the player walk on it (M3).
 *
 * - Start it with {@link OverworldData}: the zone id (a key of `zones.json`) and optionally the tile and
 *   facing; without a position the map's `default` spawn point is used.
 * - Loading: the zone's `.tmj` (Phaser key = its path, e.g. `maps/test.tmj`), then every embedded
 *   tileset image (key = its path relative to `public/`), plus the player sheet.
 * - Layers: `ground` (depth 0), `deco` (1), the player (2), `above` (3); `collision` is never drawn.
 *   Blocking comes from {@link parseTiledMap} (any tile with `solid = true`) and the map edges.
 * - The camera follows the player and is clamped to the map.
 * - Emits `zone:entered` once built and `player:moved` after placing the player and after every step.
 * - Any map problem (missing file, invalid JSON) shows the ErrorScene.
 */
import Phaser from 'phaser';
import { TILE_SIZE } from '../config/game';
import { events } from '../core/events';
import { input } from '../core/input';
import { error, log } from '../core/log';
import { getGameData } from '../data/game-data';
import type { Facing, Zone } from '../data/schemas';
import { findSpawn, isBlocked, parseTiledMap, type MapInfo } from '../data/tiled';
import { Player, PLAYER_SPRITE } from '../world/player';
import { ERROR_SCENE, type ErrorSceneData } from './error-scene';

/** Scene key of {@link OverworldScene}. */
export const OVERWORLD_SCENE = 'Overworld';

/** Where to put the player. */
export interface OverworldData {
  map: string;
  x?: number;
  y?: number;
  facing?: Facing;
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
  private info: MapInfo | null = null;
  private player: Player | null = null;
  private failed: string[] = [];

  constructor() {
    super(OVERWORLD_SCENE);
  }

  init(data: OverworldData): void {
    this.target = data;
    this.info = null;
    this.player = null;
    this.failed = [];
    const zone = getGameData().zones.get(data.map);
    if (!zone) throw new Error(`Overworld: unknown zone "${data.map}"`);
    this.zone = zone;
  }

  preload(): void {
    const file = this.zone.file;
    this.load.on('loaderror', (f: Phaser.Loader.File) => this.failed.push(`${f.key} (${f.url})`));
    if (!this.textures.exists(PLAYER_SPRITE)) {
      this.load.spritesheet(PLAYER_SPRITE, PLAYER_SPRITE, { frameWidth: TILE_SIZE, frameHeight: TILE_SIZE });
    }
    const queueTilesets = (): void => {
      const cached = this.cache.tilemap.get(file) as { data: unknown } | undefined;
      if (!cached) return;
      try {
        for (const ts of parseTiledMap(cached.data, file).tilesetImages) {
          if (!this.textures.exists(ts.path)) this.load.image(ts.path, ts.path);
        }
      } catch {
        // Reported in create() with the full message.
      }
    };
    if (this.cache.tilemap.exists(file)) queueTilesets();
    else {
      this.load.once(`filecomplete-tilemapJSON-${file}`, queueTilesets);
      this.load.tilemapTiledJSON(file, file);
    }
  }

  create(): void {
    const file = this.zone.file;
    try {
      if (this.failed.length) throw new Error(`could not load ${this.failed.join(', ')}`);
      const cached = this.cache.tilemap.get(file) as { data: unknown } | undefined;
      if (!cached) throw new Error(`${file}: not loaded`);
      this.info = parseTiledMap(cached.data, file);
    } catch (e) {
      this.showError(`maps › ${this.zone.id} › ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    const info = this.info;

    const map = this.make.tilemap({ key: file });
    const tilesets = info.tilesetImages
      .map((ts) => map.addTilesetImage(ts.name, ts.path))
      .filter((ts): ts is Phaser.Tilemaps.Tileset => ts !== null);
    for (const [name, depth] of DRAWN_LAYERS) {
      if (map.getLayerIndex(name) === null) continue;
      map.createLayer(name, tilesets)?.setDepth(depth);
    }

    const spawn = findSpawn(info) ?? { x: 0, y: 0 };
    const x = this.target.x ?? spawn.x;
    const y = this.target.y ?? spawn.y;
    this.player = new Player(this, x, y, this.target.facing ?? 'down');

    const cam = this.cameras.main;
    cam.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    cam.startFollow(this.player.sprite, true, 1, 1, -TILE_SIZE / 2, -TILE_SIZE / 2);

    log(`Overworld: entered ${this.zone.id} at ${x},${y}`);
    events.emit('zone:entered', { zone: this.zone.id });
    this.emitMoved();
  }

  override update(_time: number, delta: number): void {
    const player = this.player;
    const info = this.info;
    if (!player || !info) return;
    const moves = player.update(input.direction(), Math.min(delta, MAX_FRAME_MS), (x, y) =>
      isBlocked(info, x, y),
    );
    if (moves.some((m) => m.type === 'step_end')) this.emitMoved();
  }

  /** The player's tile and facing (for hooks and the debug overlay), or `null` before the map is built. */
  playerTile(): { map: string; x: number; y: number; facing: Facing; moving: boolean } | null {
    if (!this.player) return null;
    const s = this.player.state;
    return { map: this.zone.id, x: s.x, y: s.y, facing: s.facing, moving: s.step !== null };
  }

  private emitMoved(): void {
    const t = this.playerTile();
    if (t) events.emit('player:moved', { map: t.map, x: t.x, y: t.y, facing: t.facing });
  }

  private showError(line: string): void {
    error(line);
    const data: ErrorSceneData = { lines: [line] };
    this.scene.start(ERROR_SCENE, data);
  }
}
