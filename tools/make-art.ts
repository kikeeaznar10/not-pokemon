/**
 * `npm run art` (post-M15 restyle) — draws the game's styled sprites (see `docs/STYLE-REFERENCE.md` and
 * `tools/art/`) at the asset paths the content JSON names, replacing the labelled placeholder squares:
 * - `assets/sprites/player.png` and every `assets/sprites/npcs/<name>.png`: 64 × 128 character sheets
 *   (`tools/art/characters.ts`; a sprite name without a hand-picked look gets one made from its name);
 * - `assets/sprites/flexymon/<id>_front.png` / `_back.png` (64 × 64) and `_icon.png` (16 × 16)
 *   (`tools/art/flexymon.ts`; ids without hand-made art get a generic blob creature);
 * - `assets/sprites/items/<id>.png` (16 × 16), `assets/sprites/car/*.png` (96 × 40) and the title picture
 *   (`intro.json › titleImage`, 512 × 288) (`tools/art/sprites.ts`).
 *
 * Any other PNG path is left alone. Like the other tools it never overwrites an existing file: pass `--force` to
 * redraw everything (after changing the art code), or `--dry-run` to list what would be written.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drawCharacterSheet, lookFor, PLAYER_LOOK } from './art/characters';
import { drawFlexymon, drawFlexymonIcon } from './art/flexymon';
import { drawCar, drawItem, drawTitle } from './art/sprites';
import { readAssetPaths, TITLE_IMAGE } from './make-placeholders';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = join(ROOT, 'public');
/** The player sheet (not named in any content file; see `src/world/player.ts › PLAYER_SPRITE`). */
export const PLAYER_PATH = 'assets/sprites/player.png';

/** The styled art for an asset path, or null if the art tool does not draw that path. */
export function artFor(assetPath: string): Buffer | null {
  const name = basename(assetPath, '.png');
  if (!assetPath.endsWith('.png')) return null;
  if (assetPath === PLAYER_PATH) return drawCharacterSheet(PLAYER_LOOK);
  if (assetPath === TITLE_IMAGE) return drawTitle();
  if (assetPath.startsWith('assets/sprites/npcs/')) return drawCharacterSheet(lookFor(name));
  if (assetPath.startsWith('assets/sprites/items/')) return drawItem(name);
  if (assetPath.startsWith('assets/sprites/car/')) return drawCar();
  if (assetPath.startsWith('assets/sprites/flexymon/')) {
    const m = /^(.*)_(front|back|icon)$/.exec(name);
    if (!m) return null;
    const [, id, kind] = m;
    return kind === 'icon' ? drawFlexymonIcon(id!) : drawFlexymon(id!, kind as 'front' | 'back');
  }
  return null;
}

/** Run the tool; returns the asset paths written (or that would be written with `dryRun`). */
export function makeArt(force: boolean, dryRun = false): string[] {
  const written: string[] = [];
  for (const assetPath of [PLAYER_PATH, ...readAssetPaths()]) {
    const file = join(PUBLIC_DIR, assetPath);
    if (existsSync(file) && !force) continue;
    const png = artFor(assetPath);
    if (!png) continue;
    written.push(assetPath);
    if (dryRun) continue;
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, png);
  }
  return written;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dryRun = process.argv.includes('--dry-run');
  const written = makeArt(process.argv.includes('--force'), dryRun);
  for (const rel of written) process.stdout.write(`${dryRun ? 'would write' : 'wrote'} public/${rel}\n`);
  process.stdout.write(written.length ? `${written.length} file(s).\n` : 'Nothing to write (use --force).\n');
}
