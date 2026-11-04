/**
 * Content loader: fetches the nine JSON files from `public/data/`, parses them, validates each with
 * its zod schema, runs the cross-reference checks and builds the frozen {@link GameData}.
 * Any problem is returned as a list of {@link DataError}s for the ErrorScene; nothing throws.
 */
import type { z } from 'zod';
import { checkCrossRefs } from './cross-refs';
import type { DataError } from './errors';
import { buildGameData, type GameData, type RawGameData } from './game-data';
import { DATA_FILES, FILE_SCHEMAS, type DataFileName } from './schemas';

/** Result of loading or validating content. */
export type LoadResult = { ok: true; data: GameData } | { ok: false; errors: DataError[] };

/** Raw file contents: already-parsed JSON, or a {@link FileFailure} if it could not be read/parsed. */
export type RawFiles = Record<DataFileName, unknown>;

/** Marks a file that could not be fetched or parsed. */
export class FileFailure {
  /** @param message why the file could not be used */
  constructor(readonly message: string) {}
}

/**
 * Validate already-parsed file contents (pure; used by the loader and by unit tests).
 * Schema errors are reported for every file; cross-references are checked only when all schemas pass.
 */
export function validateGameData(files: RawFiles): LoadResult {
  const errors: DataError[] = [];
  const parsed: Partial<Record<DataFileName, unknown>> = {};

  for (const file of DATA_FILES) {
    const value = files[file];
    if (value instanceof FileFailure) {
      errors.push({ file, path: [], message: value.message });
      continue;
    }
    const schema: z.ZodType = FILE_SCHEMAS[file];
    const result = schema.safeParse(value);
    if (result.success) parsed[file] = result.data;
    else
      for (const issue of result.error.issues)
        errors.push({ file, path: issue.path, message: issue.message });
  }
  if (errors.length > 0) return { ok: false, errors };

  const raw = {
    flexymon: parsed['flexymon.json'],
    attacks: parsed['attacks.json'],
    items: parsed['items.json'],
    npcs: parsed['npcs.json'],
    zones: parsed['zones.json'],
    shops: parsed['shops.json'],
    start: parsed['start.json'],
    secretNames: parsed['secret-names.json'],
    car: parsed['car.json'],
  } as RawGameData; // Safe: every entry passed its schema above.

  const refErrors = checkCrossRefs(raw);
  if (refErrors.length > 0) return { ok: false, errors: refErrors };
  return { ok: true, data: buildGameData(raw) };
}

/** Fetches one file's text; rejects (or throws) on failure. */
export type TextFetcher = (url: string) => Promise<string>;

/** Default fetcher: `fetch` that treats non-2xx responses as failures. */
export const fetchText: TextFetcher = async (url) => {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
};

/**
 * Fetch, parse and validate every content file from `baseUrl` (e.g. `./data/`).
 * Fetch and JSON errors become `file › (root) › …` errors.
 */
export async function loadGameData(baseUrl: string, fetcher: TextFetcher = fetchText): Promise<LoadResult> {
  const entries = await Promise.all(
    DATA_FILES.map(async (file): Promise<[DataFileName, unknown]> => {
      let text: string;
      try {
        text = await fetcher(`${baseUrl}${file}`);
      } catch (e) {
        return [file, new FileFailure(`could not load file (${e instanceof Error ? e.message : String(e)})`)];
      }
      try {
        return [file, JSON.parse(text) as unknown];
      } catch (e) {
        return [file, new FileFailure(`invalid JSON (${e instanceof Error ? e.message : String(e)})`)];
      }
    }),
  );
  return validateGameData(Object.fromEntries(entries) as RawFiles);
}
