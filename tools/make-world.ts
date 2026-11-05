/**
 * `npm run world` (M14) — builds the real world's Tiled maps from plain-text layouts, since no human can draw them in
 * Tiled in a cloud session:
 * - `tools/world/<zone>.txt`: one character per tile (legend: {@link LEGEND}, documented in `tools/README.md`);
 * - `tools/world/world.json`: per map the base ground under buildings and trees, doors, map-edge links, the Audi,
 *   encounter rectangles and the `default` spawn.
 *
 * Output: `public/assets/tilesets/world.png` (8 × 4 tiles of 32 px; the first 14 tiles are the test tileset's, see
 * `make-test-map.ts`) and `public/maps/<zone>.tmj` for every map (Tiled JSON, CSV layers, embedded tileset, layers
 * `ground`, `deco`, `collision`, `above`, `warps`, `encounters`, `spawns`).
 *
 * Warps are generated so every door and edge has its matching way back:
 * - a door `{ x, y, to }` on an outdoor map is a step warp on the door tile to the interior's doormat (`_` on its
 *   bottom row) facing up; the interior gets an off-map step warp below its doormat back to the tile under the
 *   door, facing down;
 * - an edge `{ side, from, to, map }` is an off-map step warp along that side (`from`–`to` are columns for
 *   north/south, rows for east/west) that keeps the column/row, plus the reverse warp on the other map;
 * - `car` puts the Audi's two tiles (`A`, `a` in the layout) under an `action` warp with the `car` property.
 *
 * Like the other tools it NEVER overwrites an existing file (hand-edited maps are safe); pass `--force` to
 * regenerate everything.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { drawTileset as drawTestTileset } from './make-test-map';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = join(ROOT, 'public');
/** Folder with `world.json` and the `<zone>.txt` layouts. */
export const WORLD_DIR = join(ROOT, 'tools', 'world');
const T = 32;
const COLS = 8;
const ROWS = 4;

/** Local tile ids of `assets/tilesets/world.png` (0–13 are the same tiles as the test tileset). */
export const WT = {
  grass: 0,
  path: 1,
  wall: 2,
  water: 3,
  trunk: 4,
  treetop: 5,
  flowers: 6,
  tallgrass: 7,
  blocker: 8,
  door: 9,
  floor: 10,
  doormat: 11,
  carLeft: 12,
  carRight: 13,
  sand: 14,
  dune: 15,
  mountain: 16,
  vineyard: 17,
  road: 18,
  plaza: 19,
  roof: 20,
  counter: 21,
  desk: 22,
  cactus: 23,
  fence: 24,
  bridge: 25,
  desert: 26,
  shelf: 27,
  rock: 28,
  bush: 29,
  fountain: 30,
  whiteWall: 31,
} as const;

/** Tiles with `solid = true`. */
const SOLID: number[] = [
  WT.wall,
  WT.water,
  WT.blocker,
  WT.carLeft,
  WT.carRight,
  WT.mountain,
  WT.roof,
  WT.counter,
  WT.desk,
  WT.cactus,
  WT.fence,
  WT.shelf,
  WT.rock,
  WT.bush,
  WT.fountain,
  WT.whiteWall,
];
/** Tiles with `encounter = true` (tall grass, dune grass, vineyard). */
const ENCOUNTER: number[] = [WT.tallgrass, WT.dune, WT.vineyard];

/**
 * Layout characters. `ground` chars are drawn in the `ground` layer; `deco` chars are drawn in `deco` over the
 * map's base ground (`world.json › ground`). `T` is a tree: trunk in `deco`, blocked by the hidden `collision`
 * layer, top drawn in `above` on the tile above.
 */
