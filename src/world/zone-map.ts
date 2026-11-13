/**
 * Draw a zone's Tiled map in a scene (shared by the OverworldScene and the IntroScene).
 *
 * - The map was loaded and checked at boot (`GameData.maps`); its JSON goes into Phaser's tilemap cache
 *   under the map path (e.g. `maps/test.tmj`) the first time. Tileset images are loaded by Preload.
 * - Layers: `ground` (depth 0), `deco` (1), `above` (3); characters use depth 2. `collision` is never drawn.
 * - Building skins (`zone.buildings`): when the skin's image loaded, the `deco` and `above` tiles under its rectangle are
 *   emptied and the image is drawn there (depth 1.5, under characters, over the ground). Collision is untouched; a
 *   skin whose image is missing leaves the tiles as they are.
 * - The main camera gets a black background and bounds from `cameraBounds` (a map smaller than the screen
 *   is centred).
 */
import Phaser from 'phaser';
import { TILE_SIZE } from '../config/game';
import type { Zone } from '../data/schemas';
import { getGameData } from '../data/game-data';
import type { MapInfo } from '../data/tiled';
import { cameraBounds } from './camera';

/** Tile layers drawn, with their depth. */
const DRAWN_LAYERS: [name: string, depth: number][] = [
  ['ground', 0],
  ['deco', 1],
  ['above', 3],
];

/** Depth of building skins: over the ground and `deco` tiles, under characters (2). */
const BUILDING_DEPTH = 1.5;

/** Build the tilemap of `zone` in `scene`, set the camera bounds and return the map's rule data. */
export function drawZoneMap(scene: Phaser.Scene, zone: Readonly<Zone>): MapInfo {
  const loaded = getGameData().maps.get(zone.id);
  if (!loaded) throw new Error(`Map of "${zone.id}" not loaded`);
  const info = loaded.info as MapInfo;
  const file = zone.file;
  if (!scene.cache.tilemap.exists(file)) {
    scene.cache.tilemap.add(file, {
      format: Phaser.Tilemaps.Formats.TILED_JSON,
      data: structuredClone(loaded.json),
    });
  }
  const map = scene.make.tilemap({ key: file });
  const tilesets = info.tilesetImages
    .map((ts) => map.addTilesetImage(ts.name, ts.path))
    .filter((ts): ts is Phaser.Tilemaps.Tileset => ts !== null);
  const layers = new Map<string, Phaser.Tilemaps.TilemapLayer | Phaser.Tilemaps.TilemapGPULayer>();
  for (const [name, depth] of DRAWN_LAYERS) {
    if (map.getLayerIndex(name) === null) continue;
    const layer = map.createLayer(name, tilesets);
    if (layer) layers.set(name, layer.setDepth(depth));
  }
  for (const b of zone.buildings ?? []) {
    if (!scene.textures.exists(b.image)) continue;
    for (const name of ['deco', 'above']) layers.get(name)?.fill(-1, b.x, b.y, b.width, b.height);
    scene.add
      .image(b.x * TILE_SIZE, b.y * TILE_SIZE, b.image)
      .setOrigin(0, 0)
      .setDisplaySize(b.width * TILE_SIZE, b.height * TILE_SIZE)
      .setDepth(BUILDING_DEPTH);
  }
  const cam = scene.cameras.main;
  cam.setBackgroundColor(0x000000);
  const b = cameraBounds(map.widthInPixels, map.heightInPixels);
  cam.setBounds(b.x, b.y, b.width, b.height);
  return info;
}
