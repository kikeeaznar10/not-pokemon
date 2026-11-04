/**
 * Catching and merging (docs/PLAN.md › Catching and merging). After beating a wild flexymon the player
 * may take it (`canCatch()` is the hook for a future catch item). A species not yet owned is added
 * (team if a slot is free, else storage). An owned species merges into the first instance (team first,
 * then storage): a random stat whose bonus is below `(MERGE_CAP − 1) × base` gains
 * `max(1, round(base × MERGE_PERCENT / 100))`, never past the cap; an HP gain also raises `currentHp`.
 */
import type { Rng } from '../core/rng';
import type { Species } from '../data/schemas';
import { MERGE_CAP, MERGE_PERCENT } from './constants';
import { createInstance, STAT_KEYS, type FlexymonInstance, type StatKey } from './instance';
import { addFlexymon, findOwned, replaceInstance, type Party } from './team';

/** What happened when a flexymon was taken. */
export type CatchOutcome =
  | { type: 'added'; to: 'team' | 'storage'; uid: string }
  | { type: 'merged'; uid: string; stat: StatKey; amount: number }
  | { type: 'maxed'; uid: string };

/**
 * Whether the player may take the beaten wild flexymon. Always true for now; the future catch item
 * (open question in docs/PROGRESS.md) will be checked here.
 */
export function canCatch(): boolean {
  return true;
}

/** Highest bonus a stat may reach: `(MERGE_CAP − 1) × base`. */
export function maxBonus(species: Species, stat: StatKey): number {
  return (MERGE_CAP - 1) * species.stats[stat];
}

/** Gain per merge for a stat: `max(1, round(base × MERGE_PERCENT / 100))`. Base attack 12 → 1. */
export function mergeGain(species: Species, stat: StatKey): number {
  return Math.max(1, Math.round((species.stats[stat] * MERGE_PERCENT) / 100));
}

/** Merge one more of `species` into `inst`. One `rng.pick` call unless the instance is maxed. */
export function mergeInto(
  species: Species,
  inst: FlexymonInstance,
  rng: Rng,
): { instance: FlexymonInstance; stat: StatKey; amount: number } | null {
  const open = STAT_KEYS.filter((s) => inst.bonus[s] < maxBonus(species, s));
  if (open.length === 0) return null;
  const stat = rng.pick(open);
  const amount = Math.min(mergeGain(species, stat), maxBonus(species, stat) - inst.bonus[stat]);
  const bonus = { ...inst.bonus, [stat]: inst.bonus[stat] + amount };
  const currentHp = stat === 'hp' ? inst.currentHp + amount : inst.currentHp;
  return { instance: { ...inst, bonus, currentHp }, stat, amount };
}

/**
 * Take a beaten wild flexymon of `species`: add it as a new instance (zero bonus, full HP) or merge it.
 * Returns the new party and the outcome for the message.
 */
export function takeFlexymon(
  party: Party,
  species: Species,
  rng: Rng,
): { party: Party; outcome: CatchOutcome } {
  const owned = findOwned(party, species.id);
  if (!owned) {
    const inst = createInstance(species, rng);
    const added = addFlexymon(party, inst);
    return { party: added.party, outcome: { type: 'added', to: added.to, uid: inst.uid } };
  }
  const merged = mergeInto(species, owned.instance, rng);
  if (!merged) return { party, outcome: { type: 'maxed', uid: owned.instance.uid } };
  return {
    party: replaceInstance(party, merged.instance),
    outcome: { type: 'merged', uid: merged.instance.uid, stat: merged.stat, amount: merged.amount },
  };
}
