/**
 * NPC movement in the overworld (docs/PLAN.md › npcs.json and M5), pure so it can be unit-tested.
 *
 * Rules:
 * - `wander: null` → the NPC stands still (it still turns to face the player when talked to).
 * - A wanderer waits a random time in `stepEveryMs` [min, max] (`rng.int`), then moves one tile in a
 *   random direction (`rng.pick`) among those whose target tile is inside its wander rectangle and not
 *   blocked. If none is possible it waits again. Steps take `WALK_MS`, like the player's.
 * - `blocked(x, y)` is supplied by the scene: solid tiles, map edges, warp tiles, the player's tiles and
 *   every other NPC's tiles. While a step is in progress the NPC occupies BOTH its tiles
 *   ({@link occupiedTiles}), and so does the player, so the two can never end up on the same tile.
 * - Talking pauses the NPC ({@link startTalk}): a step in progress finishes, then it turns to face the
 *   player and stays still until {@link endTalk}, which starts a fresh wait.
 *
 * RNG call order (for seeded tests): one `int` per wait, then one `pick` per step attempt that has at
 * least one possible direction.
 */
import type { Rng } from '../core/rng';
import type { Facing } from '../data/schemas';
import { WALK_MS } from './constants';
import type { BlockedFn, MoveEvent, Step } from './movement';
import { FACING_DELTA, type Point } from './npc-state';

/** The wander rectangle (tiles) and wait range of an NPC (same shape as `npcs.json › wander`). */
export interface WanderArea {
  x: number;
  y: number;
  width: number;
  height: number;
  stepEveryMs: readonly [number, number];
}

/** Movement state of one NPC. `x`/`y` is its tile (the step's `from` while stepping). */
export interface NpcMove {
  x: number;
  y: number;
  facing: Facing;
  step: Step | null;
  /** Time left before the next step attempt (ms); `Infinity` for an NPC that never wanders. */
  waitMs: number;
  /** True while talking: no new steps. */
  talking: boolean;
  /** Facing to take once standing still (set when talked to during a step). */
  turnTo: Facing | null;
}

/** The four directions in a fixed order (keeps `rng.pick` deterministic). */
const DIRS: readonly Facing[] = ['up', 'down', 'left', 'right'];

/** The direction opposite `f` (an NPC talked to faces the opposite way of the player). */
export function oppositeFacing(f: Facing): Facing {
  return ({ up: 'down', down: 'up', left: 'right', right: 'left' } as const)[f];
}

/** True if the tile lies inside the wander rectangle. */
export function inWanderArea(area: WanderArea, x: number, y: number): boolean {
  return x >= area.x && y >= area.y && x < area.x + area.width && y < area.y + area.height;
}

/** A random wait in `[min, max]` ms, or `Infinity` when the NPC does not wander. */
export function nextWait(area: WanderArea | null, rng: Rng): number {
  return area ? rng.int(area.stepEveryMs[0], area.stepEveryMs[1]) : Infinity;
}

/** A standing NPC on its spawn tile, waiting for its first step. */
export function createNpcMove(
  x: number,
  y: number,
  facing: Facing,
  area: WanderArea | null,
  rng: Rng,
): NpcMove {
  return { x, y, facing, step: null, waitMs: nextWait(area, rng), talking: false, turnTo: null };
}

/** Tiles the NPC occupies: its own tile, plus the target tile while stepping. */
export function occupiedTiles(s: NpcMove): Point[] {
  return s.step ? [{ x: s.x, y: s.y }, { ...s.step.to }] : [{ x: s.x, y: s.y }];
}

/** Directions the NPC could step in now: target inside the area and not blocked. */
export function wanderChoices(s: Pick<NpcMove, 'x' | 'y'>, area: WanderArea, blocked: BlockedFn): Facing[] {
  return DIRS.filter((dir) => {
    const d = FACING_DELTA[dir];
    const x = s.x + d.x;
    const y = s.y + d.y;
    return inWanderArea(area, x, y) && !blocked(x, y);
  });
}

/**
 * Advance the NPC by `dtMs`. `blocked` is only called when a step would start. Returns the new state
 * and what happened (`turn`, `step_start`, `step_end`, same events as the player's movement).
 */
export function updateNpcMove(
  state: NpcMove,
  area: WanderArea | null,
  dtMs: number,
  blocked: BlockedFn,
  rng: Rng,
): { state: NpcMove; events: MoveEvent[] } {
  const events: MoveEvent[] = [];
  let s = state;

  if (s.step) {
    const elapsed = s.step.elapsed + dtMs;
    if (elapsed < WALK_MS) return { state: { ...s, step: { ...s.step, elapsed } }, events };
    const { to } = s.step;
    s = { ...s, x: to.x, y: to.y, step: null, waitMs: nextWait(area, rng) };
    events.push({ type: 'step_end', x: to.x, y: to.y });
  }

  if (s.turnTo) {
    if (s.turnTo !== s.facing) events.push({ type: 'turn', facing: s.turnTo });
    s = { ...s, facing: s.turnTo, turnTo: null };
  }
  if (s.talking || !area || events.length > 0) return { state: s, events };

  const waitMs = s.waitMs - dtMs;
  if (waitMs > 0) return { state: { ...s, waitMs }, events };

  const choices = wanderChoices(s, area, blocked);
  if (choices.length === 0) return { state: { ...s, waitMs: nextWait(area, rng) }, events };
  const dir = rng.pick(choices);
  const d = FACING_DELTA[dir];
  const from = { x: s.x, y: s.y };
  const to = { x: s.x + d.x, y: s.y + d.y };
  if (dir !== s.facing) events.push({ type: 'turn', facing: dir });
  events.push({ type: 'step_start', from, to });
  return { state: { ...s, facing: dir, step: { from, to, elapsed: 0 }, waitMs: 0 }, events };
}

/**
 * The player starts talking to the NPC: it stops wandering and turns to face `playerFacing`'s
 * opposite (at once if standing, else as soon as its step ends).
 */
export function startTalk(s: NpcMove, playerFacing: Facing): NpcMove {
  const face = oppositeFacing(playerFacing);
  if (s.step) return { ...s, talking: true, turnTo: face };
  return { ...s, talking: true, facing: face, turnTo: null };
}

/** The conversation ended: the NPC waits a fresh random time before wandering again. */
export function endTalk(s: NpcMove, area: WanderArea | null, rng: Rng): NpcMove {
  return { ...s, talking: false, waitMs: nextWait(area, rng) };
}

/**
 * The tile the NPC will stand on once its current step ends (its own tile when standing). The player
 * can talk to an NPC whose arrival tile is the tile in front of the player.
 */
export function arrivalTile(s: NpcMove): Point {
  return s.step ? { ...s.step.to } : { x: s.x, y: s.y };
}
