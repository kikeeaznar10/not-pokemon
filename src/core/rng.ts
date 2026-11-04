/**
 * Seedable random number generator. ALL game randomness goes through this module so tests can
 * fix the seed and get identical sequences.
 *
 * Algorithm: mulberry32 (32-bit state, fast, good enough for a game; not cryptographic).
 */

/** An entry for {@link Rng.weighted}: any object with a positive whole `weight`. */
export interface Weighted {
  weight: number;
}

/** A seeded generator. Create one with {@link createRng}, or use the shared {@link rng}. */
export interface Rng {
  /** Re-seed the generator; the same seed always produces the same sequence. */
  seed(seed: number): void;
  /** Float in [0, 1). */
  next(): number;
  /** Whole number in [min, max], both inclusive. */
  int(min: number, max: number): number;
  /** Float in [min, max). `float(0.85, 1.0)` is the damage roll. */
  float(min: number, max: number): number;
  /** True with `percent`% probability (0–100). `chance(0)` is always false, `chance(100)` always true. */
  chance(percent: number): boolean;
  /** A uniformly random element. Throws on an empty array. */
  pick<T>(items: readonly T[]): T;
  /** An element chosen with probability proportional to its `weight`. Throws if no weight is positive. */
  weighted<T extends Weighted>(items: readonly T[]): T;
  /** A short unique id string (used as flexymon instance `uid`). Deterministic for a given seed. */
  id(): string;
}

/** Create an independent generator with its own seed. */
export function createRng(initialSeed: number): Rng {
  let state = 0;
  let idCounter = 0;

  const self: Rng = {
    seed(seed: number): void {
      state = seed >>> 0;
      idCounter = 0;
    },
    next(): number {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(min: number, max: number): number {
      const lo = Math.ceil(Math.min(min, max));
      const hi = Math.floor(Math.max(min, max));
      return lo + Math.floor(self.next() * (hi - lo + 1));
    },
    float(min: number, max: number): number {
      return min + self.next() * (max - min);
    },
    chance(percent: number): boolean {
      if (percent <= 0) return false;
      if (percent >= 100) return true;
      return self.next() * 100 < percent;
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('rng.pick: empty array');
      return items[self.int(0, items.length - 1)] as T;
    },
    weighted<T extends Weighted>(items: readonly T[]): T {
      const total = items.reduce((sum, it) => sum + Math.max(0, it.weight), 0);
      if (total <= 0) throw new Error('rng.weighted: no positive weight');
      let roll = self.next() * total;
      for (const it of items) {
        const w = Math.max(0, it.weight);
        if (roll < w) return it;
        roll -= w;
      }
      // Floating-point edge case: return the last positive-weight entry.
      return [...items].reverse().find((it) => it.weight > 0) as T;
    },
    id(): string {
      idCounter += 1;
      const rand = Math.floor(self.next() * 0x100000000)
        .toString(36)
        .padStart(7, '0');
      return `${idCounter.toString(36)}${rand}`;
    },
  };

  self.seed(initialSeed);
  return self;
}

/** The shared game generator, seeded from the clock. Tests call `rng.seed(n)` to fix it. */
export const rng: Rng = createRng(Date.now());
