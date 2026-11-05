/**
 * Debug menu commands that change the game state (M15). Pure: they take the state and return a new one.
 *
 * - {@link giveEuros}: "Dar {n} €" adds `DEBUG_GIVE_EUROS`, clamped to `EUROS_MAX` like every gain.
 * - {@link giveItem}: "Dar: {item}" adds `DEBUG_GIVE_ITEMS` of one item, capped at `ITEM_COUNT_MAX`. Any item can be
 *   given, key items included (that is how a tester gets the Audi items fast).
 */
import { DEBUG_GIVE_EUROS, DEBUG_GIVE_ITEMS } from './constants';
import { addEuros } from './economy';
import { addItem } from './inventory';
import type { GameState } from './save';

/** The state with `n` (default `DEBUG_GIVE_EUROS`) more euros, clamped. */
export function giveEuros(state: GameState, n: number = DEBUG_GIVE_EUROS): GameState {
  return { ...state, euros: addEuros(state.euros, n) };
}

/** The state with `n` (default `DEBUG_GIVE_ITEMS`) more of `itemId` in the bag, capped; `added` says how many fit. */
export function giveItem(
  state: GameState,
  itemId: string,
  n: number = DEBUG_GIVE_ITEMS,
): { state: GameState; added: number } {
  const result = addItem(state.items, itemId, n);
  return { state: { ...state, items: result.items }, added: result.added };
}
