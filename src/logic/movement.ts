/**
 * Grid movement of the player. Pure: the scene feeds the held direction and the
 * frame time, and draws the result.
 *
 * Rules:
 * - One tile per step, a step takes `WALK_MS`; a step that started always finishes (never stops
 *   between tiles), so a short press of the facing direction moves exactly one tile.
 * - Standing still, pressing a different direction turns in place first; if it is still held after
 *   `TURN_TAP_MS` the player starts walking. Pressing the direction already faced walks at once.
 * - When a step ends and a direction is still held, the next step starts in the same frame (the time
 *   left over carries on, so walking never stutters). Changing direction while walking needs no delay.
 * - A blocked tile (solid, outside the map; the caller decides) only turns the player to face it.
 */
import type { Facing } from '../data/schemas';
import { TURN_TAP_MS, WALK_MS } from './constants';
import { FACING_DELTA, type Point } from './npc-state';

/** A step in progress: from one tile to the next, `elapsed` ms into it. */
export interface Step {
  from: Point;
  to: Point;
  elapsed: number;
}

/** The player's movement state. `x`/`y` is the tile it stands on (the step's `from` while moving). */
export interface MoveState {
  x: number;
  y: number;
  facing: Facing;
  step: Step | null;
  /** Direction held while standing still, and for how long; used for the tap-to-turn rule. */
  hold: { dir: Facing; ms: number; turned: boolean } | null;
}

/** What happened during an update (in order). */
export type MoveEvent =
  | { type: 'turn'; facing: Facing }
  | { type: 'step_start'; from: Point; to: Point }
  | { type: 'step_end'; x: number; y: number };

/** Returns true if the tile cannot be entered (solid, out of bounds, occupied). */
export type BlockedFn = (x: number, y: number) => boolean;

/** A standing player on a tile. */
export function createMoveState(x: number, y: number, facing: Facing): MoveState {
  return { x, y, facing, step: null, hold: null };
}

/** Try to start a step in `dir` with `elapsed` ms already spent; turns only if blocked. */
function tryStep(
  s: MoveState,
  dir: Facing,
  elapsed: number,
  blocked: BlockedFn,
  events: MoveEvent[],
): MoveState {
  const d = FACING_DELTA[dir];
  const to = { x: s.x + d.x, y: s.y + d.y };
  if (s.facing !== dir) events.push({ type: 'turn', facing: dir });
  if (blocked(to.x, to.y)) return { ...s, facing: dir, step: null };
  const from = { x: s.x, y: s.y };
  events.push({ type: 'step_start', from, to });
  return { ...s, facing: dir, step: { from, to, elapsed } };
}

/**
 * Advance movement by `dtMs` with `dir` held (or `null`). Returns the new state and the events.
 * Pass `blocked` for the CURRENT map (it is called when a step would start), and `freshPress = true`
 * when `dir` was pressed during this frame.
 */
export function updateMovement(
  state: MoveState,
  dir: Facing | null,
  dtMs: number,
  blocked: BlockedFn,
  freshPress = false,
): { state: MoveState; events: MoveEvent[] } {
  const events: MoveEvent[] = [];
  // A new key press while standing is always a new press, even if the previous tap's release and this
  // press happened between two frames (otherwise a quick second tap would be taken as one long hold).
  let s = freshPress && !state.step ? { ...state, hold: null } : state;

  if (s.step) {
    const elapsed = s.step.elapsed + dtMs;
    if (elapsed < WALK_MS) return { state: { ...s, step: { ...s.step, elapsed } }, events };
    const { to } = s.step;
    s = { ...s, x: to.x, y: to.y, step: null, hold: null };
    events.push({ type: 'step_end', x: to.x, y: to.y });
    if (dir === null) return { state: s, events };
    s = tryStep(s, dir, Math.min(elapsed - WALK_MS, WALK_MS - 1), blocked, events);
    if (!s.step) s = { ...s, hold: { dir, ms: 0, turned: false } };
    return { state: s, events };
  }

  if (dir === null) return { state: { ...s, hold: null }, events };

  if (!s.hold || s.hold.dir !== dir) {
    // A new press while standing still.
    if (dir !== s.facing) {
      events.push({ type: 'turn', facing: dir });
      return { state: { ...s, facing: dir, hold: { dir, ms: 0, turned: true } }, events };
    }
    s = { ...s, hold: { dir, ms: 0, turned: false } };
    const next = tryStep(s, dir, 0, blocked, events);
    return { state: next.step ? { ...next, hold: null } : next, events };
  }

  const hold = { ...s.hold, ms: s.hold.ms + dtMs };
  if (hold.turned && hold.ms < TURN_TAP_MS) return { state: { ...s, hold }, events };
  const next = tryStep({ ...s, hold }, dir, 0, blocked, events);
  return { state: next.step ? { ...next, hold: null } : next, events };
}

/** Position in tiles (fractional while stepping), for drawing. Also used for NPCs. */
export function renderPosition(state: Pick<MoveState, 'x' | 'y' | 'step'>): { x: number; y: number } {
  if (!state.step) return { x: state.x, y: state.y };
  const t = Math.min(1, state.step.elapsed / WALK_MS);
  const { from, to } = state.step;
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}

/** Walk frame to show: 1 (stride) during the first half of a step, else 0 (standing). */
export function walkFrame(state: Pick<MoveState, 'step'>): 0 | 1 {
  return state.step && state.step.elapsed < WALK_MS / 2 ? 1 : 0;
}

/**
 * Stop on tile (x, y), keeping the facing (a wild encounter at the end of a step). A step that
 * already started from that tile in the same frame (the direction was held) is dropped, so the player
 * stands still on the encounter tile.
 */
export function haltAt(state: MoveState, x: number, y: number): MoveState {
  return createMoveState(x, y, state.facing);
}
