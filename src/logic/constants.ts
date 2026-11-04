/**
 * Tunable rule numbers. Every number a game rule depends on lives here (see docs/PLAN.md › Game rules).
 * M1 adds the limits that content validation needs; M2 adds the rest of the battle/economy constants.
 */

/** Maximum team size (each Regleta adds one slot up to this). */
export const TEAM_MAX = 6;

/** Euros are whole numbers from 0 to this. */
export const EUROS_MAX = 999_999;

/** Maximum count of one item in the bag (inventory counts are 0–99). */
export const ITEM_COUNT_MAX = 99;
