/**
 * Hit and damage rules (docs/GAME-RULES.md › Hit and damage).
 * - Hit: `rng.int(1, 100) <= accuracy`.
 * - Damage: `max(1, floor(power × Atk_eff / Def_eff × DAMAGE_SCALE × r))`, `r = rng.float(0.85, 1.0)`.
 * - Heal attacks: `floor(maxHp × percent / 100)`, never above max HP (clamping is done by the caller).
 */
import type { Rng } from '../core/rng';
import { DAMAGE_ROLL, DAMAGE_SCALE } from './constants';

/** Small tolerance so float noise (14.3999…) never floors a whole number down. */
const EPSILON = 1e-9;

/** Roll the hit check: one `rng.int(1, 100)` call. */
export function rollHit(accuracy: number, rng: Rng): boolean {
  return rng.int(1, 100) <= accuracy;
}

/** The damage roll `r` in [`DAMAGE_ROLL[0]`, `DAMAGE_ROLL[1]`]: one `rng.float` call. */
export function rollDamageFactor(rng: Rng): number {
  return rng.float(DAMAGE_ROLL[0], DAMAGE_ROLL[1]);
}

/** Damage for a given roll `r`. Example: power 40, Atk 12, Def 10, r 1.0 → 14; r 0.85 → 12. */
export function computeDamage(power: number, attack: number, defense: number, r: number): number {
  return Math.max(1, Math.floor(((power * attack) / defense) * DAMAGE_SCALE * r + EPSILON));
}

/** HP restored by a heal attack: `floor(maxHp × percent / 100)` (before clamping to max HP). */
export function healAmount(maxHp: number, percent: number): number {
  return Math.floor((maxHp * percent) / 100 + EPSILON);
}
