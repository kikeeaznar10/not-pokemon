/**
 * Accessibility rules (M15, plan task 4) as pure helpers, so the timing constants can be unit-tested.
 *
 * A "flash" is one on → off cycle. The plan asks for flashing effects under 3 per second
 * (`MAX_FLASHES_PER_SECOND`): every blink and flash in the game is checked against it in
 * `tests/logic/accessibility.test.ts`.
 */
import { MAX_FLASHES_PER_SECOND } from './constants';

/** Flashes per second of something that blinks on for `halfPeriodMs`, then off for `halfPeriodMs`, forever. */
export function blinkRate(halfPeriodMs: number): number {
  return 1000 / (2 * halfPeriodMs);
}

/**
 * The most flashes that can fall in any one-second window when `count` flashes are spread evenly over
 * `durationMs` (one starting every `durationMs / count`).
 */
export function burstRate(count: number, durationMs: number): number {
  if (count <= 1) return count;
  const gap = durationMs / count;
  return Math.min(count, Math.floor(1000 / gap) + 1);
}

/** True if `rate` flashes per second is under the limit. */
export function flashRateOk(rate: number): boolean {
  return rate < MAX_FLASHES_PER_SECOND;
}
