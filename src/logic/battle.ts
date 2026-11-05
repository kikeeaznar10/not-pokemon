/**
 * The battle state machine (docs/GAME-RULES.md › Battle flow, Hit and damage, Buffs and debuffs).
 *
 * `createBattle()` builds a plain-data {@link BattleState}. Each player decision goes through
 * `chooseAction(state, action, ctx)`, which returns the next state plus the list of
 * {@link BattleEvent}s the BattleScene animates in order. The scene never computes rules; it only asks
 * `actionError()` / `availableSwitches()` / `battleItems()` what it may offer.
 *
 * Round order: Huir ends the battle at once (fleeing always works against wild flexymon). Otherwise the
 * opponent picks its attack (one AI call), then actions resolve as Cambiar → Objeto → attacks. When both attack, the higher effective speed goes first; a tie is
 * `rng.chance(50)` (true = player first). A flexymon that faints skips the rest of the round. At the end
 * of a round every modifier loses a turn. RNG call order per round (fixed, so seeds replay exactly):
 * AI choice → speed tie (only on a tie) → for each attack: hit roll, then damage roll (damage only).
 *
 * Event `who` field: for `attack` and `miss` it is the attacker; for every other event it is the side
 * whose flexymon is affected.
 */
import type { Rng } from '../core/rng';
import type { Attack, Item, Species } from '../data/schemas';
import { chooseOpponentAttack, type OpponentKind } from './ai';
import { computeDamage, healAmount, rollDamageFactor, rollHit } from './damage';
import {
  heal as healInstance,
  healFull,
  isFainted,
  maxHp,
  revive as reviveInstance,
  statValue,
  takeDamage,
  type FlexymonInstance,
} from './instance';
import { applyModifier, effectiveStat, tickModifiers, type Modifier } from './modifiers';

/** A side of the battle. */
export type Side = 'player' | 'opponent';

/** Wild flexymon (fleeing allowed, catchable) or an NPC enemy (no fleeing, several flexymon). */
export type BattleKind = OpponentKind;

/** How a battle ended. */
export type BattleResult = 'win' | 'lose' | 'fled';

/**
 * - `choose`: waiting for the player's action for a new round.
 * - `must_switch`: the player's active fainted and another is alive; only `switch` is allowed and it
 *   does not cost a turn.
 * - `ended`: see `result`.
 */
export type BattlePhase = 'choose' | 'must_switch' | 'ended';

/** One side: its team (in order), the index of the active member, and the active's modifiers. */
export interface BattleSide {
  team: FlexymonInstance[];
  active: number;
  mods: Modifier[];
}

/** Whole battle state. Plain data; never mutated by the functions here. */
export interface BattleState {
  kind: BattleKind;
  phase: BattlePhase;
  result: BattleResult | null;
  /** Rounds played so far. */
  round: number;
  player: BattleSide;
  opponent: BattleSide;
  /** The player's bag during the battle (item id → count). Items used here are subtracted. */
  items: Record<string, number>;
}

/** What the player can do. */
export type BattleAction =
  | { type: 'attack'; attackId: string }
  | { type: 'switch'; uid: string }
  /** `targetUid` is any team member for heal/revive; buff items always go on the active one. */
  | { type: 'item'; itemId: string; targetUid: string }
  | { type: 'flee' };

