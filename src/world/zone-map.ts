/**
 * Draw a zone's Tiled map in a scene (shared by the OverworldScene and the IntroScene).
 *
 * - The map was loaded and checked at boot (`GameData.maps`); its JSON goes into Phaser's tilemap cache
 *   under the map path (e.g. `maps/test.tmj`) the first time. Tileset images are loaded by Preload.
 * - Layers: `ground` (depth 0), `deco` (1), `above` (3); characters use depth 2. `collision` is never drawn.
 * - The main camera gets a black background and bounds from `cameraBounds` (a map smaller than the screen
 *   is centred).
 */
import Phaser from 'phaser';
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
  for (const [name, depth] of DRAWN_LAYERS) {
    if (map.getLayerIndex(name) === null) continue;
    map.createLayer(name, tilesets)?.setDepth(depth);
  }
  const cam = scene.cameras.main;
  cam.setBackgroundColor(0x000000);
  const b = cameraBounds(map.widthInPixels, map.heightInPixels);
  cam.setBounds(b.x, b.y, b.width, b.height);
  return info;
}
