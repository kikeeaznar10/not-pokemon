/**
 * Team and storage (docs/PLAN.md › Team and storage). The team holds up to `teamSlots` flexymon
 * (starts at `start.json › teamSlots`, +1 per Regleta, max `TEAM_MAX`); storage has no limit. The team
 * can never be empty: the last member cannot be moved to storage. All functions are pure.
 */
import type { Species } from '../data/schemas';
import { TEAM_MAX } from './constants';
import { healFull, type FlexymonInstance } from './instance';

/** The player's flexymon: team (in battle order), storage box, and the team size limit. */
export interface Party {
  team: FlexymonInstance[];
  storage: FlexymonInstance[];
  teamSlots: number;
}

/** Why a team operation failed. */
export type TeamError = 'not_found' | 'last_member' | 'team_full' | 'max_slots';

/** A team operation result: the new party, or the reason it was refused. */
export type TeamResult = { ok: true; party: Party } | { ok: false; reason: TeamError };

/** True if the team has a free slot. */
export function hasFreeSlot(party: Party): boolean {
  return party.team.length < party.teamSlots;
}

/** Add a new flexymon: to the team if there is a free slot, otherwise to storage. */
export function addFlexymon(party: Party, inst: FlexymonInstance): { party: Party; to: 'team' | 'storage' } {
  if (hasFreeSlot(party)) return { party: { ...party, team: [...party.team, inst] }, to: 'team' };
  return { party: { ...party, storage: [...party.storage, inst] }, to: 'storage' };
}

/** Move a team member to storage. Refused for the last team member. */
export function moveToStorage(party: Party, uid: string): TeamResult {
  const inst = party.team.find((m) => m.uid === uid);
  if (!inst) return { ok: false, reason: 'not_found' };
  if (party.team.length <= 1) return { ok: false, reason: 'last_member' };
  return {
    ok: true,
    party: { ...party, team: party.team.filter((m) => m !== inst), storage: [...party.storage, inst] },
  };
}

/** Move a stored flexymon to the end of the team. Refused when the team is full. */
export function moveToTeam(party: Party, uid: string): TeamResult {
  const inst = party.storage.find((m) => m.uid === uid);
  if (!inst) return { ok: false, reason: 'not_found' };
  if (!hasFreeSlot(party)) return { ok: false, reason: 'team_full' };
  return {
    ok: true,
    party: { ...party, storage: party.storage.filter((m) => m !== inst), team: [...party.team, inst] },
  };
}

/** Move a team member to position `index` (0 = first sent into battle); `index` is clamped. */
export function reorderTeam(party: Party, uid: string, index: number): TeamResult {
  const from = party.team.findIndex((m) => m.uid === uid);
  if (from < 0) return { ok: false, reason: 'not_found' };
  const team = [...party.team];
  const [inst] = team.splice(from, 1);
  team.splice(Math.max(0, Math.min(index, team.length)), 0, inst as FlexymonInstance);
  return { ok: true, party: { ...party, team } };
}

/** Add one team slot (the Regleta effect). Refused at `TEAM_MAX`. */
export function addTeamSlot(party: Party): TeamResult {
  if (party.teamSlots >= TEAM_MAX) return { ok: false, reason: 'max_slots' };
  return { ok: true, party: { ...party, teamSlots: party.teamSlots + 1 } };
}

/** First instance of a species: team first, then storage (used by merging). */
export function findOwned(
  party: Party,
  speciesId: string,
): { where: 'team' | 'storage'; index: number; instance: FlexymonInstance } | null {
  for (const where of ['team', 'storage'] as const) {
    const index = party[where].findIndex((m) => m.speciesId === speciesId);
    if (index >= 0) return { where, index, instance: party[where][index] as FlexymonInstance };
  }
  return null;
}

/** Replace the instance with the same uid (team or storage). Unknown uid → party unchanged. */
export function replaceInstance(party: Party, inst: FlexymonInstance): Party {
  const swap = (list: FlexymonInstance[]) => list.map((m) => (m.uid === inst.uid ? inst : m));
  return { ...party, team: swap(party.team), storage: swap(party.storage) };
}

/** Fully heal (and revive) every team and storage flexymon (office healer, losing). */
export function healParty(party: Party, species: ReadonlyMap<string, Species>): Party {
  const healAll = (list: FlexymonInstance[]) =>
    list.map((m) => {
      const sp = species.get(m.speciesId);
      return sp ? healFull(sp, m) : m;
    });
  return { ...party, team: healAll(party.team), storage: healAll(party.storage) };
}
