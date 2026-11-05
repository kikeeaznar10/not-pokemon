/**
 * Enemy NPC state rules (docs/GAME-RULES.md › Enemy NPCs). States `ready` and `cooldown`. A `ready` NPC sees
 * the player if the player stands in a straight line in front of it, at most `sight` tiles away, with no
 * blocking tile or NPC between them. After losing to the player an NPC is in `cooldown` (talks with
 * `defeatDialogue` only) until the player is more than `NPC_COOLDOWN_DISTANCE` tiles away (Manhattan) or
 * on another map. Losing resets every NPC to `ready`.
 */
import type { Facing } from '../data/schemas';
import { NPC_COOLDOWN_DISTANCE } from './constants';

/** State of one enemy NPC. */
export type NpcState = 'ready' | 'cooldown';

/** NPC id → state (stored in the save as `npcs`). */
export type NpcStates = Record<string, NpcState>;

/** A grid position. */
export interface Point {
  x: number;
  y: number;
}

/** Unit step for each facing (y grows downward, as in Tiled). */
export const FACING_DELTA: Readonly<Record<Facing, Point>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** Manhattan distance |dx| + |dy|. */
export function manhattan(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** What the sight check needs to know about the NPC. */
export interface Watcher extends Point {
  facing: Facing;
  sight: number;
}

/**
 * Distance at which the NPC sees the player (1 … sight), or `null` if it does not. `isBlocked(x, y)`
 * must return true for solid tiles and tiles holding another NPC; only tiles strictly between the two
 * are checked.
 */
export function sightDistance(
  npc: Watcher,
  player: Point,
  isBlocked: (x: number, y: number) => boolean,
): number | null {
  const d = FACING_DELTA[npc.facing];
  for (let i = 1; i <= npc.sight; i += 1) {
    const x = npc.x + d.x * i;
    const y = npc.y + d.y * i;
    if (x === player.x && y === player.y) return i;
    if (isBlocked(x, y)) return null;
  }
  return null;
}

/** True if a `ready` NPC spots the player (see {@link sightDistance}). A `cooldown` NPC never does. */
export function canSee(
  state: NpcState,
  npc: Watcher,
  player: Point,
  isBlocked: (x: number, y: number) => boolean,
): boolean {
  return state === 'ready' && sightDistance(npc, player, isBlocked) !== null;
}

/** Tiles the NPC walks through to end up adjacent to the player (empty if already adjacent). */
export function approachPath(npc: Watcher, player: Point): Point[] {
  const d = FACING_DELTA[npc.facing];
  const steps = manhattan(npc, player) - 1;
  const path: Point[] = [];
  for (let i = 1; i <= steps; i += 1) path.push({ x: npc.x + d.x * i, y: npc.y + d.y * i });
  return path;
}

/** True when a `cooldown` NPC should return to `ready`: other map, or Manhattan distance > 6. */
export function cooldownEnds(npc: Point, player: Point, sameMap: boolean): boolean {
  return !sameMap || manhattan(npc, player) > NPC_COOLDOWN_DISTANCE;
}

/** What talking to an enemy NPC does: start the battle sequence, or only say `defeatDialogue`. */
export function talkOutcome(state: NpcState): 'battle' | 'defeat_dialogue' {
  return state === 'ready' ? 'battle' : 'defeat_dialogue';
}

/** NPC position for {@link updateCooldowns}. */
export interface PlacedNpc extends Point {
  id: string;
  map: string;
}

/** Return every `cooldown` NPC whose cooldown has ended to `ready`. Returns a new record. */
export function updateCooldowns(
  states: Readonly<NpcStates>,
  npcs: readonly PlacedNpc[],
  player: Point & { map: string },
): NpcStates {
  const next: NpcStates = { ...states };
  for (const npc of npcs) {
    if (next[npc.id] === 'cooldown' && cooldownEnds(npc, player, npc.map === player.map))
      next[npc.id] = 'ready';
  }
  return next;
}

/** After the player wins: the NPC goes to `cooldown`. */
export function markDefeated(states: Readonly<NpcStates>, id: string): NpcStates {
  return { ...states, [id]: 'cooldown' };
}

/** After the player loses: every NPC back to `ready`. */
export function resetAllNpcs(states: Readonly<NpcStates>): NpcStates {
  return Object.fromEntries(Object.keys(states).map((id) => [id, 'ready' as const]));
}

/** State of an NPC (missing = `ready`). */
export function npcState(states: Readonly<NpcStates>, id: string): NpcState {
  return states[id] ?? 'ready';
}
