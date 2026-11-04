import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng';
import { computeDamage, healAmount, rollDamageFactor, rollHit } from '../../src/logic/damage';
import { scriptedRng } from './helpers';

describe('damage', () => {
  it('worked examples: power 40, Atk 12, Def 10 → 14 with r = 1.0 and 12 with r = 0.85', () => {
    expect(computeDamage(40, 12, 10, 1.0)).toBe(14);
    expect(computeDamage(40, 12, 10, 0.85)).toBe(12);
  });

  it('is at least 1', () => {
    expect(computeDamage(1, 1, 999, 0.85)).toBe(1);
  });

  it('does not lose a whole point to float noise', () => {
    // 10 × 10/10 × 0.3 × 1 = 3 exactly (naively 2.9999…)
    expect(computeDamage(10, 10, 10, 1)).toBe(3);
  });

  it('hits when rng.int(1, 100) <= accuracy', () => {
    expect(rollHit(80, scriptedRng({ int: [80] }))).toBe(true);
    expect(rollHit(80, scriptedRng({ int: [81] }))).toBe(false);
    expect(rollHit(100, scriptedRng({ int: [100] }))).toBe(true);
  });

  it('the damage roll stays in [0.85, 1.0]', () => {
    const r = createRng(7);
    for (let i = 0; i < 500; i += 1) {
      const v = rollDamageFactor(r);
      expect(v).toBeGreaterThanOrEqual(0.85);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('heal amount is floor(maxHp × percent / 100)', () => {
    expect(healAmount(40, 30)).toBe(12);
    expect(healAmount(38, 30)).toBe(11);
  });
});
