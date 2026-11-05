/**
 * The sprite atlas (made by `npm run atlas` / `npm run build`, see `tools/make-atlas.ts`).
 *
 * Boot calls {@link loadAtlasIndex}: it fetches `assets/atlas/sprites.json` and keeps the frame list
 * ({@link getAtlas}). When there is no atlas (`npm run dev` before a build) or the file is not a valid atlas, the
 * index is `null` and every sprite loads as its own file.
 *
 * Preload loads the atlas image instead of the sprites it holds, then copies every frame into its own canvas
 * texture keyed by the frame's name — the sprite's asset path — so the rest of the game (and `hasTexture()`) sees
 * the same keys and image sizes as with separate files. The atlas texture itself is then removed.
 */
import { z } from 'zod';
import { fetchText, type TextFetcher } from './loader';

/** Phaser texture key of the atlas while it loads. */
export const ATLAS_KEY = '__sprite_atlas';
/** Atlas image path (relative to `public/`). */
export const ATLAS_IMAGE = 'assets/atlas/sprites.png';
/** Atlas description path (relative to `public/`). */
export const ATLAS_JSON = 'assets/atlas/sprites.json';

const frameSchema = z.looseObject({
  frame: z.object({ x: z.int().min(0), y: z.int().min(0), w: z.int().min(1), h: z.int().min(1) }),
});
const atlasSchema = z.looseObject({ frames: z.record(z.string(), frameSchema) });

/** A loaded atlas: the raw JSON (handed to Phaser's loader) and its frames by asset path. */
export interface AtlasIndex {
  json: object;
  frames: ReadonlyMap<string, { x: number; y: number; w: number; h: number }>;
}

/** Check a parsed `sprites.json` (Phaser JSON hash); `null` if it is not one. Pure. */
export function parseAtlas(json: unknown): AtlasIndex | null {
  const parsed = atlasSchema.safeParse(json);
  if (!parsed.success) return null;
  return {
    json: parsed.data,
    frames: new Map(Object.entries(parsed.data.frames).map(([k, v]) => [k, v.frame])),
  };
}

let current: AtlasIndex | null = null;

/** Fetch and check the atlas description from `baseUrl` + {@link ATLAS_JSON}; stores and returns it (or `null`). */
export async function loadAtlasIndex(
  baseUrl: string,
  fetcher: TextFetcher = fetchText,
): Promise<AtlasIndex | null> {
  try {
    current = parseAtlas(JSON.parse(await fetcher(`${baseUrl}${ATLAS_JSON}`)) as unknown);
  } catch {
    current = null;
  }
  return current;
}

/** The atlas found at boot, or `null` (sprites load as files). */
export function getAtlas(): AtlasIndex | null {
  return current;
}
