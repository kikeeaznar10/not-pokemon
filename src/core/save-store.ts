/**
 * Save store (docs/GAME-RULES.md › Saving): the small wrapper over `localStorage` that keeps the one save
 * slot. The format, validation and migration are `src/logic/save.ts`; this file only reads and writes.
 *
 * - The save lives under {@link SAVE_KEY} (`flexymon.save.v1`).
 * - {@link SaveStore.load}: no save → `none`. A save that is not valid JSON, fails its schema, or has no
 *   flexymon left after migration → `broken`: the raw text is copied to {@link BROKEN_SAVE_KEY}
 *   (`flexymon.save.broken`) and the game starts fresh (the bad slot is overwritten by the next save).
 *   Migration warnings (dropped unknown ids, clamped values) are logged, never fatal.
 * - {@link SaveStore.write} never throws: a full or blocked storage logs a warning and returns false.
 * - Without `localStorage` (blocked by the browser) every call is a harmless no-op.
 */
import { parseSave, serializeSave, type GameState, type SaveCheckData, type SaveError } from '../logic/save';
import { log, warn } from './log';

/** `localStorage` key of the one save slot. */
export const SAVE_KEY = 'flexymon.save.v1';

/** `localStorage` key where a save that could not be read is copied. */
export const BROKEN_SAVE_KEY = 'flexymon.save.broken';

/** The part of the Web Storage API the stores use (`localStorage`, or a fake in tests). */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** What {@link SaveStore.load} found. */
export type LoadOutcome =
  | { status: 'none' }
  | { status: 'loaded'; state: GameState; savedAt: string; warnings: string[] }
  | { status: 'broken'; reason: SaveError; detail: string };

/** `window.localStorage`, or `null` when the browser blocks it. */
export function browserStorage(): KeyValueStore | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Reads and writes the save slot. */
export class SaveStore {
  /** @param storage where to keep the save (`null` = nowhere; every call does nothing) */
  constructor(private readonly storage: KeyValueStore | null) {}

  /** The raw saved text, or `null`. */
  raw(): string | null {
    try {
      return this.storage?.getItem(SAVE_KEY) ?? null;
    } catch {
      return null;
    }
  }

  /** Read, validate and migrate the save against the current content (see the module rules). */
  load(data: SaveCheckData): LoadOutcome {
    const text = this.raw();
    if (text === null) return { status: 'none' };
    const parsed = parseSave(text, data);
    if (!parsed.ok) {
      warn(
        `Save: cannot read ${SAVE_KEY} (${parsed.reason}: ${parsed.detail}); copied to ${BROKEN_SAVE_KEY}`,
      );
      this.set(BROKEN_SAVE_KEY, text);
      return { status: 'broken', reason: parsed.reason, detail: parsed.detail };
    }
    for (const w of parsed.warnings) warn(`Save: ${w}`);
    log(`Save: loaded (saved at ${parsed.savedAt})`);
    return { status: 'loaded', state: parsed.state, savedAt: parsed.savedAt, warnings: parsed.warnings };
  }

  /** Save `state` (stamped with `now`). False if the storage refused it. */
  write(state: GameState, now: Date = new Date()): boolean {
    return this.set(SAVE_KEY, serializeSave(state, now));
  }

  /** Delete the save (debug command). The broken copy is kept. */
  remove(): void {
    try {
      this.storage?.removeItem(SAVE_KEY);
    } catch (e) {
      warn('Save: could not delete', e);
    }
  }

  private set(key: string, value: string): boolean {
    if (!this.storage) return false;
    try {
      this.storage.setItem(key, value);
      return true;
    } catch (e) {
      warn(`Save: could not write ${key}`, e);
      return false;
    }
  }
}

/** The game's save store, over the browser's `localStorage`. */
export const saveStore = new SaveStore(browserStorage());