/** Things the scene animates, in order. See the module comment for the meaning of `who`. */
export type BattleEvent =
  | { type: 'appear'; who: Side; uid: string; speciesId: string }
  | { type: 'attack'; who: Side; uid: string; attackId: string }
  | { type: 'miss'; who: Side; uid: string }
  | { type: 'damage'; who: Side; uid: string; amount: number; hp: number; maxHp: number }
  | { type: 'heal'; who: Side; uid: string; amount: number; hp: number; maxHp: number }
  | { type: 'revive'; who: Side; uid: string; hp: number; maxHp: number }
  | {
      type: 'modifier';
      who: Side;
      uid: string;
      kind: 'buff' | 'debuff';
      stat: Modifier['stat'];
      percent: number;
      turns: number;
    }
  | { type: 'modifier_end'; who: Side; uid: string; kind: 'buff' | 'debuff'; stat: Modifier['stat'] }
  | { type: 'faint'; who: Side; uid: string }
  | { type: 'switch'; who: Side; fromUid: string; toUid: string }
  | { type: 'item'; who: 'player'; itemId: string; targetUid: string }
  | { type: 'flee'; who: 'player' }
  /** The player must pick a replacement (phase `must_switch`). */
  | { type: 'need_switch'; who: 'player' }
  | { type: 'end'; result: BattleResult };

/** The content the battle reads. `GameData` satisfies it. */
export interface BattleData {
  readonly flexymon: ReadonlyMap<string, Species>;
  readonly attacks: ReadonlyMap<string, Attack>;
  readonly items: ReadonlyMap<string, Item>;
}

/** Content plus the random generator. */
export interface BattleContext {
  data: BattleData;
  rng: Rng;
}

/** Result of one step of the state machine. */
export interface BattleStep {
  state: BattleState;
  events: BattleEvent[];
}

/** Why an action is not allowed (see {@link actionError}). */
export type ActionError =
  | 'battle_over'
  | 'must_switch'
  | 'unknown_attack'
  | 'not_in_team'
  | 'already_active'
  | 'fainted'
  | 'not_owned'
  | 'not_usable_in_battle'
  | 'no_effect'
  | 'cannot_flee';

const other = (who: Side): Side => (who === 'player' ? 'opponent' : 'player');

function lookup<T>(map: ReadonlyMap<string, T>, id: string, what: string): T {
  const v = map.get(id);
  if (!v) throw new Error(`battle: unknown ${what} "${id}"`);
  return v;
}

function activeOf(side: BattleSide): FlexymonInstance {
  const inst = side.team[side.active];
  if (!inst) throw new Error('battle: side has no active flexymon');
  return inst;
}

const firstAlive = (team: readonly FlexymonInstance[]): number => team.findIndex((m) => !isFainted(m));

/**
 * Start a battle. Each side sends out its first non-fainted flexymon. Throws if either side has none.
 * Instances are copied, so the caller's team is never changed; read the final team from the state.
 */
export function createBattle(
  player: readonly FlexymonInstance[],
  opponent: readonly FlexymonInstance[],
  kind: BattleKind,
  items: Readonly<Record<string, number>> = {},
): BattleState {
  const p = firstAlive(player);
  const o = firstAlive(opponent);
  if (p < 0) throw new Error('createBattle: the player has no flexymon able to fight');
  if (o < 0) throw new Error('createBattle: the opponent has no flexymon able to fight');
  return {
    kind,
    phase: 'choose',
    result: null,
    round: 0,
    player: { team: structuredClone([...player]), active: p, mods: [] },
    opponent: { team: structuredClone([...opponent]), active: o, mods: [] },
    items: { ...items },
  };
}

/** Events for the start of the battle: the opponent appears, then the player sends out its active. */
export function introEvents(state: BattleState): BattleEvent[] {
  const o = activeOf(state.opponent);
  const p = activeOf(state.player);
  return [
    { type: 'appear', who: 'opponent', uid: o.uid, speciesId: o.speciesId },
    { type: 'appear', who: 'player', uid: p.uid, speciesId: p.speciesId },
  ];
}

/** The active flexymon of a side. */
export function activeFlexymon(state: BattleState, who: Side): FlexymonInstance {
  return activeOf(state[who]);
}

/** Team members the player may switch to: alive and not active. */
export function availableSwitches(state: BattleState): FlexymonInstance[] {
  const side = state.player;
  return side.team.filter((m, i) => i !== side.active && !isFainted(m));
}

