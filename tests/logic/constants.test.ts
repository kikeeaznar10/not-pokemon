import { describe, expect, it } from 'vitest';
import * as C from '../../src/logic/constants';

describe('constants', () => {
  it('match the values in docs/PLAN.md › M2', () => {
    expect(C.DAMAGE_SCALE).toBe(0.3);
    expect(C.DAMAGE_ROLL).toEqual([0.85, 1]);
    expect(C.MOD_MIN).toBe(0.25);
    expect(C.MOD_MAX).toBe(2.5);
    expect(C.MERGE_PERCENT).toBe(10);
    expect(C.MERGE_CAP).toBe(2);
    expect(C.TEAM_MAX).toBe(6);
    expect(C.NPC_COOLDOWN_DISTANCE).toBe(6);
    expect(C.SAFE_STEPS).toBe(3);
    expect(C.EUROS_MAX).toBe(999999);
    expect(C.NPC_LOW_HP).toBe(0.25);
  });
});
