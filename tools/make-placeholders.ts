/**
 * `npm run placeholders` — generates placeholder art and sound for every asset path referenced by
 * the content JSON in `public/data/`. It NEVER overwrites an existing file, so running it twice
 * creates nothing the second time, and real assets dropped at the same paths are left alone.
 *
 * Rules:
 * - Any JSON string value of the form `assets/….png|ogg|mp3` is an asset path (relative to `public/`).
 * - PNG: a solid colour square (colour derived from the file name) with the name written on it
 *   in a tiny pixel font. Size: `*_front` / `*_back` 64×64, `*_icon` and `sprites/items/` 16×16,
 *   anything else 32×32. `assets/ui/title.png` (M11) is a 512×288 pixel office scene instead (sky, a building
 *   with windows and a door, a path), so the title screen has something to show until real art exists.
 *   Anything in `sprites/car/` (M13, `car.json › sprite`) is a 96×40 white car seen from the side, nose right.
 * - Audio: an `.ogg` or `.mp3` path produces BOTH `<name>.ogg` and `<name>.mp3` (0.2 s beep made with
 *   `ffmpeg` if it is on the PATH; otherwise a copy of the silent files in `tools/fallback/`). A name containing
 *   `engine` (M13, the car) gets a 1 s low 90 Hz hum instead, so it can loop during the trip.
 * - Minimaps (M12): every outdoor zone in `zones.json` (`indoor: false`) gets `assets/ui/minimap_<zone>.png`, a
 *   scaled-down render of its map's collision data (`MINIMAP_TILE_PX` pixels per tile: solid dark, encounter
 *   tiles green, the rest sand). Like everything else it is never overwritten: after editing a map, delete its
 *   minimap and run the tool again.
 *
 * Flags: `--dry-run` lists what would be created without writing anything.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { parseTiledMap } from '../src/data/tiled';
import { MINIMAP_TILE_PX } from '../src/logic/constants';
import { minimapCells, minimapPath, type MinimapCell } from '../src/logic/minimap';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = join(ROOT, 'public');
const DATA_DIR = join(PUBLIC_DIR, 'data');
const FALLBACK_DIR = join(ROOT, 'tools', 'fallback');

const ASSET_PATH = /^assets\/.+\.(png|ogg|mp3)$/i;
const AUDIO_EXTS = ['.ogg', '.mp3'] as const;

/** 3×5 pixel font: each glyph is 5 rows of 3 bits (MSB = left column). */
const FONT: Record<string, number[]> = {
  A: [2, 5, 7, 5, 5],
  B: [6, 5, 6, 5, 6],
  C: [3, 4, 4, 4, 3],
  D: [6, 5, 5, 5, 6],
  E: [7, 4, 6, 4, 7],
  F: [7, 4, 6, 4, 4],
  G: [3, 4, 5, 5, 3],
  H: [5, 5, 7, 5, 5],
  I: [7, 2, 2, 2, 7],
  J: [1, 1, 1, 5, 2],
  K: [5, 5, 6, 5, 5],
  L: [4, 4, 4, 4, 7],
  M: [5, 7, 7, 5, 5],
  N: [6, 5, 5, 5, 5],
  O: [2, 5, 5, 5, 2],
  P: [6, 5, 6, 4, 4],
  Q: [2, 5, 5, 6, 3],
  R: [6, 5, 6, 5, 5],
  S: [3, 4, 2, 1, 6],
  T: [7, 2, 2, 2, 2],
  U: [5, 5, 5, 5, 7],
  V: [5, 5, 5, 5, 2],
  W: [5, 5, 7, 7, 5],
  X: [5, 5, 2, 5, 5],
  Y: [5, 5, 2, 2, 2],
  Z: [7, 1, 2, 4, 7],
  '0': [7, 5, 5, 5, 7],
  '1': [2, 6, 2, 2, 7],
  '2': [6, 1, 2, 4, 7],
  '3': [6, 1, 2, 1, 6],
  '4': [5, 5, 7, 1, 1],
  '5': [7, 4, 6, 1, 6],
  '6': [3, 4, 7, 5, 7],
  '7': [7, 1, 2, 2, 2],
  '8': [7, 5, 7, 5, 7],
  '9': [7, 5, 7, 1, 6],
  _: [0, 0, 0, 0, 7],
  '-': [0, 0, 7, 0, 0],
  ' ': [0, 0, 0, 0, 0],
};

