/**
 * Owned flexymon instances (docs/GAME-RULES.md › Owned flexymon). An instance is plain data:
 * `{ uid, speciesId, bonus, currentHp }`. A stat's value is `base + bonus`; max HP is
 * `base.hp + bonus.hp`; `currentHp = 0` means *debilitado* (fainted).
 *
 * Every function here is pure: it never mutates its input and returns a new instance instead.
 */
import type { Rng } from '../core/rng';
import type { Species, Stats } from '../data/schemas';

/** One of the four stats. */
export type StatKey = keyof Stats;

/** Every stat, in display order (HP, Ataque, Defensa, Velocidad). Merges pick from this order. */
export const STAT_KEYS: readonly StatKey[] = ['hp', 'attack', 'defense', 'speed'];

/** A flexymon the player (or an NPC, during a battle) owns. */
export interface FlexymonInstance {
  /** Unique id made by `rng.id()`. */
  uid: string;
  speciesId: string;
  /** Bonus added to each base stat by merges (0 for a fresh catch). */
  bonus: Stats;
  /** 0 … max HP. */
  currentHp: number;
}

/** A bonus of zero on every stat. */
export function zeroBonus(): Stats {
  return { hp: 0, attack: 0, defense: 0, speed: 0 };
}

/** A new instance of `species` with zero bonus and full HP; `uid` comes from `rng.id()`. */
export function createInstance(species: Species, rng: Rng): FlexymonInstance {
  return { uid: rng.id(), speciesId: species.id, bonus: zeroBonus(), currentHp: species.stats.hp };
}

/** The value of a stat: `base + bonus`. */
export function statValue(species: Species, inst: FlexymonInstance, stat: StatKey): number {
  return species.stats[stat] + inst.bonus[stat];
}

/** Max HP: `base.hp + bonus.hp`. */
export function maxHp(species: Species, inst: FlexymonInstance): number {
  return statValue(species, inst, 'hp');
}

/** True when `currentHp` is 0 (*debilitado*). */
export function isFainted(inst: FlexymonInstance): boolean {
  return inst.currentHp <= 0;
}

/** Result of a heal: the new instance and how many HP were really restored. */
export interface HealResult {
  instance: FlexymonInstance;
  healed: number;
}

/**
 * Restore `amount` HP, never above max HP. A fainted instance is NOT healed (only revive does that),
 * so healing it returns `healed: 0`.
 */
export function heal(species: Species, inst: FlexymonInstance, amount: number): HealResult {
  if (isFainted(inst)) return { instance: inst, healed: 0 };
  const hp = Math.min(maxHp(species, inst), inst.currentHp + Math.max(0, Math.floor(amount)));
  return { instance: { ...inst, currentHp: hp }, healed: hp - inst.currentHp };
}

/** Full heal, also reviving a fainted instance (used by the office healer and after losing). */
export function healFull(species: Species, inst: FlexymonInstance): FlexymonInstance {
  return { ...inst, currentHp: maxHp(species, inst) };
}

/**
 * Revive a fainted instance to `floor(maxHp × percent / 100)` HP (at least 1). An instance that is not
 * fainted is returned unchanged with `healed: 0`.
 */
export function revive(species: Species, inst: FlexymonInstance, percent: number): HealResult {
  if (!isFainted(inst)) return { instance: inst, healed: 0 };
  const hp = Math.min(maxHp(species, inst), Math.max(1, Math.floor((maxHp(species, inst) * percent) / 100)));
  return { instance: { ...inst, currentHp: hp }, healed: hp };
}

/** Lower HP by `amount` (a whole number); HP never goes below 0. */
export function takeDamage(inst: FlexymonInstance, amount: number): FlexymonInstance {
  return { ...inst, currentHp: Math.max(0, inst.currentHp - Math.max(0, Math.floor(amount))) };
}
