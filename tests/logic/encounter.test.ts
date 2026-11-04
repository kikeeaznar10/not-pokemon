import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng';
import {
  checkStep,
  encounterGroupAt,
  resetSafeSteps,
  rollEncounter,
  type EncounterRect,
} from '../../src/logic/encounter';
import { scriptedRng } from './helpers';

const rects: EncounterRect[] = [
  { group: 'jardin', mode: 'tiles', x: 2, y: 2, width: 3, height: 2 },
  { group: 'plaza', mode: 'all', x: 10, y: 0, width: 2, height: 2 },
];
const groups = {
  jardin: {
    rate: 100,
    flexymon: [
      { id: 'raton', weight: 60 },
      { id: 'teclado', weight: 40 },
    ],
  },
  plaza: { rate: 6, flexymon: [{ id: 'teclado', weight: 100 }] },
};

describe('wild encounters', () => {
  it('a tile qualifies inside a `tiles` rect only with encounter = true, inside an `all` rect always', () => {
    expect(encounterGroupAt(rects, 2, 2, true)).toBe('jardin');
    expect(encounterGroupAt(rects, 4, 3, true)).toBe('jardin');
    expect(encounterGroupAt(rects, 2, 2, false)).toBeNull();
    expect(encounterGroupAt(rects, 5, 2, true)).toBeNull(); // right edge is outside
    expect(encounterGroupAt(rects, 11, 1, false)).toBe('plaza');
    expect(encounterGroupAt(rects, 0, 0, true)).toBeNull();
  });

  it('rolls rng.chance(rate), then a weighted pick', () => {
    expect(rollEncounter(groups.jardin, scriptedRng({ chance: [true], weighted: [1] }))).toBe('teclado');
    expect(rollEncounter(groups.plaza, scriptedRng({ chance: [false] }))).toBeNull();
  });

  it('weights are relative', () => {
    const rng = createRng(3);
    let ratones = 0;
    for (let i = 0; i < 2000; i += 1) if (rollEncounter(groups.jardin, rng) === 'raton') ratones += 1;
    expect(ratones / 2000).toBeGreaterThan(0.55);
    expect(ratones / 2000).toBeLessThan(0.65);
  });

  it('with rate 100 every step on grass starts a battle except the 3 safe steps after one', () => {
    const rng = createRng(1);
    let safeSteps = resetSafeSteps();
    const results: boolean[] = [];
    for (let i = 0; i < 5; i += 1) {
      const r = checkStep({ safeSteps, rects, groups, x: 3, y: 3, tileHasEncounter: true }, rng);
      safeSteps = r.safeSteps;
      results.push(r.speciesId !== null);
    }
    expect(results).toEqual([false, false, false, true, true]);
  });

  it('no roll (no rng call) during safe steps or off encounter tiles', () => {
    const none = scriptedRng({});
    expect(checkStep({ safeSteps: 2, rects, groups, x: 3, y: 3, tileHasEncounter: true }, none)).toEqual({
      safeSteps: 1,
      speciesId: null,
    });
    expect(checkStep({ safeSteps: 0, rects, groups, x: 0, y: 0, tileHasEncounter: true }, none)).toEqual({
      safeSteps: 0,
      speciesId: null,
    });
    expect(
      checkStep({ safeSteps: 0, rects, groups: {}, x: 3, y: 3, tileHasEncounter: true }, none).speciesId,
    ).toBeNull();
  });
});
