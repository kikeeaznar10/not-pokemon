/**
 * Start menu rules (M10, docs/PLAN.md › M10): what the Equipo, Mochila and Opciones screens show and
 * what their actions do, so the MenuScene computes nothing.
 *
 * - The menu lists *Equipo, Mochila, Mapa, Opciones, Cerrar* ({@link START_MENU}).
 * - Equipo: the team in battle order (icon, name, "PS hp/max", fainted greyed; rows from `boxRows`).
 *   A detail page shows the four stats as `base + bonus` ({@link flexymonDetail}) and the attacks.
 *   *Mover* puts the flexymon at another position (`reorderTeam`): the first one is sent into battle first.
 * - Mochila: every item with a count above 0, in bag order, with its description ({@link bagRows}).
 *   Only items usable in the field (`usableIn` has `"field"` and the effect is heal / heal_full / revive /
 *   team_slot) can be chosen; the others are listed greyed. Heal and revive items ask for a team member
 *   ({@link bagTargetRows}: members the item would do nothing to are greyed); the Regleta is used at once.
 *   The use itself is `useFieldItem` (`field-items.ts`), and {@link fieldUseMessages} /
 *   {@link fieldErrorMessage} word the result.
 */
import type { Item, Species, Attack } from '../data/schemas';
import type { Translate } from './battle-view';
import { fieldItemError, type FieldItemError, type FieldItemUse } from './field-items';
import { isFainted, maxHp, STAT_KEYS, type FlexymonInstance, type StatKey } from './instance';
import type { GameState } from './save';
import { boxRows, type BoxRow } from './storage-box';

/** An entry of the Start menu. */
export type StartMenuEntry = 'team' | 'bag' | 'map' | 'options' | 'close';

/** The Start menu entries, top to bottom (labels: `menu.<entry>` in `es.json`). */
export const START_MENU: readonly StartMenuEntry[] = ['team', 'bag', 'map', 'options', 'close'];

/** The content the menu reads. `GameData` satisfies it. */
export interface MenuData {
  readonly flexymon: ReadonlyMap<string, Species>;
  readonly attacks: ReadonlyMap<string, Attack>;
  readonly items: ReadonlyMap<string, Item>;
}

/** The team in battle order, one row per member (icon, name, HP, fainted). */
export function teamRows(state: GameState, data: Pick<MenuData, 'flexymon'>): BoxRow[] {
  return boxRows(state, 'team', data.flexymon);
}

/** One stat on the detail page: its value and how it is made (`value = base + bonus`). */
export interface StatLine {
  stat: StatKey;
  value: number;
  base: number;
  bonus: number;
}

/** One attack on the detail page. */
export interface AttackLine {
  id: string;
  name: string;
  accuracy: number;
}

/** The detail page of a team member. */
export interface FlexymonDetail {
  uid: string;
  name: string;
  /** Front sprite (texture key = its path). */
  sprite: string;
  hp: number;
  maxHp: number;
  fainted: boolean;
  /** HP, Ataque, Defensa, Velocidad, in that order. */
  stats: StatLine[];
  attacks: AttackLine[];
}

/** The detail page of `inst`, or `null` if its species is unknown. Unknown attacks are left out. */
export function flexymonDetail(
  inst: FlexymonInstance,
  data: Pick<MenuData, 'flexymon' | 'attacks'>,
): FlexymonDetail | null {
  const species = data.flexymon.get(inst.speciesId);
  if (!species) return null;
  return {
    uid: inst.uid,
    name: species.name,
    sprite: species.sprite.front,
    hp: inst.currentHp,
    maxHp: maxHp(species, inst),
    fainted: isFainted(inst),
    stats: STAT_KEYS.map((stat) => ({
      stat,
      base: species.stats[stat],
      bonus: inst.bonus[stat],
      value: species.stats[stat] + inst.bonus[stat],
    })),
    attacks: species.attacks.flatMap((id) => {
      const a = data.attacks.get(id);
      return a ? [{ id, name: a.name, accuracy: a.accuracy }] : [];
    }),
  };
}

/** True if `item` can be used from the Mochila at all (its effect does something outside battle). */
export function fieldUsable(item: Item): boolean {
  const type = item.effect.type;
  return (
    item.usableIn.includes('field') &&
    (type === 'heal' || type === 'heal_full' || type === 'revive' || type === 'team_slot')
  );
}

/** One row of the Mochila. */
export interface BagRow {
  itemId: string;
  name: string;
  description: string;
  icon: string;
  count: number;
  /** False: listed greyed (not usable outside battle). */
  usable: boolean;
}

/** Every item in the bag with a count above 0, in bag order. Unknown item ids are skipped. */
export function bagRows(state: GameState, data: Pick<MenuData, 'items'>): BagRow[] {
  return Object.entries(state.items).flatMap(([itemId, count]) => {
    const item = data.items.get(itemId);
    if (!item || count <= 0) return [];
    return [
      {
        itemId,
        name: item.name,
        description: item.description,
        icon: item.sprite,
        count,
        usable: fieldUsable(item),
      },
    ];
  });
}

/** One team member offered as the target of a Mochila item. */
export interface BagTargetRow extends BoxRow {
  /** False: the item would do nothing to it (greyed). */
  enabled: boolean;
}

/** The team as targets for `itemId` (heal / revive items); `enabled` = the item works on that member. */
export function bagTargetRows(
  state: GameState,
  data: Pick<MenuData, 'flexymon' | 'items'>,
  itemId: string,
): BagTargetRow[] {
  return teamRows(state, data).map((r) => ({
    ...r,
    enabled: fieldItemError(state, data, itemId, r.uid) === null,
  }));
}

/** The messages after using `itemName` in the field (one box each). */
export function fieldUseMessages(
  use: FieldItemUse,
  itemName: string,
  state: GameState,
  data: Pick<MenuData, 'flexymon'>,
  t: Translate,
): string[] {
  if (use.type === 'team_slot')
    return [t('bag.used', { item: itemName }), t('bag.slots', { n: use.teamSlots })];
  const inst = state.team.find((m) => m.uid === use.uid);
  const name = (inst && data.flexymon.get(inst.speciesId)?.name) ?? '';
  const first = t('bag.used_on', { item: itemName, name });
  if (use.type === 'revive') return [first, t('bag.revived', { name })];
  return [first, t('bag.healed', { name, amount: use.amount })];
}

/** Why an item could not be used, as a message. */
export function fieldErrorMessage(reason: FieldItemError, t: Translate): string {
  if (reason === 'max_slots') return t('bag.max_slots');
  if (reason === 'no_effect') return t('bag.no_effect');
  return t('bag.cannot_use');
}
