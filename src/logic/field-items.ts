/**
 * Items used outside battle (docs/CONTENT.md › Items; docs/GAME-RULES.md › Team and storage). The field menu (the Start menu's
 * Mochila) calls {@link useFieldItem}; nothing else in the game uses items in the field yet.
 *
 * Rules:
 * - Only items whose `usableIn` contains `"field"` can be used, and only while the bag holds one.
 * - `heal` / `heal_full` need a team member that is not fainted and not at full HP; `revive` needs a
 *   fainted team member (`targetUid`). Targets are team members only (the storage box is not reachable
 *   from the field menu).
 * - `team_slot` (Regleta) needs no target: +1 team slot, refused at `TEAM_MAX`.
 * - Every successful use consumes one item. `buff`, `key` and `catch` effects do nothing in the field
 *   (`not_usable_in_field`), even if content marks them `"field"`.
 * Pure: returns a new state; the input is never changed.
 */
import type { Item, Species } from '../data/schemas';
import { heal, healFull, isFainted, maxHp, revive, type FlexymonInstance } from './instance';
import { hasItem, removeItem } from './inventory';
import type { GameState } from './save';
import { addTeamSlot } from './team';

/** The content {@link useFieldItem} reads. `GameData` satisfies it. */
export interface FieldItemData {
  readonly flexymon: ReadonlyMap<string, Species>;
  readonly items: ReadonlyMap<string, Item>;
}

/** Why an item could not be used. */
export type FieldItemError =
  | 'unknown_item'
  | 'not_owned'
  | 'not_usable_in_field'
  | 'needs_target'
  | 'not_in_team'
  | 'no_effect'
  | 'max_slots';

/** What a successful use did (for the messages). */
export type FieldItemUse =
  | { type: 'heal'; uid: string; amount: number; hp: number; maxHp: number }
  | { type: 'revive'; uid: string; hp: number; maxHp: number }
  | { type: 'team_slot'; teamSlots: number };

/** Result of {@link useFieldItem}. */
export type FieldItemResult =
  { ok: true; state: GameState; use: FieldItemUse } | { ok: false; reason: FieldItemError };

/** True if `item` needs a team member picked first (heal, heal_full, revive). */
export function fieldItemNeedsTarget(item: Item): boolean {
  const type = item.effect.type;
  return type === 'heal' || type === 'heal_full' || type === 'revive';
}

/** Why `item` would do nothing to `target`, or `null` if it works. */
function targetError(item: Item, target: FlexymonInstance, species: Species): FieldItemError | null {
  switch (item.effect.type) {
    case 'heal':
    case 'heal_full':
      return isFainted(target) || target.currentHp >= maxHp(species, target) ? 'no_effect' : null;
    case 'revive':
      return isFainted(target) ? null : 'no_effect';
    default:
      return null;
  }
}

/**
 * Why `itemId` cannot be used now on `targetUid`, or `null` if it can. Menus use this to grey out
 * items and targets.
 */
export function fieldItemError(
  state: GameState,
  data: FieldItemData,
  itemId: string,
  targetUid?: string,
): FieldItemError | null {
  const item = data.items.get(itemId);
  if (!item) return 'unknown_item';
  if (!hasItem(state.items, itemId)) return 'not_owned';
  if (!item.usableIn.includes('field')) return 'not_usable_in_field';
  switch (item.effect.type) {
    case 'team_slot':
      return addTeamSlot(state).ok ? null : 'max_slots';
    case 'heal':
    case 'heal_full':
    case 'revive': {
      if (targetUid === undefined) return 'needs_target';
      const target = state.team.find((m) => m.uid === targetUid);
      if (!target) return 'not_in_team';
      const species = data.flexymon.get(target.speciesId);
      if (!species) return 'not_in_team';
      return targetError(item, target, species);
    }
    default:
      return 'not_usable_in_field';
  }
}

/**
 * Use one `itemId` from the bag outside battle (on team member `targetUid` for heal / heal_full /
 * revive). Returns the new game state and what happened, or why nothing happened.
 */
export function useFieldItem(
  state: GameState,
  data: FieldItemData,
  itemId: string,
  targetUid?: string,
): FieldItemResult {
  const err = fieldItemError(state, data, itemId, targetUid);
  if (err) return { ok: false, reason: err };
  const item = data.items.get(itemId) as Item;
  const items = removeItem(state.items, itemId, 1) ?? state.items;
  const effect = item.effect;

  if (effect.type === 'team_slot') {
    const teamSlots = state.teamSlots + 1;
    return { ok: true, state: { ...state, items, teamSlots }, use: { type: 'team_slot', teamSlots } };
  }

  const index = state.team.findIndex((m) => m.uid === targetUid);
  const target = state.team[index] as FlexymonInstance;
  const species = data.flexymon.get(target.speciesId) as Species;
  const max = maxHp(species, target);
  let instance: FlexymonInstance;
  let use: FieldItemUse;
  if (effect.type === 'revive') {
    instance = revive(species, target, effect.percent).instance;
    use = { type: 'revive', uid: target.uid, hp: instance.currentHp, maxHp: max };
  } else {
    const healed =
      effect.type === 'heal'
        ? heal(species, target, effect.amount)
        : { instance: healFull(species, target), healed: max - target.currentHp };
    instance = healed.instance;
    use = { type: 'heal', uid: target.uid, amount: healed.healed, hp: instance.currentHp, maxHp: max };
  }
  const team = state.team.map((m, i) => (i === index ? instance : m));
  return { ok: true, state: { ...state, items, team }, use };
}