/** Items in the bag (count > 0) whose `usableIn` contains `"battle"`, in the bag's order. */
export function battleItems(state: BattleState, data: BattleData): string[] {
  return Object.keys(state.items).filter((id) => {
    const item = data.items.get(id);
    return (state.items[id] ?? 0) > 0 && item !== undefined && item.usableIn.includes('battle');
  });
}

/** Whether `item` would do anything to `target` (the active flexymon for buffs). */
function itemError(item: Item, target: FlexymonInstance, species: Species): ActionError | null {
  switch (item.effect.type) {
    case 'heal':
    case 'heal_full':
      return isFainted(target) || target.currentHp >= maxHp(species, target) ? 'no_effect' : null;
    case 'revive':
      return isFainted(target) ? null : 'no_effect';
    case 'buff':
      return null;
    default:
      return 'not_usable_in_battle';
  }
}

/** Why `action` is not allowed right now, or `null` if it is. The scene uses this to grey out options. */
export function actionError(state: BattleState, action: BattleAction, data: BattleData): ActionError | null {
  if (state.phase === 'ended') return 'battle_over';
  if (state.phase === 'must_switch' && action.type !== 'switch') return 'must_switch';
  const side = state.player;
  switch (action.type) {
    case 'attack': {
      const species = lookup(data.flexymon, activeOf(side).speciesId, 'flexymon');
      return species.attacks.includes(action.attackId) ? null : 'unknown_attack';
    }
    case 'switch': {
      const i = side.team.findIndex((m) => m.uid === action.uid);
      if (i < 0) return 'not_in_team';
      if (i === side.active) return 'already_active';
      return isFainted(side.team[i] as FlexymonInstance) ? 'fainted' : null;
    }
    case 'item': {
      const item = data.items.get(action.itemId);
      if (!item || (state.items[action.itemId] ?? 0) <= 0) return 'not_owned';
      if (!item.usableIn.includes('battle')) return 'not_usable_in_battle';
      const target =
        item.effect.type === 'buff' ? activeOf(side) : side.team.find((m) => m.uid === action.targetUid);
      if (!target) return 'not_in_team';
      return itemError(item, target, lookup(data.flexymon, target.speciesId, 'flexymon'));
    }
    case 'flee':
      return state.kind === 'wild' ? null : 'cannot_flee';
  }
}

/** Effective stat of a side's active flexymon (base + bonus, then modifiers). */
function effective(state: BattleState, who: Side, stat: 'attack' | 'defense' | 'speed', data: BattleData) {
  const side = state[who];
  const inst = activeOf(side);
  const species = lookup(data.flexymon, inst.speciesId, 'flexymon');
  return effectiveStat(statValue(species, inst, stat), side.mods, stat);
}

/** Replace the active of `who` (`index`), clearing its modifiers. Mutates `s` (a private copy). */
function switchTo(s: BattleState, who: Side, index: number, events: BattleEvent[]): void {
  const side = s[who];
  const fromUid = activeOf(side).uid;
  side.active = index;
  side.mods = [];
  events.push({ type: 'switch', who, fromUid, toUid: activeOf(side).uid });
}

/** Apply `amount` damage to the active of `who`, with faint handling. Mutates `s`. */
function hurt(s: BattleState, who: Side, amount: number, data: BattleData, events: BattleEvent[]): void {
  const side = s[who];
  const before = activeOf(side);
  const after = takeDamage(before, amount);
  side.team[side.active] = after;
  const species = lookup(data.flexymon, after.speciesId, 'flexymon');
  events.push({
    type: 'damage',
    who,
    uid: after.uid,
    amount: before.currentHp - after.currentHp,
    hp: after.currentHp,
    maxHp: maxHp(species, after),
  });
  if (isFainted(after)) {
    side.mods = [];
    events.push({ type: 'faint', who, uid: after.uid });
  }
}

