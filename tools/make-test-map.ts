/**
 * `npm run test-map` — writes the test maps and the art they need, since no human can draw them in
 * Tiled in a cloud session:
 * - `public/assets/tilesets/test.png`: placeholder tileset (8 × 2 tiles of 32 px; see {@link TILES}).
 * - `public/maps/test/test.tmj` (30 × 20, outdoor), `test_house.tmj` (10 × 8, indoor) and `test_east.tmj`
 *   (30 × 20, joined to `test` by the east edge): Tiled JSON maps (CSV layers, embedded tileset) with
 *   the layers `ground`, `deco`, `above`, `collision` and the object layers `warps`, `encounters`,
 *   `spawns`. Layouts: `docs/TESTING.md` › The test world. They belong to the frozen test world
 *   (`public/test-world/data/`, `src/data/world.ts`), not to the real game.
 * - `public/assets/sprites/player.png`: the player sheet (`tools/art/characters.ts`), 2 columns (stand, stride) × 4 rows
 *   (down, left, right, up) of 32 × 32 frames.
 *
 * Like the placeholder tool it NEVER overwrites an existing file (hand-edited maps are safe); pass
 * `--force` to regenerate everything. The output opens in Tiled for further editing.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { drawCharacterSheet, PLAYER_LOOK } from './art/characters';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = join(ROOT, 'public');
const T = 32;

type Rgba = [number, number, number, number];

/** Tileset tiles: local id → name, colours and Tiled properties. */
export const TILES = {
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
} as const;

/** Tile properties written into the embedded tileset. */
const TILE_PROPS: Record<number, { name: string; type: 'bool'; value: boolean }[]> = {
  [TILES.wall]: [{ name: 'solid', type: 'bool', value: true }],
  [TILES.water]: [{ name: 'solid', type: 'bool', value: true }],
  [TILES.blocker]: [{ name: 'solid', type: 'bool', value: true }],
  [TILES.tallgrass]: [{ name: 'encounter', type: 'bool', value: true }],
  [TILES.carLeft]: [{ name: 'solid', type: 'bool', value: true }],
  [TILES.carRight]: [{ name: 'solid', type: 'bool', value: true }],
};

