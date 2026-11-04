import { describe, expect, it } from 'vitest';
import { createRng, rng } from '../../src/core/rng';

const sample = (seed: number): number[] => {
  const r = createRng(seed);
  return [r.next(), r.int(1, 100), r.float(0.85, 1), r.int(-3, 3), r.next()];
};

describe('rng', () => {
  it('same seed gives the same sequence', () => {
    expect(sample(42)).toEqual(sample(42));
  });

  it('different seeds give different sequences', () => {
    expect(sample(1)).not.toEqual(sample(2));
  });

  it('seed() restarts the sequence (including ids)', () => {
    const r = createRng(7);
    const first = [r.int(1, 100), r.id(), r.next()];
    r.seed(7);
    expect([r.int(1, 100), r.id(), r.next()]).toEqual(first);
  });

  it('shared rng can be re-seeded', () => {
    rng.seed(123);
    const a = rng.next();
    rng.seed(123);
    expect(rng.next()).toBe(a);
  });

  it('int stays in [min, max] inclusive and hits both ends', () => {
    const r = createRng(5);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = r.int(1, 6);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      seen.add(v);
    }
    expect(seen.size).toBe(6);
    expect(r.int(4, 4)).toBe(4);
  });

  it('float stays in [min, max)', () => {
    const r = createRng(9);
    for (let i = 0; i < 1000; i++) {
      const v = r.float(0.85, 1);
      expect(v).toBeGreaterThanOrEqual(0.85);
      expect(v).toBeLessThan(1);
    }
  });

  it('chance handles 0 and 100 exactly and ~50 otherwise', () => {
    const r = createRng(11);
    let hits = 0;
    for (let i = 0; i < 2000; i++) {
      expect(r.chance(0)).toBe(false);
      expect(r.chance(100)).toBe(true);
      if (r.chance(50)) hits++;
    }
    expect(hits).toBeGreaterThan(850);
    expect(hits).toBeLessThan(1150);
  });

  it('pick returns an element and throws on empty', () => {
    const r = createRng(3);
    const items = ['a', 'b', 'c'];
    for (let i = 0; i < 50; i++) expect(items).toContain(r.pick(items));
    expect(() => r.pick([])).toThrow();
  });

  it('weighted respects weights and never picks zero weight', () => {
    const r = createRng(17);
    const items = [
      { id: 'raton', weight: 60 },
      { id: 'monitor', weight: 40 },
      { id: 'nunca', weight: 0 },
    ];
    const counts: Record<string, number> = { raton: 0, monitor: 0, nunca: 0 };
    for (let i = 0; i < 5000; i++) counts[r.weighted(items).id]! += 1;
    expect(counts.nunca).toBe(0);
    expect(counts.raton! / 5000).toBeGreaterThan(0.55);
    expect(counts.raton! / 5000).toBeLessThan(0.65);
    expect(() => r.weighted([{ weight: 0 }])).toThrow();
    expect(() => r.weighted([])).toThrow();
  });

  it('id is unique and deterministic per seed', () => {
    const r = createRng(99);
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) ids.add(r.id());
    expect(ids.size).toBe(1000);
    expect(createRng(99).id()).toBe(createRng(99).id());
  });
});
