import { describe, expect, it } from 'vitest';
import { applyModifier, effectiveStat, tickModifiers, type Modifier } from '../../src/logic/modifiers';

const mod = (over: Partial<Modifier>): Modifier => ({
  source: 'attack:x',
  kind: 'buff',
  stat: 'attack',
  percent: 25,
  turnsLeft: 3,
  ...over,
});

describe('modifiers', () => {
  it('worked example: Defense 10 with one −25% debuff → 7', () => {
    expect(effectiveStat(10, [mod({ kind: 'debuff', stat: 'defense' })], 'defense')).toBe(7);
  });

  it('sums buffs and debuffs of the same stat only', () => {
    const mods = [
      mod({ source: 'a', percent: 30 }),
      mod({ source: 'b', kind: 'debuff', percent: 10 }),
      mod({ source: 'c', stat: 'speed', percent: 50 }),
    ];
    expect(effectiveStat(12, mods, 'attack')).toBe(14); // 12 × 1.2 = 14.4
    expect(effectiveStat(12, mods, 'defense')).toBe(12);
  });

  it('clamps between 25% and 250% and is at least 1', () => {
    const down = [mod({ kind: 'debuff', percent: 100 }), mod({ source: 'y', kind: 'debuff', percent: 100 })];
    expect(effectiveStat(10, down, 'attack')).toBe(2); // 25% of 10 = 2.5 → 2
    const up = [1, 2, 3, 4].map((i) => mod({ source: `s${i}`, percent: 100 }));
    expect(effectiveStat(10, up, 'attack')).toBe(25);
    expect(effectiveStat(1, down, 'attack')).toBe(1);
  });

  it('the same source replaces (turns reset) instead of stacking', () => {
    let mods = applyModifier([], mod({ turnsLeft: 1 }));
    mods = applyModifier(mods, mod({ turnsLeft: 3 }));
    expect(mods).toEqual([mod({ turnsLeft: 3 })]);
    mods = applyModifier(mods, mod({ source: 'item:redbull', percent: 30 }));
    expect(mods).toHaveLength(2);
    expect(effectiveStat(10, mods, 'attack')).toBe(15);
  });

  it('ticks one turn per round and removes at 0', () => {
    const { kept, expired } = tickModifiers([
      mod({ source: 'a', turnsLeft: 1 }),
      mod({ source: 'b', turnsLeft: 3 }),
    ]);
    expect(kept).toEqual([mod({ source: 'b', turnsLeft: 2 })]);
    expect(expired).toEqual([mod({ source: 'a', turnsLeft: 0 })]);
  });
});
