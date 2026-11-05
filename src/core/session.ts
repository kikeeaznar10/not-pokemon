/**
 * The live game state of this page session: team, storage, bag, euros, NPC states, player position.
 *
 * With no state set, {@link gameState} builds a new game from `start.json` on first use (`newGameState`,
 * player name `player.default_name`). Preload puts a loaded save here with {@link setGameState} (or
 * calls {@link resetGameState} for a new game), and `autosave.ts` keeps the player's position in it and
 * writes it to `localStorage`. Scenes read it with {@link gameState} and replace it with {@link setGameState};
 * the battle writes the team back when a battle ends. Nothing here computes rules.
 */
import { getGameData } from '../data/game-data';
import { t } from '../i18n';
import { newGameState } from '../logic/new-game';
import type { GameState } from '../logic/save';
import { rng } from './rng';

let current: GameState | null = null;

/** The current game state; a new game from `start.json` on first use. Needs the content loaded. */
export function gameState(): GameState {
  current ??= newGameState(getGameData(), rng, t('player.default_name'));
  return current;
}

/** Replace the whole game state (battle end, tests; later loading a save). */
export function setGameState(state: GameState): void {
  current = state;
}

/** Forget the state, so the next {@link gameState} starts a new game. */
export function resetGameState(): void {
  current = null;
}
