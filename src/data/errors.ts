/** Content-validation errors and their one-line format: `file › path › message`. */

/** One problem found while loading content. `path` is a list of keys/indices inside the file. */
export interface DataError {
  file: string;
  path: readonly PropertyKey[];
  message: string;
}

/**
 * Format a JSON path the way the plan shows it: indices as `[3]`, keys joined with dots,
 * e.g. `[3].team[0]` or `spawn.map`. An empty path is shown as `(root)`.
 */
export function formatPath(path: readonly PropertyKey[]): string {
  let out = '';
  for (const part of path) {
    if (typeof part === 'number') out += `[${part}]`;
    else out += out === '' ? String(part) : `.${String(part)}`;
  }
  return out === '' ? '(root)' : out;
}

/** `npcs.json › [3].team[0] › unknown flexymon "teclado"`. */
export function formatDataError(e: DataError): string {
  return `${e.file} › ${formatPath(e.path)} › ${e.message}`;
}
