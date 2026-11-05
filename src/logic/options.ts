/**
 * Player options: music volume, effects volume and text speed, saved
 * apart from the game in `localStorage` key `flexymon.options` (the store is `src/core/options.ts`).
 *
 * Rules:
 * - Volumes are whole levels `0 … VOLUME_STEPS` (0 = silent); both start at full.
 * - Text speed is `slow` / `normal` / `fast` (*lenta / normal / rápida*), typing at `TEXT_SPEED_CPS`;
 *   it starts at `normal`.
 * - Left / Right change the option under the cursor by one step; values stop at the ends (no wrap).
 * - Reading never fails: a missing or broken document gives the defaults, and each field that is missing
 *   or invalid falls back to its own default (the others are kept). A warning says what was replaced.
 * Pure: no `localStorage` here.
 */
import { z } from 'zod';
import { TEXT_SPEED_CPS, VOLUME_STEPS } from './constants';

/** Text speed (*lenta / normal / rápida*). */
export type TextSpeed = 'slow' | 'normal' | 'fast';

/** Text speeds from slowest to fastest (the order Left / Right step through). */
export const TEXT_SPEEDS: readonly TextSpeed[] = ['slow', 'normal', 'fast'];

/** The player's options. */
export interface Options {
  /** Music volume level, 0 … `VOLUME_STEPS`. */
  music: number;
  /** Sound effects volume level, 0 … `VOLUME_STEPS`. */
  sfx: number;
  textSpeed: TextSpeed;
}

/** One adjustable row of the options screen, in screen order. */
export type OptionKey = keyof Options;

/** The rows of the options screen, top to bottom. */
export const OPTION_KEYS: readonly OptionKey[] = ['music', 'sfx', 'textSpeed'];

const levelSchema = z.int().min(0).max(VOLUME_STEPS);
const fieldSchemas: Record<OptionKey, z.ZodType> = {
  music: levelSchema,
  sfx: levelSchema,
  textSpeed: z.enum(TEXT_SPEEDS as [TextSpeed, ...TextSpeed[]]),
};

/** The options of a first visit: both volumes full, normal text speed. */
export function defaultOptions(): Options {
  return { music: VOLUME_STEPS, sfx: VOLUME_STEPS, textSpeed: 'normal' };
}

/** Result of {@link parseOptions}: always usable options, plus what had to be replaced. */
export interface ParsedOptions {
  options: Options;
  warnings: string[];
}

/** Read a saved options document (`null` = nothing saved). Never throws; see the module rules. */
export function parseOptions(text: string | null): ParsedOptions {
  const options = defaultOptions();
  if (text === null) return { options, warnings: [] };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { options, warnings: ['options are not valid JSON; using the defaults'] };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { options, warnings: ['options are not an object; using the defaults'] };
  }
  const record = raw as Record<string, unknown>;
  const warnings: string[] = [];
  const out: Record<string, unknown> = { ...options };
  for (const key of OPTION_KEYS) {
    const parsed = fieldSchemas[key].safeParse(record[key]);
    if (parsed.success) out[key] = parsed.data;
    else warnings.push(`option "${key}" is missing or invalid; using the default`);
  }
  return { options: out as unknown as Options, warnings };
}

/** The options as the JSON string stored in `flexymon.options`. */
export function serializeOptions(options: Options): string {
  return JSON.stringify({ music: options.music, sfx: options.sfx, textSpeed: options.textSpeed });
}

/** Change option `key` by one step left (`-1`) or right (`+1`), stopping at the ends. */
export function stepOption(options: Options, key: OptionKey, delta: -1 | 1): Options {
  if (key === 'textSpeed') {
    const i = TEXT_SPEEDS.indexOf(options.textSpeed);
    const next = TEXT_SPEEDS[Math.min(TEXT_SPEEDS.length - 1, Math.max(0, i + delta))] ?? 'normal';
    return { ...options, textSpeed: next };
  }
  return { ...options, [key]: Math.min(VOLUME_STEPS, Math.max(0, options[key] + delta)) };
}

/** Characters per second for a text speed. */
export function textCps(speed: TextSpeed): number {
  return TEXT_SPEED_CPS[speed];
}

/** A volume level as a 0–1 gain. */
export function volumeGain(level: number): number {
  return Math.min(1, Math.max(0, level / VOLUME_STEPS));
}