/** Collect every asset path string found anywhere inside a parsed JSON value. */
export function collectAssetPaths(value: unknown, out: Set<string> = new Set()): Set<string> {
  if (typeof value === 'string') {
    if (ASSET_PATH.test(value)) out.add(value);
  } else if (Array.isArray(value)) {
    for (const v of value) collectAssetPaths(v, out);
  } else if (value !== null && typeof value === 'object') {
    for (const v of Object.values(value)) collectAssetPaths(v, out);
  }
  return out;
}

/** Placeholder size in pixels for a PNG asset path (see file header for the rules). */
export function pngSize(assetPath: string): number {
  const name = basename(assetPath, extname(assetPath));
  if (/_(front|back)$/.test(name)) return 64;
  if (/_icon$/.test(name) || assetPath.includes('sprites/items/')) return 16;
  return 32;
}

/** Placeholder size of a car sprite (M13, any PNG under `sprites/car/`): the side view drawn by {@link makeCarPng}. */
export const CAR_SIZE = { width: 96, height: 40 } as const;

/** True for an asset path that gets the side-view car placeholder (M13). */
export function isCarSprite(assetPath: string): boolean {
  return assetPath.includes('sprites/car/');
}

/**
 * Build the car placeholder (M13): a white hatchback seen from the side, nose to the right, with dark windows,
 * two wheels, a headlight and a tail light, on a transparent background. Real art replaces the file.
 */
export function makeCarPng(width: number = CAR_SIZE.width, height: number = CAR_SIZE.height): Buffer {
  const png = new PNG({ width, height });
  const rect = (x0: number, y0: number, w: number, h: number, rgb: [number, number, number]): void => {
    for (let y = Math.max(0, y0); y < Math.min(height, y0 + h); y++)
      for (let x = Math.max(0, x0); x < Math.min(width, x0 + w); x++) {
        const i = (y * width + x) * 4;
        png.data[i] = rgb[0];
        png.data[i + 1] = rgb[1];
        png.data[i + 2] = rgb[2];
        png.data[i + 3] = 255;
      }
  };
  const white: [number, number, number] = [244, 244, 240];
  const shade: [number, number, number] = [176, 178, 186];
  const glass: [number, number, number] = [60, 80, 110];
  // Body (lower), cabin (upper, set back from the nose), outline shade under the body.
  rect(4, 18, width - 8, 12, white);
  rect(4, 28, width - 8, 3, shade);
  rect(22, 6, 48, 13, white);
  rect(26, 9, 18, 9, glass); // rear window
  rect(48, 9, 18, 9, glass); // front window
  rect(44, 9, 4, 10, white); // pillar
  rect(width - 8, 20, 4, 4, [250, 236, 150]); // headlight
  rect(4, 20, 3, 4, [210, 40, 40]); // tail light
  rect(40, 22, 8, 1, shade); // door line
  // Wheels: dark tyres with grey hubs.
  for (const cx of [22, width - 24]) {
    rect(cx - 7, 26, 14, 14, [28, 28, 32]);
    rect(cx - 3, 30, 6, 6, [150, 150, 158]);
  }
  return PNG.sync.write(png);
}

/** Path of the title image (M11, `intro.json › titleImage`); it gets {@link makeTitlePng} instead of a square. */
export const TITLE_IMAGE = 'assets/ui/title.png';

