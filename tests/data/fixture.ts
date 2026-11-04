/** Test helper: the shipped `public/data/` files as a mutable fixture. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatDataError } from '../../src/data/errors';
import { validateGameData, type RawFiles } from '../../src/data/loader';
import { DATA_FILES } from '../../src/data/schemas';

/** A fresh deep copy of every content file, parsed from `public/data/`. */
export function validFiles(): RawFiles {
  const dir = join(__dirname, '..', '..', 'public', 'data');
  return Object.fromEntries(
    DATA_FILES.map((f) => [f, JSON.parse(readFileSync(join(dir, f), 'utf8')) as unknown]),
  ) as RawFiles;
}

// Loose JSON access for mutating fixtures in tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- fixtures are arbitrary JSON on purpose
export type Json = any;

/** Apply `mutate` to a valid fixture and return the formatted error lines (empty if valid). */
export function errorsAfter(mutate: (files: Record<string, Json>) => void): string[] {
  const files = validFiles() as Record<string, Json>;
  mutate(files);
  const result = validateGameData(files as RawFiles);
  return result.ok ? [] : result.errors.map(formatDataError);
}
