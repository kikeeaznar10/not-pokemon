/**
 * `npm run test-map` — writes the M3 test map and the art it needs, since no human can draw it in Tiled
 * in a cloud session:
 * - `public/assets/tilesets/test.png`: placeholder tileset (8 × 2 tiles of 32 px; see {@link TILES}).
 * - `public/maps/test.tmj`: 30 × 20 Tiled JSON map (CSV layers, embedded tileset) with the layers
 *   `ground`, `deco`, `above`, `collision` and the object layers `warps`, `encounters`, `spawns`.
 * - `public/assets/sprites/player.png`: placeholder player sheet, 2 columns (stand, stride) × 4 rows
 *   (down, left, right, up) of 32 × 32 frames.
 *
 * Like the placeholder tool it NEVER overwrites an existing file (hand-edited maps are safe); pass
 * `--force` to regenerate everything. The output opens in Tiled for further editing.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

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
} as const;

/** Tile properties written into the embedded tileset. */
const TILE_PROPS: Record<number, { name: string; type: 'bool'; value: boolean }[]> = {
  [TILES.wall]: [{ name: 'solid', type: 'bool', value: true }],
  [TILES.water]: [{ name: 'solid', type: 'bool', value: true }],
  [TILES.blocker]: [{ name: 'solid', type: 'bool', value: true }],
  [TILES.tallgrass]: [{ name: 'encounter', type: 'bool', value: true }],
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
  return c.toBuffer();
}

/** Draw the player sheet: rows down, left, right, up; columns stand, stride. */
export function drawPlayer(): Buffer {
  const c = new Canvas(2 * T, 4 * T);
  const dirs = ['down', 'left', 'right', 'up'] as const;
  dirs.forEach((dir, row) => {
    for (let col = 0; col < 2; col += 1) {
      const x = col * T;
      const y = row * T;
      c.rect(x + 9, y + 4, 14, 12, [250, 210, 170, 255]); // head
      c.rect(x + 9, y + 3, 14, 4, [60, 40, 30, 255]); // hair
      c.rect(x + 8, y + 16, 16, 9, [40, 90, 200, 255]); // shirt
      // legs: stride frame moves them apart
      const spread = col === 1 ? 3 : 0;
      c.rect(x + 10 - spread, y + 25, 4, 6, [50, 50, 70, 255]);
      c.rect(x + 18 + spread, y + 25, 4, 6, [50, 50, 70, 255]);
      const eye: Rgba = [20, 20, 20, 255];
      if (dir === 'down') {
        c.rect(x + 12, y + 9, 2, 3, eye);
        c.rect(x + 18, y + 9, 2, 3, eye);
      } else if (dir === 'left') c.rect(x + 10, y + 9, 2, 3, eye);
      else if (dir === 'right') c.rect(x + 20, y + 9, 2, 3, eye);
      else c.rect(x + 9, y + 3, 14, 10, [60, 40, 30, 255]); // up: back of the head
    }
  });
  return c.toBuffer();
}

const W = 30;
const H = 20;

/** Build the test map layers (local tile ids, -1 = empty). Geometry is documented in public/maps/README.md. */
export function buildTestMap(): object {
  const grid = (fill: number) => new Array<number>(W * H).fill(fill);
  const ground = grid(TILES.grass);
  const deco = grid(-1);
  const above = grid(-1);
  const collision = grid(-1);
  const set = (layer: number[], x: number, y: number, id: number) => {
    layer[y * W + x] = id;
  };

  for (let x = 0; x < W; x += 1) set(ground, x, 10, TILES.path);
  for (let y = 0; y < H; y += 1) set(ground, 15, y, TILES.path);
  // Building (solid walls) and a short wall west of the spawn.
  for (let y = 3; y <= 6; y += 1) for (let x = 4; x <= 9; x += 1) set(deco, x, y, TILES.wall);
  for (let y = 8; y <= 12; y += 1) set(deco, 11, y, TILES.wall);
  // Pond (solid water in the ground layer).
  for (let y = 13; y <= 16; y += 1) for (let x = 20; x <= 24; x += 1) set(ground, x, y, TILES.water);
  // Trees: the trunk is not solid itself; the hidden collision layer blocks it. The top is drawn above.
  for (const [x, y] of [
    [18, 6],
    [25, 5],
    [7, 14],
    [3, 17],
  ] as const) {
    set(deco, x, y, TILES.trunk);
    set(collision, x, y, TILES.blocker);
    set(above, x, y - 1, TILES.treetop);
  }
  for (const [x, y] of [
    [13, 7],
    [17, 13],
    [26, 2],
    [2, 8],
    [9, 18],
  ] as const)
    set(deco, x, y, TILES.flowers);

  const csv = (layer: number[]) => layer.map((id) => (id < 0 ? 0 : id + 1));
  let nextId = 1;
  const tileLayer = (name: string, data: number[], visible = true) => ({
    id: nextId++,
    name,
    type: 'tilelayer',
    x: 0,
    y: 0,
    width: W,
    height: H,
    opacity: 1,
    visible,
    data: csv(data),
  });
  const objectLayer = (name: string, objects: object[]) => ({
    id: nextId++,
    name,
    type: 'objectgroup',
    draworder: 'topdown',
    x: 0,
    y: 0,
    opacity: 1,
    visible: true,
    objects,
  });
  // Tiled order is bottom to top; the content guide lists them top to bottom.
  const layers = [
    tileLayer('ground', ground),
    tileLayer('deco', deco),
    tileLayer('collision', collision, false),
    tileLayer('above', above),
    objectLayer('warps', []),
    objectLayer('encounters', []),
    objectLayer('spawns', [
      {
        id: 1,
        name: 'default',
        type: '',
        x: 15 * T,
        y: 10 * T,
        width: 0,
        height: 0,
        rotation: 0,
        visible: true,
        point: true,
      },
    ]),
  ];

  return {
    compressionlevel: -1,
    type: 'map',
    version: '1.10',
    tiledversion: '1.11.0',
    orientation: 'orthogonal',
    renderorder: 'right-down',
    infinite: false,
    width: W,
    height: H,
    tilewidth: T,
    tileheight: T,
    nextlayerid: nextId,
    nextobjectid: 2,
    layers,
    tilesets: [
      {
        firstgid: 1,
        name: 'test',
        image: '../assets/tilesets/test.png',
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

/** Write `data` to `public/<rel>` unless it exists (or `force`). Returns true if written. */
function write(rel: string, data: Buffer | string, force: boolean): boolean {
  const path = join(PUBLIC_DIR, rel);
  if (existsSync(path) && !force) return false;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
  return true;
}

/** Run the tool; returns the files written (relative to `public/`). */
export function makeTestMap(force: boolean): string[] {
  const files: [string, () => Buffer | string][] = [
    ['assets/tilesets/test.png', drawTileset],
    ['assets/sprites/player.png', drawPlayer],
    ['maps/test.tmj', () => `${JSON.stringify(buildTestMap(), null, 1)}\n`],
  ];
  return files.filter(([rel, make]) => write(rel, make(), force)).map(([rel]) => rel);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const written = makeTestMap(process.argv.includes('--force'));
  process.stdout.write(
    written.length ? `Wrote:\n  ${written.join('\n  ')}\n` : 'Nothing to write (use --force).\n',
  );
}