/** Title placeholder size: the whole 512 × 288 screen. */
export const TITLE_SIZE = { width: 512, height: 288 } as const;

/**
 * Build the title placeholder: a simple pixel-art office front (sky, hills, a building with a sign strip,
 * windows and a door, a path, grass). Real art replaces the file at the same path.
 */
export function makeTitlePng(width: number = TITLE_SIZE.width, height: number = TITLE_SIZE.height): Buffer {
  const png = new PNG({ width, height });
  const rect = (x0: number, y0: number, w: number, h: number, rgb: [number, number, number]): void => {
    for (let y = Math.max(0, y0); y < Math.min(height, y0 + h); y++)
      for (let x = Math.max(0, x0); x < Math.min(width, x0 + w); x++) {
        const i = (y * width + x) * 4;
        png.data[i] = rgb[0];
        png.data[i + 1] = rgb[1];
        png.data[i + 2] = rgb[2];
        png.data[i + 3] = 255;
      }
  };
  const ground = Math.round(height * 0.72);
  // Sky in four bands, then grass.
  const sky: [number, number, number][] = [
    [96, 152, 232],
    [120, 172, 240],
    [148, 192, 244],
    [176, 212, 248],
  ];
  sky.forEach((c, i) => rect(0, Math.floor((ground * i) / 4), width, Math.ceil(ground / 4) + 1, c));
  rect(0, ground, width, height - ground, [88, 168, 72]);
  for (let x = 0; x < width; x += 16) rect(x + ((x / 16) % 2) * 8, ground + 6, 4, 2, [64, 136, 56]);
  // Building.
  const bw = Math.round(width * 0.5);
  const bh = Math.round(height * 0.42);
  const bx = Math.round((width - bw) / 2);
  const by = ground - bh;
  rect(bx - 4, by - 4, bw + 8, bh + 4, [64, 64, 80]);
  rect(bx, by, bw, bh, [232, 228, 216]);
  rect(bx, by, bw, 18, [216, 72, 56]); // sign strip
  const cols = 6;
  const winW = 24;
  const gap = Math.floor((bw - cols * winW) / (cols + 1));
  for (let row = 0; row < 2; row++)
    for (let c = 0; c < cols; c++) {
      const wx = bx + gap + c * (winW + gap);
      const wy = by + 28 + row * 30;
      if (row === 1 && (c === 2 || c === 3)) continue; // door below
      rect(wx - 2, wy - 2, winW + 4, 20, [64, 64, 80]);
      rect(wx, wy, winW, 16, [168, 208, 240]);
      rect(wx, wy, winW / 2, 6, [208, 232, 248]);
    }
  const dw = 36;
  const dx = Math.round(width / 2 - dw / 2);
  rect(dx - 2, ground - 44, dw + 4, 44, [64, 64, 80]);
  rect(dx, ground - 42, dw, 42, [136, 96, 64]);
  rect(dx + dw - 8, ground - 22, 3, 3, [240, 208, 96]);
  // Path to the door.
  rect(dx - 6, ground, dw + 12, height - ground, [208, 192, 152]);
  return PNG.sync.write(png);
}

/** Minimap colours (M12) per cell kind. */
export const MINIMAP_COLOURS: Readonly<Record<MinimapCell, [number, number, number]>> = {
  solid: [56, 64, 88],
  encounter: [88, 168, 72],
  open: [216, 204, 168],
};

/**
 * Build a minimap placeholder (M12): each of the map's cells as a `tilePx` square in its {@link MINIMAP_COLOURS}
 * colour (cells from `minimapCells`), so the image is `width × tilePx` by `height × tilePx` pixels.
 */
