/**
 * The state of a new game (docs/CONTENT.md › The new game): the starter flexymon
 * (zero bonus, full HP) alone in the team, the starting euros, team slots and items, the player on
 * the spawn point, no NPC states (every NPC starts `ready`). Pure; the starter's `uid` comes from `rng.id()`.
 */
import type { Rng } from '../core/rng';
import type { Species, Start } from '../data/schemas';
import { createInstance } from './instance';
import type { GameState } from './save';

/** The content a new game reads. `GameData` satisfies it. */
export interface NewGameData {
  readonly flexymon: ReadonlyMap<string, Species>;
  readonly start: Start;
}

/** Build the state of a new game for a player called `name`. Throws if the starter species is unknown. */
export function newGameState(data: NewGameData, rng: Rng, name: string): GameState {
  const { start } = data;
  const starter = data.flexymon.get(start.starter);
  if (!starter) throw new Error(`newGameState: unknown starter "${start.starter}"`);
  return {
    player: { name, ...structuredClone(start.spawn) },
    euros: start.euros,
    teamSlots: start.teamSlots,
    team: [createInstance(starter, rng)],
    storage: [],
    items: { ...start.items },
    npcs: {},
  };
}
