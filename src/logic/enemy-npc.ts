/**
 * Enemy NPC battles (docs/GAME-RULES.md › Enemy NPCs, Losing), pure so the overworld and battle scenes only
 * play the results:
 * - {@link findSpotter}: which `ready` enemy NPC sees the player right now (first in the list given, which
 *   is `npcs.json` order) and the tiles it walks to end up adjacent.
 * - {@link npcTeam}: fresh instances (zero bonus, full HP) of an enemy's `team`, in order, for each battle.
 * - {@link winAgainstNpc}: euros `+= rng.int(min, max)` (clamped) and the NPC goes to `cooldown`.
 * - {@link loseBattle}: the Losing rule: euros halved (floor), team and storage fully healed, every enemy
 *   NPC `ready`, the player placed at `start.json › respawn`.
 * - {@link placedEnemies} + {@link refreshCooldowns}: return `cooldown` NPCs to `ready` once the player is
 *   more than `NPC_COOLDOWN_DISTANCE` tiles away (Manhattan) or on another map.
 */
import type { Rng } from '../core/rng';
import type { EnemyNpc, Facing, MapPoint, Npc, Species } from '../data/schemas';
import { addEuros, lossPenalty, rollReward } from './economy';
import { createInstance, type FlexymonInstance } from './instance';
import {
  approachPath,
  markDefeated,
  npcState,
  resetAllNpcs,
  sightDistance,
  updateCooldowns,
  type NpcStates,
  type PlacedNpc,
  type Point,
} from './npc-state';
import type { GameState } from './save';
import { healParty } from './team';

/** An enemy NPC as the sight check sees it: its tile, facing, sight range and whether it may look now. */
export interface Lookout extends Point {
  id: string;
  facing: Facing;
  sight: number;
  /** False while the NPC is stepping or talking: it only looks while standing free. */
  free: boolean;
}

/** An enemy that spotted the player: who, how far, and the tiles it walks through (may be empty). */
export interface Sighting {
  id: string;
  distance: number;
  path: Point[];
}

/** True for the enemy NPC type (narrows the union). */
export function isEnemy(npc: Readonly<Npc>): npc is Readonly<EnemyNpc> {
  return npc.type === 'enemy';
}

/**
 * The first free, `ready` enemy that sees the player (see `sightDistance`), or `null`. `isBlocked(x, y)`
 * must be true for solid tiles and tiles taken by any NPC; only tiles strictly between are checked.
 */
export function findSpotter(
  enemies: readonly Lookout[],
  states: Readonly<NpcStates>,
  player: Point,
  isBlocked: (x: number, y: number) => boolean,
): Sighting | null {
  for (const e of enemies) {
    if (!e.free || npcState(states, e.id) !== 'ready') continue;
    const distance = sightDistance(e, player, isBlocked);
    if (distance !== null) return { id: e.id, distance, path: approachPath(e, player) };
  }
  return null;
}

/** Fresh instances of the enemy's team, in order. Throws on an unknown species (checked at boot). */
export function npcTeam(
  npc: Pick<EnemyNpc, 'id' | 'team'>,
  flexymon: ReadonlyMap<string, Species>,
  rng: Rng,
): FlexymonInstance[] {
  return npc.team.map((id) => {
    const species = flexymon.get(id);
    if (!species) throw new Error(`npcTeam: unknown flexymon "${id}" in the team of "${npc.id}"`);
    return createInstance(species, rng);
  });
}

/** The player beat `npc`: roll the reward (one `rng.int`), add it, and put the NPC in `cooldown`. */
export function winAgainstNpc(
  state: GameState,
  npc: Pick<EnemyNpc, 'id' | 'reward'>,
  rng: Rng,
): { state: GameState; reward: number } {
  const reward = rollReward(npc.reward, rng);
  return {
    state: { ...state, euros: addEuros(state.euros, reward), npcs: markDefeated(state.npcs, npc.id) },
    reward,
  };
}

/** The Losing rule. Needs the species (for max HP) and the respawn point. */
export function loseBattle(
  state: GameState,
  data: { readonly flexymon: ReadonlyMap<string, Species>; readonly start: { readonly respawn: MapPoint } },
): GameState {
  const party = healParty(
    { team: state.team, storage: state.storage, teamSlots: state.teamSlots },
    data.flexymon,
  );
  return {
    ...state,
    euros: lossPenalty(state.euros),
    team: party.team,
    storage: party.storage,
    npcs: resetAllNpcs(state.npcs),
    player: { name: state.player.name, ...structuredClone(data.start.respawn) },
  };
}

/**
 * Where every enemy NPC is, for the cooldown check: the live tile for those on `mapId` (from `positions`,
 * falling back to the spawn), the spawn for the others (they are on another map, which is all that counts).
 */
export function placedEnemies(
  all: Iterable<Readonly<Npc>>,
  mapId: string,
  positions: ReadonlyMap<string, Point>,
): PlacedNpc[] {
  const out: PlacedNpc[] = [];
  for (const npc of all) {
    if (!isEnemy(npc)) continue;
    const at = npc.map === mapId ? (positions.get(npc.id) ?? npc.spawn) : npc.spawn;
    out.push({ id: npc.id, map: npc.map, x: at.x, y: at.y });
  }
  return out;
}

/** Return the NPC states with every finished cooldown back to `ready` (same object if nothing changed). */
export function refreshCooldowns(
  states: Readonly<NpcStates>,
  enemies: readonly PlacedNpc[],
  player: Point & { map: string },
): Readonly<NpcStates> {
  const next = updateCooldowns(states, enemies, player);
  const changed = Object.keys(next).some((id) => next[id] !== states[id]);
  return changed ? next : states;
}