export function makeMinimapPng(
  map: { width: number; height: number; solid: boolean[]; encounter: boolean[] },
  tilePx: number = MINIMAP_TILE_PX,
): Buffer {
  const width = map.width * tilePx;
  const height = map.height * tilePx;
  const png = new PNG({ width, height });
  const cells = minimapCells(map);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const cell = cells[Math.floor(y / tilePx) * map.width + Math.floor(x / tilePx)] ?? 'solid';
      const rgb = MINIMAP_COLOURS[cell];
      const i = (y * width + x) * 4;
      png.data[i] = rgb[0];
      png.data[i + 1] = rgb[1];
      png.data[i + 2] = rgb[2];
      png.data[i + 3] = 255;
    }
  return PNG.sync.write(png);
}

/** A minimap the tool should make (M12): its asset path and the map file it is drawn from (both under `public/`). */
export interface MinimapTarget {
  assetPath: string;
  mapFile: string;
}

/** Read `zones.json` and list the minimap of every outdoor zone (indoor zones have none). */
export function readMinimapTargets(dataDir: string = DATA_DIR): MinimapTarget[] {
  const file = join(dataDir, 'zones.json');
  if (!existsSync(file)) return [];
  const zones = JSON.parse(readFileSync(file, 'utf8')) as { id: string; file: string; indoor: boolean }[];
  return zones.filter((z) => !z.indoor).map((z) => ({ assetPath: minimapPath(z.id), mapFile: z.file }));
}

/** Stable RGB colour derived from a string. */
function colourFor(text: string): [number, number, number] {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = (h % 360) / 60;
  const c = 160;
  const x = Math.round(c * (1 - Math.abs((hue % 2) - 1)));
  const table: [number, number, number][] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ];
  const [r, g, b] = table[Math.floor(hue) % 6] ?? [c, c, c];
  return [r + 60, g + 60, b + 60];
}

/** Greedy word wrap on `_`; words longer than a line are hard-split. */
export function wrapLabel(text: string, perLine: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split('_')) {
    const joined = current ? `${current}_${word}` : word;
    if (joined.length <= perLine) {
      current = joined;
      continue;
    }
    if (current) lines.push(current);
    let rest = word;
    while (rest.length > perLine) {
      lines.push(rest.slice(0, perLine));
      rest = rest.slice(perLine);
    }
    current = rest;
  }
  if (current) lines.push(current);
  return lines;
}

/** Build a placeholder PNG: solid colour, darker 1 px border, name written in the pixel font. */
export function makePng(label: string, size: number): Buffer {
  const png = new PNG({ width: size, height: size });
  const [r, g, b] = colourFor(label);
  const set = (x: number, y: number, rgb: [number, number, number]): void => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    png.data[i] = rgb[0];
    png.data[i + 1] = rgb[1];
    png.data[i + 2] = rgb[2];
    png.data[i + 3] = 255;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const edge = x === 0 || y === 0 || x === size - 1 || y === size - 1;
      set(x, y, edge ? [r >> 1, g >> 1, b >> 1] : [r, g, b]);
    }
  }

  // Text: scale 2 on 64 px images, 1 otherwise; wrap to the width, drop lines that do not fit.
  const scale = size >= 64 ? 2 : 1;
  const charW = 4 * scale;
  const lineH = 6 * scale;
  const perLine = Math.max(1, Math.floor((size - 2) / charW));
  const maxLines = Math.max(1, Math.floor((size - 2) / lineH));
  const lines = wrapLabel(label.toUpperCase(), perLine).slice(0, maxLines);
  const ink: [number, number, number] = r * 0.3 + g * 0.59 + b * 0.11 > 140 ? [0, 0, 0] : [255, 255, 255];
  const top = Math.floor((size - lines.length * lineH + scale) / 2);
  lines.forEach((line, row) => {
    const left = Math.floor((size - line.length * charW + scale) / 2);
    [...line].forEach((ch, col) => {
      const glyph = FONT[ch] ?? FONT['-'] ?? [];
      glyph.forEach((bits, gy) => {
        for (let gx = 0; gx < 3; gx++) {
          if (!(bits & (4 >> gx))) continue;
          for (let sy = 0; sy < scale; sy++)
            for (let sx = 0; sx < scale; sx++)
              set(left + col * charW + gx * scale + sx, top + row * lineH + gy * scale + sy, ink);
        }
      });
    });
  });
  return PNG.sync.write(png);
}

