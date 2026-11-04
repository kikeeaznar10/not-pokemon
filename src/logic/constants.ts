/**
 * Tunable rule numbers. Every number a game rule depends on lives here (see docs/PLAN.md › Game rules).
 * M1 added the limits that content validation needs; M2 added the battle, merge, encounter, NPC,
 * economy and save constants.
 */

/** Maximum team size (each Regleta adds one slot up to this). */
export const TEAM_MAX = 6;

/** Euros are whole numbers from 0 to this. */
export const EUROS_MAX = 999_999;

/** Maximum count of one item in the bag (inventory counts are 0–99). */
export const ITEM_COUNT_MAX = 99;

/** Damage formula scale: `power × Atk/Def × DAMAGE_SCALE × r`. */
export const DAMAGE_SCALE = 0.3;

/** Range `[min, max]` of the random damage factor `r` (`rng.float(min, max)`). */
export const DAMAGE_ROLL: readonly [number, number] = [0.85, 1];

/** An effective stat is never below this fraction of the stat (after buffs/debuffs). */
export const MOD_MIN = 0.25;

/** An effective stat is never above this multiple of the stat (after buffs/debuffs). */
export const MOD_MAX = 2.5;

/** A merge adds this percent of the stat's *base* value (rounded, at least 1). */
export const MERGE_PERCENT = 10;

/** Merges never raise a stat above `MERGE_CAP × base` (so `bonus <= base` with 2). */
export const MERGE_CAP = 2;

/** A beaten (cooldown) NPC returns to `ready` when the player is more than this far (Manhattan). */
export const NPC_COOLDOWN_DISTANCE = 6;

/** Steps with no encounter roll after any battle or map change. */
export const SAFE_STEPS = 3;

/** An NPC enemy below this fraction of its max HP heals if it has a heal attack. */
export const NPC_LOW_HP = 0.25;

/** Current save format version (`flexymon.save.v1`). */
export const SAVE_VERSION = 1;