export const LEGEND: Record<string, { layer: 'ground' | 'deco' | 'tree'; tile: number }> = {
  '.': { layer: 'ground', tile: WT.grass },
  ':': { layer: 'ground', tile: WT.path },
  '~': { layer: 'ground', tile: WT.water },
  ',': { layer: 'ground', tile: WT.tallgrass },
  '=': { layer: 'ground', tile: WT.floor },
  _: { layer: 'ground', tile: WT.doormat },
  s: { layer: 'ground', tile: WT.sand },
  S: { layer: 'ground', tile: WT.dune },
  v: { layer: 'ground', tile: WT.vineyard },
  r: { layer: 'ground', tile: WT.road },
  p: { layer: 'ground', tile: WT.plaza },
  d: { layer: 'ground', tile: WT.desert },
  b: { layer: 'ground', tile: WT.bridge },
  T: { layer: 'tree', tile: WT.trunk },
  '#': { layer: 'deco', tile: WT.wall },
  M: { layer: 'deco', tile: WT.mountain },
  f: { layer: 'deco', tile: WT.flowers },
  D: { layer: 'deco', tile: WT.door },
  A: { layer: 'deco', tile: WT.carLeft },
  a: { layer: 'deco', tile: WT.carRight },
  '^': { layer: 'deco', tile: WT.roof },
  C: { layer: 'deco', tile: WT.counter },
  K: { layer: 'deco', tile: WT.desk },
  c: { layer: 'deco', tile: WT.cactus },
  F: { layer: 'deco', tile: WT.fence },
  H: { layer: 'deco', tile: WT.shelf },
  R: { layer: 'deco', tile: WT.rock },
  '*': { layer: 'deco', tile: WT.bush },
  L: { layer: 'deco', tile: WT.fountain },
  W: { layer: 'deco', tile: WT.whiteWall },
};

/** Base grounds a map can put under its deco tiles. */
const GROUNDS = {
  grass: WT.grass,
  sand: WT.sand,
  desert: WT.desert,
  road: WT.road,
  floor: WT.floor,
} as const;

type Side = 'north' | 'south' | 'east' | 'west';

/** One map's entry in `world.json`. */
export interface WorldMapSpec {
  ground: keyof typeof GROUNDS;
  indoor?: boolean;
  /** `default` spawn; interiors default to the doormat. */
  spawn?: [number, number];
  doors?: { x: number; y: number; to: string }[];
  edges?: { side: Side; from: number; to: number; map: string }[];
  car?: { x: number; y: number; to: 'murcia' | 'valencia' };
  encounters?: {
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    group: string;
    mode: 'tiles' | 'all';
  }[];
}

/** `world.json`. */
export interface WorldSpec {
  maps: Record<string, WorldMapSpec>;
}

/** Read `world.json`. */
export function readWorld(dir: string = WORLD_DIR): WorldSpec {
  return JSON.parse(readFileSync(join(dir, 'world.json'), 'utf8')) as WorldSpec;
}

/** Read a layout file into rows; every row must have the same length and only legend characters. */
export function readLayout(id: string, dir: string = WORLD_DIR): string[] {
  const rows = readFileSync(join(dir, `${id}.txt`), 'utf8')
    .replace(/\r/g, '')
    .split('\n');
  while (rows.length > 0 && rows[rows.length - 1] === '') rows.pop();
  return checkLayout(id, rows);
}

/** Validate layout rows (pure): same width, known characters. Returns the rows. */
export function checkLayout(id: string, rows: string[]): string[] {
  if (rows.length === 0) throw new Error(`${id}.txt: empty layout`);
  const w = rows[0]!.length;
  rows.forEach((row, y) => {
    if (row.length !== w) throw new Error(`${id}.txt: row ${y} has ${row.length} tiles, expected ${w}`);
    [...row].forEach((ch, x) => {
      if (!(ch in LEGEND)) throw new Error(`${id}.txt: unknown tile "${ch}" at (${x}, ${y})`);
    });
  });
  return rows;
}

class Canvas {
  readonly png: PNG;
  constructor(w: number, h: number) {
    this.png = new PNG({ width: w, height: h });
  }
  rect(x: number, y: number, w: number, h: number, c: readonly [number, number, number, number]): void {
    for (let j = y; j < y + h; j += 1)
      for (let i = x; i < x + w; i += 1) {
        if (i < 0 || j < 0 || i >= this.png.width || j >= this.png.height) continue;
        const k = (j * this.png.width + i) * 4;
        this.png.data[k] = c[0];
        this.png.data[k + 1] = c[1];
        this.png.data[k + 2] = c[2];
        this.png.data[k + 3] = c[3];
      }
  }
}