let ffmpegAvailable: boolean | undefined;

/** Write a 0.2 s beep with ffmpeg; on any failure copy the silent fallback. Returns how it was made. */
function writeAudio(file: string, ext: (typeof AUDIO_EXTS)[number]): 'beep' | 'silent' {
  if (ffmpegAvailable === undefined) {
    ffmpegAvailable = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;
  }
  if (ffmpegAvailable) {
    const codec = ext === '.ogg' ? ['-c:a', 'libvorbis'] : ['-c:a', 'libmp3lame', '-b:a', '32k'];
    const res = spawnSync(
      'ffmpeg',
      [
        '-loglevel',
        'error',
        '-n',
        '-f',
        'lavfi',
        '-i',
        /engine/.test(basename(file)) ? 'sine=frequency=90:duration=1' : 'sine=frequency=880:duration=0.2',
        '-ac',
        '1',
        ...codec,
        file,
      ],
      { stdio: 'ignore' },
    );
    if (res.status === 0 && existsSync(file)) return 'beep';
  }
  copyFileSync(join(FALLBACK_DIR, `silent${ext}`), file);
  return 'silent';
}

/** Read every JSON file in `public/data/` and return the sorted, de-duplicated asset paths. */
export function readAssetPaths(dataDir: string = DATA_DIR): string[] {
  const paths = new Set<string>();
  for (const name of readdirSync(dataDir)
    .filter((n) => n.endsWith('.json'))
    .sort()) {
    const json: unknown = JSON.parse(readFileSync(join(dataDir, name), 'utf8'));
    collectAssetPaths(json, paths);
  }
  return [...paths].sort();
}

function main(): void {
  const dryRun = process.argv.includes('--dry-run');
  const created: string[] = [];
  let silent = 0;

  for (const assetPath of readAssetPaths()) {
    const ext = extname(assetPath).toLowerCase();
    if (ext === '.png') {
      const file = join(PUBLIC_DIR, assetPath);
      if (existsSync(file)) continue;
      created.push(assetPath);
      if (dryRun) continue;
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(
        file,
        assetPath === TITLE_IMAGE
          ? makeTitlePng()
          : isCarSprite(assetPath)
            ? makeCarPng()
            : makePng(basename(assetPath, ext), pngSize(assetPath)),
      );
    } else {
      const stem = assetPath.slice(0, -ext.length);
      for (const audioExt of AUDIO_EXTS) {
        const rel = stem + audioExt;
        const file = join(PUBLIC_DIR, rel);
        if (existsSync(file)) continue;
        created.push(rel);
        if (dryRun) continue;
        mkdirSync(dirname(file), { recursive: true });
        if (writeAudio(file, audioExt) === 'silent') silent++;
      }
    }
  }

  // Minimaps (M12): drawn from the maps, not listed in the JSON.
  for (const target of readMinimapTargets()) {
    const file = join(PUBLIC_DIR, target.assetPath);
    if (existsSync(file)) continue;
    created.push(target.assetPath);
    if (dryRun) continue;
    const info = parseTiledMap(
      JSON.parse(readFileSync(join(PUBLIC_DIR, target.mapFile), 'utf8')),
      target.mapFile,
    );
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, makeMinimapPng(info));
  }

  const out = process.stdout;
  for (const rel of created) out.write(`${dryRun ? 'would create' : 'created'} public/${rel}\n`);
  out.write(`${created.length} placeholder file(s) ${dryRun ? 'missing' : 'created'}.\n`);
  if (silent > 0) out.write(`${silent} audio file(s) are silent (ffmpeg not found).\n`);
}

// Run only when executed directly (not when imported by tests).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
