/**
 * Options store: the live player options (music volume, effects volume, text speed), kept in
 * `localStorage` key {@link OPTIONS_KEY} (`flexymon.options`), apart from the game save, so deleting or
 * breaking the save never resets them. Rules and parsing: `src/logic/options.ts`.
 *
 * - {@link loadOptions} reads them once at start-up (`main.ts`); broken or missing fields fall back to
 *   their defaults with a logged warning.
 * - {@link setOptions} replaces them, writes them at once and emits `options:changed` (main.ts applies
 *   the music volume; dialogue boxes and sounds read {@link getOptions} / {@link sfxVolume} when they need it).
 */
import { defaultOptions, parseOptions, serializeOptions, volumeGain, type Options } from '../logic/options';
import { events } from './events';
import { warn } from './log';
import { browserStorage, type KeyValueStore } from './save-store';

/** `localStorage` key of the options. */
export const OPTIONS_KEY = 'flexymon.options';

let current: Options = defaultOptions();
let storage: KeyValueStore | null = null;

/** Read the options from `store` (default: the browser's `localStorage`) and make them current. */
export function loadOptions(store: KeyValueStore | null = browserStorage()): Options {
  storage = store;
  let text: string | null;
  try {
    text = store?.getItem(OPTIONS_KEY) ?? null;
  } catch {
    text = null;
  }
  const parsed = parseOptions(text);
  for (const w of parsed.warnings) warn(`Options: ${w}`);
  current = parsed.options;
  return current;
}

/** The current options. */
export function getOptions(): Options {
  return current;
}

/** Replace the options, store them and emit `options:changed`. */
export function setOptions(options: Options): void {
  current = { ...options };
  try {
    storage?.setItem(OPTIONS_KEY, serializeOptions(current));
  } catch (e) {
    warn('Options: could not save', e);
  }
  events.emit('options:changed', current);
}

/** Volume (0–1) for sound effects, from the effects option. Pass it as `volume` when playing a sound. */
export function sfxVolume(): number {
  return volumeGain(current.sfx);
}
