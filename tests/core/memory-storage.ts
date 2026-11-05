/** Test helper: an in-memory stand-in for `localStorage` (the `KeyValueStore` the stores use). */
import type { KeyValueStore } from '../../src/core/save-store';

/** A fake `localStorage` backed by a `Map` (exposed as `map` for assertions). */
export function memoryStorage(
  initial: Record<string, string> = {},
): KeyValueStore & { map: Map<string, string> } {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}
