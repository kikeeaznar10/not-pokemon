/**
 * Reading Tiled maps (`public/maps/*.tmj`: Tiled JSON, orthogonal, CSV layers, embedded tilesets).
 * Pure (no Phaser): the OverworldScene hands Phaser the same JSON for drawing, and uses
 * {@link parseTiledMap} for the rules (which tiles block, where the spawn points are).
 *
 * Map conventions (docs/PLAN.md › Content guide):
 * - Tile layers `ground`, `deco`, `above` (drawn over the player) and `collision` (hidden in game).
 * - A cell is solid if ANY tile layer has a tile there whose tileset tile has the bool property
 *   `solid = true`. Tiles with `encounter = true` mark grass/sand/vineyard (used from M7).
 * - Object layers `warps` (M4), `encounters` (M7) and `spawns`. Spawn points are point (or tile-sized)
 *   objects in `spawns`; their tile is `floor(x / tilewidth)`, `floor(y / tileheight)`. The one named
 *   `default` is the zone's spawn (used by debug teleport and when no position is given).
 */
import { z } from 'zod';

const propertySchema = z.object({ name: z.string(), type: z.string().optional(), value: z.unknown() });

const objectSchema = z.object({
  id: z.number(),
  name: z.string().default(''),
  type: z.string().optional(),
  x: z.number(),
  y: z.number(),
  width: z.number().default(0),
  height: z.number().default(0),
  point: z.boolean().optional(),
  properties: z.array(propertySchema).optional(),
});

const tileLayerSchema = z.object({
  type: z.literal('tilelayer'),
  name: z.string(),
  width: z.number(),
  height: z.number(),
  data: z.array(z.number()),
  visible: z.boolean().optional(),
});

const objectLayerSchema = z.object({
  type: z.literal('objectgroup'),
  name: z.string(),
  objects: z.array(objectSchema),
});

const tilesetSchema = z.object({
  firstgid: z.number().int().min(1),
  name: z.string(),
  image: z.string(),
  tilewidth: z.number(),
  tileheight: z.number(),
  tilecount: z.number(),
  columns: z.number(),
  tiles: z.array(z.object({ id: z.number(), properties: z.array(propertySchema).optional() })).optional(),
});

/** The subset of the Tiled JSON format the game reads. Unknown fields are allowed (Tiled writes many). */
export const tiledMapSchema = z.object({
  orientation: z.literal('orthogonal'),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
  tilewidth: z.number(),
  tileheight: z.number(),
  layers: z.array(
    z.union([tileLayerSchema, objectLayerSchema, z.object({ type: z.string(), name: z.string() })]),
  ),
  tilesets: z.array(tilesetSchema).min(1, 'needs an embedded tileset'),
});

/** Raw Tiled JSON (validated subset). */
export type TiledMap = z.infer<typeof tiledMapSchema>;
/** One embedded tileset. */
export type TiledTileset = z.infer<typeof tilesetSchema>;
/** One Tiled object. */
export type TiledObject = z.infer<typeof objectSchema>;

/** Tile layer names the game draws, bottom to top (`collision` is never drawn). */
export const TILE_LAYERS = ['ground', 'deco', 'above', 'collision'] as const;

/** A named spawn point in tiles. */
export interface SpawnPoint {
  name: string;
  x: number;
  y: number;
}

/** What the game needs from a map besides the picture. */
export interface MapInfo {
  width: number;
  height: number;
  /** Row-major: `solid[y * width + x]`. */
  solid: boolean[];
  /** Row-major: tiles with `encounter = true`. */
  encounter: boolean[];
  spawns: SpawnPoint[];
  /** Tileset images, resolved relative to `public/` (e.g. `assets/tilesets/test.png`), by tileset name. */
  tilesetImages: { name: string; path: string }[];
}

/** Read a Tiled custom property (bool/int/string) from a property list. */
export function tiledProperty(
  props: readonly { name: string; value: unknown }[] | undefined,
  name: string,
): unknown {
  return props?.find((p) => p.name === name)?.value;
}

/** Resolve a path written inside a map file (relative to the map) to a path relative to `public/`. */
export function resolveMapPath(mapFile: string, relative: string): string {
  const parts = mapFile.split('/').slice(0, -1);
  for (const seg of relative.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.' && seg !== '') parts.push(seg);
  }
  return parts.join('/');
}

/** Global tile ids (gids) whose tileset tile has the bool property `name = true`. */
function gidsWith(map: TiledMap, name: string): Set<number> {
  const out = new Set<number>();
  for (const ts of map.tilesets) {
    for (const tile of ts.tiles ?? []) {
      if (tiledProperty(tile.properties, name) === true) out.add(ts.firstgid + tile.id);
    }
  }
  return out;
}

/** Tiled stores flip flags in the top 3 bits of a gid; strip them. */
const GID_MASK = 0x1fffffff;

/**
 * Validate and read a map. `mapFile` is its path relative to `public/` (for resolving tileset images).
 * Throws a readable `Error` if the JSON is not a map the game can use.
 */
export function parseTiledMap(json: unknown, mapFile: string): MapInfo {
  const parsed = tiledMapSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`${mapFile}: ${issue?.path.join('.') || '(root)'}: ${issue?.message ?? 'invalid map'}`);
  }
  const map = parsed.data;
  const size = map.width * map.height;
  const solidGids = gidsWith(map, 'solid');
  const encounterGids = gidsWith(map, 'encounter');
  const solid = new Array<boolean>(size).fill(false);
  const encounter = new Array<boolean>(size).fill(false);

  for (const layer of map.layers) {
    if (layer.type !== 'tilelayer' || !('data' in layer)) continue;
    const data = layer.data as number[];
    if (data.length !== size)
      throw new Error(`${mapFile}: layer "${layer.name}" has ${data.length} cells, expected ${size}`);
    data.forEach((raw, i) => {
      const gid = raw & GID_MASK;
      if (solidGids.has(gid)) solid[i] = true;
      if (encounterGids.has(gid)) encounter[i] = true;
    });
  }

  const spawns: SpawnPoint[] = [];
  const spawnLayer = map.layers.find((l) => l.type === 'objectgroup' && l.name === 'spawns');
  if (spawnLayer && 'objects' in spawnLayer) {
    for (const o of spawnLayer.objects as TiledObject[]) {
      spawns.push({ name: o.name, x: Math.floor(o.x / map.tilewidth), y: Math.floor(o.y / map.tileheight) });
    }
  }

  return {
    width: map.width,
    height: map.height,
    solid,
    encounter,
    spawns,
    tilesetImages: map.tilesets.map((ts) => ({ name: ts.name, path: resolveMapPath(mapFile, ts.image) })),
  };
}

/** True if (x, y) is outside the map or on a solid cell. */
export function isBlocked(info: MapInfo, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= info.width || y >= info.height) return true;
  return info.solid[y * info.width + x] === true;
}

/** The spawn point named `name` (default `default`), or `null`. */
export function findSpawn(info: MapInfo, name = 'default'): SpawnPoint | null {
  return info.spawns.find((s) => s.name === name) ?? null;
}