/** Draw the 32-tile world tileset: the 16 test tiles (row 0–1) plus the world tiles from id 14 on. */
export function drawWorldTileset(): Buffer {
  const c = new Canvas(COLS * T, ROWS * T);
  const test = PNG.sync.read(drawTestTileset());
  PNG.bitblt(test, c.png, 0, 0, test.width, test.height, 0, 0);
  // Ids 14 and 15 live in the test tileset's unused slots; clear them before drawing.
  c.rect(6 * T, T, 2 * T, T, [0, 0, 0, 0]);
  const at = (id: number): [number, number] => [(id % COLS) * T, Math.floor(id / COLS) * T];
  // The trunk and the Audi are drawn on grass in the test tileset; here they sit in `deco` on any ground (sand,
  // desert…), so their grass pixels become transparent.
  const grassColours = ['88,168,72', '64,136,56'];
  for (const id of [WT.trunk, WT.carLeft, WT.carRight]) {
    const [tx, ty] = at(id);
    for (let j = ty; j < ty + T; j += 1)
      for (let i = tx; i < tx + T; i += 1) {
        const k = (j * c.png.width + i) * 4;
        const rgb = `${c.png.data[k]},${c.png.data[k + 1]},${c.png.data[k + 2]}`;
        if (grassColours.includes(rgb)) c.png.data[k + 3] = 0;
      }
  }
  const tile = (
    id: number,
    base: [number, number, number, number],
    dots?: [number, number, number, number],
  ) => {
    const [x, y] = at(id);
    c.rect(x, y, T, T, base);
    if (dots)
      for (const [dx, dy] of [
        [5, 7],
        [21, 5],
        [13, 19],
        [25, 24],
        [7, 27],
      ] as const)
        c.rect(x + dx, y + dy, 2, 2, dots);
    return [x, y] as const;
  };
  let x: number;
  let y: number;
  tile(WT.sand, [236, 214, 160, 255], [214, 188, 130, 255]);
  [x, y] = tile(WT.dune, [236, 214, 160, 255]);
  for (let i = 3; i < T; i += 7) c.rect(x + i, y + 6, 2, 22, [150, 170, 80, 255]);
  [x, y] = tile(WT.mountain, [120, 110, 100, 255]);
  c.rect(x + 2, y + 14, 28, 18, [96, 88, 80, 255]);
  c.rect(x + 8, y + 6, 16, 10, [96, 88, 80, 255]);
  c.rect(x + 12, y + 2, 8, 6, [240, 240, 245, 255]);
  [x, y] = tile(WT.vineyard, [186, 150, 96, 255]);
  for (let i = 4; i < T; i += 12) {
    c.rect(x + i, y + 2, 6, 28, [70, 130, 50, 255]);
    c.rect(x + i + 1, y + 10, 3, 3, [110, 40, 110, 255]);
    c.rect(x + i + 2, y + 22, 3, 3, [110, 40, 110, 255]);
  }
  [x, y] = tile(WT.road, [90, 90, 96, 255]);
  c.rect(x + 12, y + 14, 8, 3, [230, 230, 230, 255]);
  [x, y] = tile(WT.plaza, [210, 200, 186, 255]);
  c.rect(x, y + 15, T, 1, [170, 160, 150, 255]);
  c.rect(x + 15, y, 1, T, [170, 160, 150, 255]);
  [x, y] = tile(WT.roof, [180, 60, 50, 255]);
  for (let r = 4; r < T; r += 8) c.rect(x, y + r, T, 2, [140, 40, 35, 255]);
  [x, y] = tile(WT.counter, [196, 150, 100, 255]);
  c.rect(x, y + 6, T, 20, [120, 80, 50, 255]);
  c.rect(x, y + 6, T, 4, [160, 110, 70, 255]);
  [x, y] = tile(WT.desk, [196, 150, 100, 255]);
  c.rect(x + 2, y + 8, 28, 16, [150, 150, 160, 255]);
  c.rect(x + 8, y + 4, 14, 10, [40, 40, 50, 255]);
  c.rect(x + 10, y + 6, 10, 6, [90, 150, 220, 255]);
  [x, y] = tile(WT.cactus, [212, 180, 120, 255]);
  c.rect(x + 13, y + 4, 6, 26, [50, 140, 60, 255]);
  c.rect(x + 6, y + 12, 6, 4, [50, 140, 60, 255]);
  c.rect(x + 20, y + 9, 6, 4, [50, 140, 60, 255]);
  [x, y] = tile(WT.fence, [88, 168, 72, 255]);
  c.rect(x, y + 10, T, 4, [150, 110, 60, 255]);
  c.rect(x, y + 20, T, 4, [150, 110, 60, 255]);
  c.rect(x + 4, y + 6, 4, 22, [120, 85, 45, 255]);
  c.rect(x + 24, y + 6, 4, 22, [120, 85, 45, 255]);
  [x, y] = tile(WT.bridge, [60, 120, 210, 255]);
  c.rect(x, y + 2, T, 28, [160, 115, 70, 255]);
  for (let i = 0; i < T; i += 8) c.rect(x + i, y + 2, 1, 28, [110, 75, 45, 255]);
  tile(WT.desert, [212, 180, 120, 255], [190, 156, 100, 255]);
  [x, y] = tile(WT.shelf, [196, 150, 100, 255]);
  c.rect(x + 2, y + 2, 28, 28, [110, 70, 40, 255]);
  for (let r = 9; r < T; r += 9) c.rect(x + 2, y + r, 28, 2, [70, 45, 25, 255]);
  c.rect(x + 6, y + 4, 4, 5, [200, 60, 60, 255]);
  c.rect(x + 14, y + 13, 4, 5, [60, 120, 200, 255]);
  [x, y] = tile(WT.rock, [88, 168, 72, 0]);
  c.rect(x + 3, y + 8, 26, 20, [130, 130, 136, 255]);
  c.rect(x + 7, y + 4, 16, 8, [150, 150, 156, 255]);
  [x, y] = tile(WT.bush, [0, 0, 0, 0]);
  c.rect(x + 3, y + 6, 26, 22, [50, 120, 60, 255]);
  c.rect(x + 8, y + 10, 6, 5, [80, 160, 80, 255]);
  [x, y] = tile(WT.fountain, [210, 200, 186, 255]);
  c.rect(x + 2, y + 6, 28, 22, [170, 170, 180, 255]);
  c.rect(x + 6, y + 10, 20, 14, [90, 160, 230, 255]);
  c.rect(x + 14, y + 2, 4, 14, [200, 230, 250, 255]);
  [x, y] = tile(WT.whiteWall, [236, 238, 242, 255]);
  c.rect(x, y + 28, T, 4, [190, 194, 204, 255]);
  for (let i = 4; i < T; i += 10) c.rect(x + i, y + 6, 4, 16, [150, 190, 230, 255]);
  return PNG.sync.write(c.png);
}