/** Resolve one attack by the active of `who`. Mutates `s`. */
function performAttack(
  s: BattleState,
  who: Side,
  attackId: string,
  ctx: BattleContext,
  events: BattleEvent[],
) {
  const { data, rng } = ctx;
  const attack = lookup(data.attacks, attackId, 'attack');
  const attacker = activeOf(s[who]);
  events.push({ type: 'attack', who, uid: attacker.uid, attackId });
  if (!rollHit(attack.accuracy, rng)) {
    events.push({ type: 'miss', who, uid: attacker.uid });
    return;
  }
  const effect = attack.effect;
  const foe = other(who);
  switch (effect.type) {
    case 'damage': {
      const atk = effective(s, who, 'attack', data);
      const def = effective(s, foe, 'defense', data);
      hurt(s, foe, computeDamage(effect.power, atk, def, rollDamageFactor(rng)), data, events);
      return;
    }
    case 'heal': {
      const side = s[who];
      const species = lookup(data.flexymon, attacker.speciesId, 'flexymon');
      const max = maxHp(species, attacker);
      const { instance, healed } = healInstance(species, attacker, healAmount(max, effect.percent));
      side.team[side.active] = instance;
      events.push({
        type: 'heal',
        who,
        uid: instance.uid,
        amount: healed,
        hp: instance.currentHp,
        maxHp: max,
      });
      return;
    }
    case 'buff':
    case 'debuff': {
      const target = effect.type === 'buff' ? who : foe;
      const side = s[target];
      side.mods = applyModifier(side.mods, {
        source: `attack:${attack.id}`,
        kind: effect.type,
        stat: effect.stat,
        percent: effect.percent,
        turnsLeft: effect.turns,
      });
      events.push({
        type: 'modifier',
        who: target,
        uid: activeOf(side).uid,
        kind: effect.type,
        stat: effect.stat,
        percent: effect.percent,
        turns: effect.turns,
      });
      return;
    }
  }
}

/** Use a battle item from the bag (already validated). Mutates `s`. */
function useItem(s: BattleState, itemId: string, targetUid: string, data: BattleData, events: BattleEvent[]) {
  const item = lookup(data.items, itemId, 'item');
  const side = s.player;
  const left = (s.items[itemId] ?? 0) - 1;
  if (left > 0) s.items[itemId] = left;
  else delete s.items[itemId];

  const effect = item.effect;
  const index = effect.type === 'buff' ? side.active : side.team.findIndex((m) => m.uid === targetUid);
  const target = side.team[index] as FlexymonInstance;
  const species = lookup(data.flexymon, target.speciesId, 'flexymon');
  const max = maxHp(species, target);
  events.push({ type: 'item', who: 'player', itemId, targetUid: target.uid });

  switch (effect.type) {
    case 'heal':
    case 'heal_full': {
      const { instance, healed } =
        effect.type === 'heal'
          ? healInstance(species, target, effect.amount)
          : { instance: healFull(species, target), healed: max - target.currentHp };
      side.team[index] = instance;
      events.push({
        type: 'heal',
        who: 'player',
        uid: target.uid,
        amount: healed,
        hp: instance.currentHp,
        maxHp: max,
      });
      return;
    }
    case 'revive': {
      const { instance } = reviveInstance(species, target, effect.percent);
      side.team[index] = instance;
      events.push({ type: 'revive', who: 'player', uid: target.uid, hp: instance.currentHp, maxHp: max });
      return;
    }
    case 'buff':
      side.mods = applyModifier(side.mods, {
        source: `item:${item.id}`,
        kind: 'buff',
        stat: effect.stat,
        percent: effect.percent,
        turnsLeft: effect.turns,
      });
      events.push({
        type: 'modifier',
        who: 'player',
        uid: target.uid,
        kind: 'buff',
        stat: effect.stat,
        percent: effect.percent,
        turns: effect.turns,
      });
      return;
    default:
      throw new Error(`battle: item "${itemId}" cannot be used in battle`);
  }
}

