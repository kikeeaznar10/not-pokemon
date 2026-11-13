/**
 * `npm run buildings` — lists the buildings of the outdoor maps and writes, for each one, a reference picture of how
 * it looks today, so an artist (or an image generator) can paint a replacement skin ({@link findBuildings}).
 *
 * - Buildings are found in the layouts `tools/world/<zone>.txt`: connected groups of wall, roof and façade characters
 *   ({@link BUILDING_CHARS}), plus the doors touching them. Interiors are skipped.
 * - Output: a table (zone, rectangle in tiles, image size in pixels) and `tools/buildings/<zone>_<x>_<y>.png`, the
 *   building as the map draws it now (tile size 32 px, so `width × 32` by `height × 32`).
 * - To use a skin: save the painted PNG as `public/assets/buildings/<id>.png` at exactly that size and add
 *   `{ "id", "image", "x", "y", "width", "height" }` to the zone's `buildings` in `public/data/zones.json`
 *   (docs/MAPS.md › Building skins).
 *
 * Nothing in `public/` is touched. Pass a zone id to list only that zone.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { readLayout, readWorld } from './make-world';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TILE = 32;
const COLS = 8;

/**
 * Layout characters that make up a building, by material family: houses (roof, walls), flat city roofs, industrial
 * sheds, the company's façade, the station façade. A building is a group of one family, so neighbouring buildings of
 * different materials stay apart. Doors (`D`) join a building they touch.
 */
export const BUILDING_FAMILIES = ['^#Why', '8', '9IiZ', 'BVQUGZ', '5'].map((f) => new Set([...f]));

/** A building's rectangle on its map, in tiles. */
export interface BuildingRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Find the buildings of a layout (pure): 4-connected groups of one of the {@link BUILDING_FAMILIES} of at least 4 tiles, grown by the
 * `D` doors that touch them, as bounding rectangles sorted top to bottom, left to right. Touching buildings merge.
 */
export function findBuildings(rows: readonly string[]): BuildingRect[] {
  const found: BuildingRect[] = [];
  for (const family of BUILDING_FAMILIES) found.push(...findFamily(rows, family));
  return found.sort((a, b) => a.y - b.y || a.x - b.x);
}

/** The groups of one material family (see {@link findBuildings}). */
function findFamily(rows: readonly string[], chars: ReadonlySet<string>): BuildingRect[] {
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  const seen = new Set<number>();
  const found: BuildingRect[] = [];
  for (let y0 = 0; y0 < h; y0++) {
    for (let x0 = 0; x0 < w; x0++) {
      if (seen.has(y0 * w + x0) || !chars.has(rows[y0]![x0]!)) continue;
      const stack: [number, number][] = [[x0, y0]];
      seen.add(y0 * w + x0);
      let [minX, minY, maxX, maxY, count] = [x0, y0, x0, y0, 0];
      while (stack.length > 0) {
        const [x, y] = stack.pop()!;
        count++;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ch = rows[ny]![nx]!;
          if (ch === 'D') {
            [minX, minY, maxX, maxY] = [
              Math.min(minX, nx),
              Math.min(minY, ny),
              Math.max(maxX, nx),
              Math.max(maxY, ny),
            ];
          } else if (chars.has(ch) && !seen.has(ny * w + nx)) {
            seen.add(ny * w + nx);
            [minX, minY, maxX, maxY] = [
              Math.min(minX, nx),
              Math.min(minY, ny),
              Math.max(maxX, nx),
              Math.max(maxY, ny),
            ];
            stack.push([nx, ny]);
          }
        }
      }
      if (count >= 4) found.push({ x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 });
    }
  }
  return found;
}

/** Render `rect` of `zone` as the map draws it now (ground, deco, above), as PNG bytes. */
function renderRect(zone: string, rect: BuildingRect, tileset: PNG): Buffer {
  const map = JSON.parse(readFileSync(join(ROOT, 'public', 'maps', `${zone}.tmj`), 'utf8')) as {
    width: number;
    layers: { name: string; data?: number[] }[];
  };
  const out = new PNG({ width: rect.width * TILE, height: rect.height * TILE });
  for (const name of ['ground', 'deco', 'above']) {
    const data = map.layers.find((l) => l.name === name)?.data;
    if (!data) continue;
    for (let ty = 0; ty < rect.height; ty++) {
      for (let tx = 0; tx < rect.width; tx++) {
        const gid = data[(rect.y + ty) * map.width + rect.x + tx]!;
        if (gid <= 0) continue;
        const id = gid - 1;
        const [sx, sy] = [(id % COLS) * TILE, Math.floor(id / COLS) * TILE];
        for (let py = 0; py < TILE; py++) {
          for (let px = 0; px < TILE; px++) {
            const s = ((sy + py) * tileset.width + sx + px) * 4;
            const alpha = tileset.data[s + 3]! / 255;
            if (alpha === 0) continue;
            const d = ((ty * TILE + py) * out.width + tx * TILE + px) * 4;
            for (let c = 0; c < 3; c++)
              out.data[d + c] = tileset.data[s + c]! * alpha + out.data[d + c]! * (1 - alpha);
            out.data[d + 3] = 255;
          }
        }
      }
    }
  }
  return PNG.sync.write(out);
}

/** Entry point: print the table and write the reference pictures. */
export function listBuildings(only?: string): string[] {
  const world = readWorld();
  const tileset = PNG.sync.read(readFileSync(join(ROOT, 'public', 'assets', 'tilesets', 'world.png')));
  const outDir = join(ROOT, 'tools', 'buildings');
  mkdirSync(outDir, { recursive: true });
  const lines: string[] = [];
  for (const [zone, spec] of Object.entries(world.maps)) {
    if (spec.indoor || (only && zone !== only)) continue;
    for (const r of findBuildings(readLayout(zone))) {
      const file = `${zone}_${r.x}_${r.y}.png`;
      writeFileSync(join(outDir, file), renderRect(zone, r, tileset));
      lines.push(
        `${zone.padEnd(12)} x=${r.x} y=${r.y} ${r.width}×${r.height} tiles  → ${r.width * TILE}×${r.height * TILE} px  tools/buildings/${file}`,
      );
    }
  }
  return lines;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const lines = listBuildings(process.argv[2]);
  console.log(lines.join('\n')); // eslint-disable-line no-console -- command-line tool output
  console.log(`\n${lines.length} buildings. Reference pictures in tools/buildings/.`); // eslint-disable-line no-console
}