/** Tiled object (point spawn, warp or encounter rectangle) in tiles; written in pixels. */
interface ObjSpec {
  name: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  point?: boolean;
  properties?: { name: string; type: 'string' | 'int'; value: string | number }[];
}

/** A warp object. `toX` / `toY` left out = keep the player's column / row. */
function warp(
  name: string,
  rect: { x: number; y: number; width: number; height: number },
  to: { map: string; x?: number; y?: number; facing?: string },
): ObjSpec {
  const properties: ObjSpec['properties'] = [{ name: 'toMap', type: 'string', value: to.map }];
  if (to.x !== undefined) properties.push({ name: 'toX', type: 'int', value: to.x });
  if (to.y !== undefined) properties.push({ name: 'toY', type: 'int', value: to.y });
  if (to.facing) properties.push({ name: 'toFacing', type: 'string', value: to.facing });
  properties.push({ name: 'trigger', type: 'string', value: 'step' });
  return { name, ...rect, properties };
}

const OPPOSITE: Record<Side, Side> = { north: 'south', south: 'north', east: 'west', west: 'east' };

/** The off-map warp rectangle along `side` of a `w × h` map, covering `from`–`to`. */
function edgeRect(side: Side, from: number, to: number, w: number, h: number) {
  const n = to - from + 1;
  if (side === 'north') return { x: from, y: -1, width: n, height: 1 };
  if (side === 'south') return { x: from, y: h, width: n, height: 1 };
  if (side === 'west') return { x: -1, y: from, width: 1, height: n };
  return { x: w, y: from, width: 1, height: n };
}

/** Where an edge warp lands on the target map (`w × h`) entering through `side` (column/row kept). */
function edgeArrival(side: Side, w: number, h: number): { x?: number; y?: number } {
  if (side === 'north') return { y: 0 };
  if (side === 'south') return { y: h - 1 };
  if (side === 'west') return { x: 0 };
  return { x: w - 1 };
}

/** The doormat (`_`) of an interior layout: on its bottom row. */
export function findDoormat(id: string, rows: string[]): { x: number; y: number } {
  const y = rows.length - 1;
  const x = rows[y]!.indexOf('_');
  if (x < 0) throw new Error(`${id}.txt: an interior needs a doormat "_" on its bottom row`);
  return { x, y };
}

