/**
 * `npm run atlas` (M15) — packs the content's small sprites into one texture atlas, so a phone on 4G downloads one
 * image instead of ~70 (plan M15 task 3: "texture atlas for sprites if load time exceeds 3 seconds on 4G").
 *
 * - Input: every PNG path under `assets/sprites/` named in the content JSON (`public/data/` and the test world,
 *   `readAssetPaths`) whose image is at most {@link MAX_SPRITE_SIZE} pixels on each side. Bigger images (e.g. a
 *   64 × 128 NPC walk sheet would still fit; a tileset, the title or a minimap are not under `sprites/`) load as
 *   files. Missing files are skipped (run `npm run placeholders` first).
 * - Output (always rewritten; a build artifact, ignored by git): `public/assets/atlas/sprites.png` and
 *   `sprites.json` in Phaser's "JSON hash" format. Each frame is named by its asset path
 *   (`assets/sprites/items/cafe.png`), with {@link PADDING} transparent pixels around it.
 * - `npm run build` runs it first, so a production build always has an atlas that matches the files. Without an
 *   atlas (`npm run dev` before any build) the game loads every sprite as its own file.
 * - The Preload scene copies every frame into its own texture under the frame's name, so the game uses the same
 *   texture keys either way (`src/data/atlas.ts`).
 *
 * Flags: `--dry-run` prints what would be packed without writing.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { readAssetPaths } from './make-placeholders';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = join(ROOT, 'public');

/** Folder (relative to `public/`) of the generated atlas. */
export const ATLAS_DIR = 'assets/atlas';
/** Largest width or height (px) of a sprite that goes into the atlas. */
export const MAX_SPRITE_SIZE = 128;
/** Transparent pixels around every frame. */
export const PADDING = 1;
/** Width (px) of the atlas image. */
export const ATLAS_WIDTH = 1024;

/** One packed sprite: its asset path and place in the atlas. */
export interface PackedFrame {
  path: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Shelf packing: tallest first, left to right in rows of `width` pixels, `padding` around each image. Pure, so it
 * can be unit-tested. Returns the frames and the atlas height (a whole number of pixels).
 */
export function packShelves(
  sizes: readonly { path: string; w: number; h: number }[],
  width: number = ATLAS_WIDTH,
  padding: number = PADDING,
): { frames: PackedFrame[]; height: number } {
  const sorted = [...sizes].sort((a, b) => b.h - a.h || b.w - a.w || a.path.localeCompare(b.path));
  const frames: PackedFrame[] = [];
  let x = 0;
  let y = 0;
  let rowH = 0;
  for (const s of sorted) {
    const cellW = s.w + 2 * padding;
    const cellH = s.h + 2 * padding;
    if (cellW > width) throw new Error(`${s.path} is wider than the atlas (${s.w} px)`);
    if (x + cellW > width) {
      y += rowH;
      x = 0;
      rowH = 0;
    }
    frames.push({ path: s.path, x: x + padding, y: y + padding, w: s.w, h: s.h });
    x += cellW;
    rowH = Math.max(rowH, cellH);
  }
  return { frames, height: y + rowH };
}

/** The atlas description in Phaser's JSON hash format (frame name = asset path). */
export function atlasJson(frames: readonly PackedFrame[], width: number, height: number): object {
  return {
    frames: Object.fromEntries(
      frames.map((f) => [
        f.path,
        {
          frame: { x: f.x, y: f.y, w: f.w, h: f.h },
          rotated: false,
          trimmed: false,
          spriteSourceSize: { x: 0, y: 0, w: f.w, h: f.h },
          sourceSize: { w: f.w, h: f.h },
        },
      ]),
    ),
    meta: {
      app: 'flexymon make-atlas',
      image: 'sprites.png',
      format: 'RGBA8888',
      size: { w: width, h: height },
      scale: '1',
    },
  };
}

function main(): void {
  const dryRun = process.argv.includes('--dry-run');
  const images = new Map<string, PNG>();
  for (const path of readAssetPaths()) {
    if (!path.startsWith('assets/sprites/') || !path.endsWith('.png')) continue;
    const file = join(PUBLIC_DIR, path);
    if (!existsSync(file)) {
      process.stderr.write(`skipped (missing): ${path}\n`);
      continue;
    }
    const png = PNG.sync.read(readFileSync(file));
    if (png.width > MAX_SPRITE_SIZE || png.height > MAX_SPRITE_SIZE) continue;
    images.set(path, png);
  }
  const { frames, height } = packShelves([...images].map(([path, p]) => ({ path, w: p.width, h: p.height })));
  const out = new PNG({ width: ATLAS_WIDTH, height: Math.max(1, height) });
  for (const f of frames) PNG.bitblt(images.get(f.path)!, out, 0, 0, f.w, f.h, f.x, f.y);
  process.stdout.write(
    `${frames.length} sprite(s) in a ${ATLAS_WIDTH} × ${height} atlas (${ATLAS_DIR}/sprites.png)\n`,
  );
  if (dryRun) return;
  const dir = join(PUBLIC_DIR, ATLAS_DIR);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'sprites.png'), PNG.sync.write(out));
  writeFileSync(join(dir, 'sprites.json'), `${JSON.stringify(atlasJson(frames, ATLAS_WIDTH, height))}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
