import { describe, expect, it } from 'vitest';
import * as C from '../../src/logic/constants';

describe('constants', () => {
  it('match the documented rule values', () => {
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

  it('match the battle timings (flash 600 ms, HP bar 400 ms)', () => {
    expect(C.BATTLE_FLASH_MS).toBe(600);
    expect(C.HP_ANIM_MS).toBe(400);
    expect(C.HP_RED_BELOW).toBeLessThan(C.HP_YELLOW_BELOW);
  });
});