/** Layer grids, warps, encounters and spawns of one built map. */
export interface BuiltMap {
  width: number;
  height: number;
  layers: { ground: number[]; deco: number[]; collision: number[]; above: number[] };
  warps: ObjSpec[];
  encounters: ObjSpec[];
  spawns: ObjSpec[];
}

/** Build every map of the world (pure apart from reading the layouts through `layout`). */
export function buildWorld(
  world: WorldSpec,
  layout: (id: string) => string[] = (id) => readLayout(id),
): Map<string, BuiltMap> {
  const rows = new Map(Object.keys(world.maps).map((id) => [id, layout(id)]));
  const size = (id: string) => {
    const r = rows.get(id);
    if (!r) throw new Error(`world.json: unknown map "${id}"`);
    return { w: r[0]!.length, h: r.length };
  };
  const built = new Map<string, BuiltMap>();

  for (const [id, spec] of Object.entries(world.maps)) {
    const r = rows.get(id)!;
    const { w, h } = size(id);
    const base = GROUNDS[spec.ground];
    if (base === undefined) throw new Error(`world.json › ${id}: unknown ground "${spec.ground}"`);
    const grid = (fill: number) => new Array<number>(w * h).fill(fill);
    const layers = { ground: grid(base), deco: grid(-1), collision: grid(-1), above: grid(-1) };
    r.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        const entry = LEGEND[ch]!;
        const i = y * w + x;
        if (entry.layer === 'ground') layers.ground[i] = entry.tile;
        else layers.deco[i] = entry.tile;
        if (entry.layer === 'tree') {
          layers.collision[i] = WT.blocker;
          if (y > 0) layers.above[i - w] = WT.treetop;
        }
      }),
    );
    const doormat = spec.indoor ? findDoormat(id, r) : null;
    built.set(id, {
      width: w,
      height: h,
      layers,
      warps: [],
      encounters: (spec.encounters ?? []).map((e) => ({
        name: e.name,
        x: e.x,
        y: e.y,
        width: e.width,
        height: e.height,
        properties: [
          { name: 'group', type: 'string', value: e.group },
          { name: 'mode', type: 'string', value: e.mode },
        ],
      })),
      spawns: [
        {
          name: 'default',
          x: spec.spawn?.[0] ?? doormat?.x ?? 0,
          y: spec.spawn?.[1] ?? doormat?.y ?? 0,
          point: true,
        },
      ],
    });
  }

  const charAt = (id: string, x: number, y: number) => rows.get(id)![y]?.[x];
  for (const [id, spec] of Object.entries(world.maps)) {
    const map = built.get(id)!;
    for (const door of spec.doors ?? []) {
      if (charAt(id, door.x, door.y) !== 'D')
        throw new Error(`world.json › ${id}: door to ${door.to} at (${door.x}, ${door.y}) is not a "D" tile`);
      const inside = world.maps[door.to];
      if (!inside?.indoor) throw new Error(`world.json › ${id}: door target "${door.to}" is not an interior`);
      const mat = findDoormat(door.to, rows.get(door.to)!);
      map.warps.push(
        warp(
          `door_${door.to}`,
          { x: door.x, y: door.y, width: 1, height: 1 },
          { map: door.to, ...mat, facing: 'up' },
        ),
      );
      built
        .get(door.to)!
        .warps.push(
          warp(
            'exit',
            { x: mat.x, y: mat.y + 1, width: 1, height: 1 },
            { map: id, x: door.x, y: door.y + 1, facing: 'down' },
          ),
        );
    }
    for (const edge of spec.edges ?? []) {
      const { w, h } = size(id);
      const other = size(edge.map);
      const back = OPPOSITE[edge.side];
      map.warps.push(
        warp(`edge_${edge.map}`, edgeRect(edge.side, edge.from, edge.to, w, h), {
          map: edge.map,
          ...edgeArrival(back, other.w, other.h),
        }),
      );
      built.get(edge.map)!.warps.push(
        warp(`edge_${id}`, edgeRect(back, edge.from, edge.to, other.w, other.h), {
          map: id,
          ...edgeArrival(edge.side, w, h),
        }),
      );
    }
    if (spec.car) {
      const { x, y, to } = spec.car;
      if (charAt(id, x, y) !== 'A' || charAt(id, x + 1, y) !== 'a')
        throw new Error(`world.json › ${id}: the car at (${x}, ${y}) needs "Aa" in the layout`);
      map.warps.push({
        name: 'audi',
        x,
        y,
        width: 2,
        height: 1,
        properties: [
          { name: 'car', type: 'string', value: to },
          { name: 'trigger', type: 'string', value: 'action' },
        ],
      });
    }
  }
  return built;
}

