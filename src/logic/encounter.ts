/**
 * Wild encounters (docs/PLAN.md › Wild encounters). Checked once each time the player *finishes* a
 * step. A step can start an encounter when its tile is inside an encounter rectangle of the map and the
 * rectangle's mode is `all` (urban crowd) or the tile has the Tiled property `encounter = true`. Then
 * `rng.chance(rate)`; on success a species is picked by weight. After any battle or map change the next
 * `SAFE_STEPS` completed steps never roll (every completed step counts, qualifying or not).
 */
import type { Rng } from '../core/rng';
import type { EncounterGroup } from '../data/schemas';
import { SAFE_STEPS } from './constants';

/** A rectangle from the map's `encounters` layer, in tiles. */
export interface EncounterRect {
  /** Key of the group in `zones.json › encounters`. */
  group: string;
  /** `tiles`: only tiles with `encounter = true`; `all`: every tile (urban crowd). */
  mode: 'tiles' | 'all';
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The group a step on tile (x, y) can trigger, or `null`. The first matching rectangle wins. */
export function encounterGroupAt(
  rects: readonly EncounterRect[],
  x: number,
  y: number,
  tileHasEncounter: boolean,
): string | null {
  for (const r of rects) {
    const inside = x >= r.x && y >= r.y && x < r.x + r.width && y < r.y + r.height;
    if (inside && (r.mode === 'all' || tileHasEncounter)) return r.group;
  }
  return null;
}

/** Roll one encounter for a group: `rng.chance(rate)`, then `rng.weighted`. Returns a species id or null. */
export function rollEncounter(group: EncounterGroup, rng: Rng): string | null {
  if (!rng.chance(group.rate)) return null;
  return rng.weighted(group.flexymon).id;
}

/** Safe steps to set after a battle or map change. */
export function resetSafeSteps(): number {
  return SAFE_STEPS;
}

/** Input for {@link checkStep}. */
export interface StepInput {
  safeSteps: number;
  rects: readonly EncounterRect[];
  groups: Readonly<Record<string, EncounterGroup>>;
  x: number;
  y: number;
  tileHasEncounter: boolean;
}

/**
 * Run the encounter check for one completed step. Returns the new safe-step count and the species id
 * of the wild flexymon (or null). No rng call happens during safe steps or on non-qualifying tiles.
 */
export function checkStep(input: StepInput, rng: Rng): { safeSteps: number; speciesId: string | null } {
  if (input.safeSteps > 0) return { safeSteps: input.safeSteps - 1, speciesId: null };
  const groupId = encounterGroupAt(input.rects, input.x, input.y, input.tileHasEncounter);
  const group = groupId === null ? undefined : input.groups[groupId];
  if (!group) return { safeSteps: 0, speciesId: null };
  return { safeSteps: 0, speciesId: rollEncounter(group, rng) };
}