class Canvas {
  readonly png: PNG;
  constructor(w: number, h: number) {
    this.png = new PNG({ width: w, height: h });
  }
  rect(x: number, y: number, w: number, h: number, c: Rgba): void {
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
  toBuffer(): Buffer {
    return PNG.sync.write(this.png);
  }
}

/** Draw the 16-slot tileset (unused slots stay transparent). */
export function drawTileset(): Buffer {
  const c = new Canvas(8 * T, 2 * T);
  const at = (id: number): [number, number] => [(id % 8) * T, Math.floor(id / 8) * T];
  const grass = (x: number, y: number) => {
    c.rect(x, y, T, T, [88, 168, 72, 255]);
    for (const [dx, dy] of [
      [4, 6],
      [20, 4],
      [12, 18],
      [26, 22],
      [6, 26],
    ] as const)
      c.rect(x + dx, y + dy, 2, 3, [64, 136, 56, 255]);
  };
  let [x, y] = at(TILES.grass);
  grass(x, y);
  [x, y] = at(TILES.path);
  c.rect(x, y, T, T, [214, 190, 140, 255]);
  c.rect(x + 6, y + 10, 3, 2, [180, 156, 110, 255]);
  c.rect(x + 22, y + 24, 3, 2, [180, 156, 110, 255]);
  [x, y] = at(TILES.wall);
  c.rect(x, y, T, T, [150, 70, 50, 255]);
  for (let r = 0; r < 4; r += 1) {
    c.rect(x, y + r * 8 + 7, T, 1, [90, 40, 30, 255]);
    const off = r % 2 === 0 ? 0 : 8;
    for (let b = off; b < T; b += 16) c.rect(x + b, y + r * 8, 1, 7, [90, 40, 30, 255]);
  }
  [x, y] = at(TILES.water);
  c.rect(x, y, T, T, [60, 120, 210, 255]);
  c.rect(x + 4, y + 8, 10, 2, [150, 200, 250, 255]);
  c.rect(x + 16, y + 20, 10, 2, [150, 200, 250, 255]);
  [x, y] = at(TILES.trunk);
  grass(x, y);
  c.rect(x + 12, y, 8, 26, [110, 70, 40, 255]);
  c.rect(x + 8, y + 26, 16, 4, [70, 50, 30, 255]);
  [x, y] = at(TILES.treetop);
  c.rect(x + 2, y + 4, 28, 28, [40, 110, 50, 255]);
  c.rect(x + 6, y + 8, 8, 6, [70, 150, 70, 255]);
  [x, y] = at(TILES.flowers);
  c.rect(x + 6, y + 8, 4, 4, [240, 80, 90, 255]);
  c.rect(x + 20, y + 14, 4, 4, [250, 220, 70, 255]);
  c.rect(x + 10, y + 22, 4, 4, [240, 240, 250, 255]);
  [x, y] = at(TILES.tallgrass);
  c.rect(x, y, T, T, [56, 140, 60, 255]);
  for (let i = 2; i < T; i += 6) c.rect(x + i, y + 4, 2, 24, [30, 100, 40, 255]);
  [x, y] = at(TILES.blocker);
  c.rect(x, y, T, T, [255, 0, 0, 110]);
  [x, y] = at(TILES.door);
  c.rect(x, y, T, T, [150, 70, 50, 255]);
  c.rect(x + 6, y + 4, 20, 28, [90, 55, 30, 255]);
  c.rect(x + 21, y + 18, 3, 3, [240, 200, 60, 255]);
  [x, y] = at(TILES.floor);
  c.rect(x, y, T, T, [196, 150, 100, 255]);
  for (let r = 0; r < T; r += 8) c.rect(x, y + r, T, 1, [160, 115, 75, 255]);
  [x, y] = at(TILES.doormat);
  c.rect(x, y, T, T, [196, 150, 100, 255]);
  c.rect(x + 3, y + 6, 26, 20, [170, 40, 50, 255]);
  // The white Audi seen from above, nose to the right, over two tiles (both solid).
  const white: Rgba = [244, 244, 240, 255];
  const glass: Rgba = [70, 90, 120, 255];
  const tyre: Rgba = [30, 30, 34, 255];
  const edge: Rgba = [170, 170, 176, 255];
  [x, y] = at(TILES.carLeft);
  grass(x, y);
  c.rect(x + 6, y + 3, 8, 4, tyre);
  c.rect(x + 6, y + 25, 8, 4, tyre);
  c.rect(x + 2, y + 6, T - 2, 20, edge);
  c.rect(x + 3, y + 7, T - 3, 18, white);
  c.rect(x + 16, y + 9, 10, 14, glass); // rear window
  c.rect(x + 2, y + 9, 2, 4, [200, 40, 40, 255]); // tail lights
  c.rect(x + 2, y + 19, 2, 4, [200, 40, 40, 255]);
  [x, y] = at(TILES.carRight);
  grass(x, y);
  c.rect(x + 16, y + 3, 8, 4, tyre);
  c.rect(x + 16, y + 25, 8, 4, tyre);
  c.rect(x, y + 6, T - 2, 20, edge);
  c.rect(x, y + 7, T - 3, 18, white);
  c.rect(x + 4, y + 9, 12, 14, glass); // windscreen
  c.rect(x, y + 11, 4, 10, white); // roof between the windows
  c.rect(x + 26, y + 9, 2, 4, [250, 240, 160, 255]); // headlights
  c.rect(x + 26, y + 19, 2, 4, [250, 240, 160, 255]);
  return c.toBuffer();
}

/**
 * Draw the player sheet: rows down, left, right, up; columns stand, stride. This is the
 * styled player of `tools/art/characters.ts` (the same file `npm run art` writes).
 */
export function drawPlayer(): Buffer {
  return drawCharacterSheet(PLAYER_LOOK);
}

/** A map layer grid of local tile ids (-1 = empty). */
type Grid = number[];

/** Tiled object (point spawn or warp rectangle), in tiles; written in pixels. */
interface ObjSpec {
  name: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  point?: boolean;
  properties?: { name: string; type: 'string' | 'int'; value: string | number }[];
}

/** An encounter rectangle (tiles): `group` is a key of the zone's `encounters` in zones.json. */
function encounterRect(
  name: string,
  rect: { x: number; y: number; width: number; height: number },
  group: string,
  mode: 'tiles' | 'all',
): ObjSpec {
  return {
    name,
    ...rect,
    properties: [
      { name: 'group', type: 'string', value: group },
      { name: 'mode', type: 'string', value: mode },
    ],
  };
}

/**
 * The Audi: its two solid tiles at (x, y) and (x + 1, y) in `deco`, and an `action` warp over them with
 * `car` = the destination (car.json holds the arrival point).
 */
function audi(g: ReturnType<typeof grids>, x: number, y: number, to: 'murcia' | 'valencia'): ObjSpec {
  g.set(g.layers.deco, x, y, TILES.carLeft);
  g.set(g.layers.deco, x + 1, y, TILES.carRight);
  return {
    name: 'audi',
    x,
    y,
    width: 2,
    height: 1,
    properties: [
      { name: 'car', type: 'string', value: to },
      { name: 'trigger', type: 'string', value: 'action' },
    ],
  };
}

/** A step warp rectangle (tiles). `toY`/`toX` left out = keep the player's row/column. */
function warp(
  name: string,
  rect: { x: number; y: number; width: number; height: number },
  to: { map: string; x?: number; y?: number; facing?: string; trigger?: 'step' | 'action' },
): ObjSpec {
  const properties: ObjSpec['properties'] = [{ name: 'toMap', type: 'string', value: to.map }];
  if (to.x !== undefined) properties.push({ name: 'toX', type: 'int', value: to.x });
  if (to.y !== undefined) properties.push({ name: 'toY', type: 'int', value: to.y });
  if (to.facing) properties.push({ name: 'toFacing', type: 'string', value: to.facing });
  properties.push({ name: 'trigger', type: 'string', value: to.trigger ?? 'step' });
  return { name, ...rect, properties };
}

/** Assemble a Tiled JSON map from layer grids and objects. */
function tiledMap(
  w: number,
  h: number,
  layers: { ground: Grid; deco: Grid; above: Grid; collision: Grid },
  objects: { warps: ObjSpec[]; spawns: ObjSpec[]; encounters?: ObjSpec[] },
): object {
  const csv = (layer: Grid) => layer.map((id) => (id < 0 ? 0 : id + 1));
  let nextId = 1;
  let nextObj = 1;
  const tileLayer = (name: string, data: Grid, visible = true) => ({
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
  // Tiled order is bottom to top; the content guide lists them top to bottom.
  const all = [
    tileLayer('ground', layers.ground),
    tileLayer('deco', layers.deco),
    tileLayer('collision', layers.collision, false),
    tileLayer('above', layers.above),
    objectLayer('warps', objects.warps),
    objectLayer('encounters', objects.encounters ?? []),
    objectLayer('spawns', objects.spawns),
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
    layers: all,
    tilesets: [
      {
        firstgid: 1,
        name: 'test',
        image: '../../assets/tilesets/test.png',
        imagewidth: 8 * T,
        imageheight: 2 * T,
        tilewidth: T,
        tileheight: T,
        tilecount: 16,
        columns: 8,
        margin: 0,
        spacing: 0,
        tiles: Object.entries(TILE_PROPS).map(([id, properties]) => ({ id: Number(id), properties })),
      },
    ],
  };
}

/** Empty layer grids for a w × h map, plus a setter. */
function grids(w: number, h: number, groundFill: number) {
  const grid = (fill: number) => new Array<number>(w * h).fill(fill);
  const layers = { ground: grid(groundFill), deco: grid(-1), above: grid(-1), collision: grid(-1) };
  const set = (layer: Grid, x: number, y: number, id: number) => {
    layer[y * w + x] = id;
  };
  return { layers, set };
}

/** Trees: the trunk is not solid itself; the hidden collision layer blocks it. The top is drawn above. */
function tree(g: ReturnType<typeof grids>, x: number, y: number): void {
  g.set(g.layers.deco, x, y, TILES.trunk);
  g.set(g.layers.collision, x, y, TILES.blocker);
  g.set(g.layers.above, x, y - 1, TILES.treetop);
}

/** `test`: the outdoor test map (30 × 20). Layout: public/maps/README.md. */
export function buildTestMap(): object {
  const g = grids(30, 20, TILES.grass);
  const { ground, deco } = g.layers;
  for (let x = 0; x < 30; x += 1) g.set(ground, x, 10, TILES.path);
  for (let y = 0; y < 20; y += 1) g.set(ground, 15, y, TILES.path);
  // Building (solid walls) with a door, and a short wall west of the spawn.
  for (let y = 3; y <= 6; y += 1) for (let x = 4; x <= 9; x += 1) g.set(deco, x, y, TILES.wall);
  g.set(deco, 6, 6, TILES.door);
  for (let y = 7; y <= 9; y += 1) g.set(ground, 6, y, TILES.path);
  for (let y = 8; y <= 12; y += 1) g.set(deco, 11, y, TILES.wall);
  // Pond (solid water in the ground layer).
  for (let y = 13; y <= 16; y += 1) for (let x = 20; x <= 24; x += 1) g.set(ground, x, y, TILES.water);
  for (const [x, y] of [
    [18, 6],
    [25, 5],
    [7, 14],
    [3, 17],
  ] as const)
    tree(g, x, y);
  for (const [x, y] of [
    [13, 7],
    [17, 13],
    [26, 2],
    [2, 8],
    [9, 18],
  ] as const)
    g.set(deco, x, y, TILES.flowers);
  // Tall grass: encounter tiles inside the `jardin_turia` rectangle (x 19–23, y 1–5), which
  // also covers plain grass (column 19, row 1) so the `tiles` mode can be seen to need the grass.
  for (let y = 2; y <= 5; y += 1) for (let x = 20; x <= 23; x += 1) g.set(ground, x, y, TILES.tallgrass);
  // The office Audi on (8–9, 11), just below the path; car.json › toValencia lands on (8, 12) below it.
  const car = audi(g, 8, 11, 'murcia');
  return tiledMap(30, 20, g.layers, {
    encounters: [
      encounterRect('jardin', { x: 19, y: 1, width: 5, height: 5 }, 'jardin_turia', 'tiles'),
      // An urban-crowd rectangle: every tile inside rolls, whatever it looks like.
      encounterRect('plaza', { x: 1, y: 13, width: 4, height: 4 }, 'plaza_ayuntamiento', 'all'),
    ],
    warps: [
      warp(
        'house_door',
        { x: 6, y: 6, width: 1, height: 1 },
        { map: 'test_house', x: 4, y: 7, facing: 'up' },
      ),
      // Off-map column just past the east edge: walking off the edge keeps the row.
      warp('east_edge', { x: 30, y: 0, width: 1, height: 20 }, { map: 'test_east', x: 0 }),
      car,
    ],
    spawns: [{ name: 'default', x: 15, y: 10, point: true }],
  });
}

/** `test_house`: a 10 × 8 interior, smaller than the screen (centred, black around it). */
export function buildTestHouse(): object {
  const g = grids(10, 8, TILES.floor);
  const { deco } = g.layers;
  for (let x = 0; x < 10; x += 1) {
    g.set(deco, x, 0, TILES.wall);
    g.set(deco, x, 1, TILES.wall);
  }
  for (let y = 2; y < 8; y += 1) {
    g.set(deco, 0, y, TILES.wall);
    g.set(deco, 9, y, TILES.wall);
  }
  g.set(deco, 2, 3, TILES.wall); // a cupboard
  g.set(deco, 3, 3, TILES.wall);
  g.set(g.layers.ground, 4, 7, TILES.doormat);
  return tiledMap(10, 8, g.layers, {
    warps: [
      // Off-map tile below the doormat: leaving puts the player outside the door, facing down.
      warp('exit', { x: 4, y: 8, width: 1, height: 1 }, { map: 'test', x: 6, y: 7, facing: 'down' }),
    ],
    spawns: [{ name: 'default', x: 4, y: 7, point: true }],
  });
}

/** `test_east`: the map east of `test` (30 × 20), joined by the west edge. */
export function buildTestEast(): object {
  const g = grids(30, 20, TILES.grass);
  const { ground, deco } = g.layers;
  for (let x = 0; x < 30; x += 1) g.set(ground, x, 10, TILES.path);
  for (let y = 4; y <= 15; y += 1) g.set(deco, 20, y, TILES.wall);
  for (let y = 2; y <= 5; y += 1) for (let x = 8; x <= 11; x += 1) g.set(ground, x, y, TILES.water);
  for (const [x, y] of [
    [5, 15],
    [14, 6],
    [26, 13],
  ] as const)
    tree(g, x, y);
  // The "Murcia" Audi on (2–3, 9), just above the path; car.json › toMurcia lands on (2, 10) below it.
  const car = audi(g, 2, 9, 'valencia');
  return tiledMap(30, 20, g.layers, {
    warps: [warp('west_edge', { x: -1, y: 0, width: 1, height: 20 }, { map: 'test', x: 29 }), car],
    spawns: [{ name: 'default', x: 2, y: 10, point: true }],
  });
}

/** Write `data` to `public/<rel>` unless it exists (or `force`). Returns true if written. */
function write(rel: string, data: Buffer | string, force: boolean): boolean {
  const path = join(PUBLIC_DIR, rel);
  if (existsSync(path) && !force) return false;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
  return true;
}

const mapJson = (map: object) => `${JSON.stringify(map, null, 1)}\n`;

/** Run the tool; returns the files written (relative to `public/`). */
export function makeTestMap(force: boolean): string[] {
  const files: [string, () => Buffer | string][] = [
    ['assets/tilesets/test.png', drawTileset],
    ['assets/sprites/player.png', drawPlayer],
    ['maps/test/test.tmj', () => mapJson(buildTestMap())],
    ['maps/test/test_house.tmj', () => mapJson(buildTestHouse())],
    ['maps/test/test_east.tmj', () => mapJson(buildTestEast())],
  ];
  return files.filter(([rel, make]) => write(rel, make(), force)).map(([rel]) => rel);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const written = makeTestMap(process.argv.includes('--force'));
  process.stdout.write(
    written.length ? `Wrote:\n  ${written.join('\n  ')}\n` : 'Nothing to write (use --force).\n',
  );
}