/** Tile properties written into the embedded tileset. */
function tileProps(): { id: number; properties: { name: string; type: 'bool'; value: boolean }[] }[] {
  const out = new Map<number, { name: string; type: 'bool'; value: boolean }[]>();
  for (const id of SOLID) out.set(id, [{ name: 'solid', type: 'bool', value: true }]);
  for (const id of ENCOUNTER)
    out.set(id, [...(out.get(id) ?? []), { name: 'encounter', type: 'bool', value: true }]);
  return [...out].sort(([a], [b]) => a - b).map(([id, properties]) => ({ id, properties }));
}

/** Tiled JSON for a built map. */
export function tiledJson(map: BuiltMap): object {
  const { width: w, height: h } = map;
  const csv = (layer: number[]) => layer.map((id) => (id < 0 ? 0 : id + 1));
  let nextId = 1;
  let nextObj = 1;
  const tileLayer = (name: string, data: number[], visible = true) => ({
    id: nextId++,
    name,
    type: 'tilelayer',
    x: 0,
    y: 0,
    width: w,
    height: h,
    opacity: 1,
    visible,
    data: csv(data),
  });
  const obj = (o: ObjSpec) => ({
    id: nextObj++,
    name: o.name,
    type: '',
    x: o.x * T,
    y: o.y * T,
    width: (o.width ?? 0) * T,
    height: (o.height ?? 0) * T,
    rotation: 0,
    visible: true,
    ...(o.point ? { point: true } : {}),
    ...(o.properties ? { properties: o.properties } : {}),
  });
  const objectLayer = (name: string, list: ObjSpec[]) => ({
    id: nextId++,
    name,
    type: 'objectgroup',
    draworder: 'topdown',
    x: 0,
    y: 0,
    opacity: 1,
    visible: true,
    objects: list.map(obj),
  });
  const layers = [
    tileLayer('ground', map.layers.ground),
    tileLayer('deco', map.layers.deco),
    tileLayer('collision', map.layers.collision, false),
    tileLayer('above', map.layers.above),
    objectLayer('warps', map.warps),
    objectLayer('encounters', map.encounters),
    objectLayer('spawns', map.spawns),
  ];
  return {
    compressionlevel: -1,
    type: 'map',
    version: '1.10',
    tiledversion: '1.11.0',
    orientation: 'orthogonal',
    renderorder: 'right-down',
    infinite: false,
    width: w,
    height: h,
    tilewidth: T,
    tileheight: T,
    nextlayerid: nextId,
    nextobjectid: nextObj,
    layers,
    tilesets: [
      {
        firstgid: 1,
        name: 'world',
        image: '../assets/tilesets/world.png',
        imagewidth: COLS * T,
        imageheight: ROWS * T,
        tilewidth: T,
        tileheight: T,
        tilecount: COLS * ROWS,
        columns: COLS,
        margin: 0,
        spacing: 0,
        tiles: tileProps(),
      },
    ],
  };
}

/** Write `data` to `public/<rel>` unless it exists (or `force`). Returns true if written. */
function write(rel: string, data: Buffer | string, force: boolean): boolean {
  const path = join(PUBLIC_DIR, rel);
  if (existsSync(path) && !force) return false;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
  return true;
}

/** Run the tool; returns the files written (relative to `public/`). */
export function makeWorld(force: boolean): string[] {
  const written: string[] = [];
  if (write('assets/tilesets/world.png', drawWorldTileset(), force))
    written.push('assets/tilesets/world.png');
  for (const [id, map] of buildWorld(readWorld())) {
    const rel = `maps/${id}.tmj`;
    if (write(rel, `${JSON.stringify(tiledJson(map), null, 1)}\n`, force)) written.push(rel);
  }
  return written;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const written = makeWorld(process.argv.includes('--force'));
  process.stdout.write(
    written.length ? `Wrote:\n  ${written.join('\n  ')}\n` : 'Nothing to write (use --force).\n',
  );
}