/** End the battle with `result`: modifiers cleared, phase `ended`. Mutates `s`. */
function finish(s: BattleState, result: BattleResult, events: BattleEvent[]): void {
  s.phase = 'ended';
  s.result = result;
  s.player.mods = [];
  s.opponent.mods = [];
  events.push({ type: 'end', result });
}

/** After the actions: victory/defeat, modifier ticks, NPC replacement, player replacement. */
function endOfRound(s: BattleState, events: BattleEvent[]): void {
  if (s.opponent.team.every(isFainted)) return finish(s, 'win', events);
  if (s.player.team.every(isFainted)) return finish(s, 'lose', events);

  for (const who of ['player', 'opponent'] as const) {
    const side = s[who];
    const { kept, expired } = tickModifiers(side.mods);
    side.mods = kept;
    for (const m of expired) {
      events.push({ type: 'modifier_end', who, uid: activeOf(side).uid, kind: m.kind, stat: m.stat });
    }
  }

  if (isFainted(activeOf(s.opponent))) switchTo(s, 'opponent', firstAlive(s.opponent.team), events);
  if (isFainted(activeOf(s.player))) {
    s.phase = 'must_switch';
    events.push({ type: 'need_switch', who: 'player' });
  }
}

/**
 * Play the player's action. In phase `choose` this is a full round (the opponent attacks too); in phase
 * `must_switch` only the free replacement happens. Throws if {@link actionError} is not null.
 */
export function chooseAction(state: BattleState, action: BattleAction, ctx: BattleContext): BattleStep {
  const err = actionError(state, action, ctx.data);
  if (err) throw new Error(`battle: invalid action ${action.type} (${err})`);
  const s = structuredClone(state);
  const events: BattleEvent[] = [];

  if (s.phase === 'must_switch' && action.type === 'switch') {
    switchTo(
      s,
      'player',
      s.player.team.findIndex((m) => m.uid === action.uid),
      events,
    );
    s.phase = 'choose';
    return { state: s, events };
  }

  s.round += 1;
  if (action.type === 'flee') {
    events.push({ type: 'flee', who: 'player' });
    finish(s, 'fled', events);
    return { state: s, events };
  }

  const opp = activeOf(s.opponent);
  const oppSpecies = lookup(ctx.data.flexymon, opp.speciesId, 'flexymon');
  const oppAttack = chooseOpponentAttack(
    {
      kind: s.kind,
      attacks: oppSpecies.attacks.map((id) => lookup(ctx.data.attacks, id, 'attack')),
      currentHp: opp.currentHp,
      maxHp: maxHp(oppSpecies, opp),
    },
    ctx.rng,
  );

  const order: { who: Side; attackId: string }[] = [];
  switch (action.type) {
    case 'switch':
      switchTo(
        s,
        'player',
        s.player.team.findIndex((m) => m.uid === action.uid),
        events,
      );
      order.push({ who: 'opponent', attackId: oppAttack });
      break;
    case 'item':
      useItem(s, action.itemId, action.targetUid, ctx.data, events);
      order.push({ who: 'opponent', attackId: oppAttack });
      break;
    case 'attack': {
      const ps = effective(s, 'player', 'speed', ctx.data);
      const os = effective(s, 'opponent', 'speed', ctx.data);
      const playerFirst = ps === os ? ctx.rng.chance(50) : ps > os;
      const mine = { who: 'player' as const, attackId: action.attackId };
      const theirs = { who: 'opponent' as const, attackId: oppAttack };
      order.push(...(playerFirst ? [mine, theirs] : [theirs, mine]));
      break;
    }
  }

  for (const turn of order) {
    if (isFainted(activeOf(s[turn.who])) || isFainted(activeOf(s[other(turn.who)]))) continue;
    performAttack(s, turn.who, turn.attackId, ctx, events);
  }
  endOfRound(s, events);
  return { state: s, events };
}
