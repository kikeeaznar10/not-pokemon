/**
 * Battle presentation rules (M6): how the BattleScene shows the battle, as plain data, so the scene
 * stays a thin player of steps and never computes a rule.
 *
 * - {@link viewSteps} turns one logic {@link BattleEvent} into the ordered steps the scene animates:
 *   messages (already translated through the `t` passed in), sounds, sprite swaps, hits, HP bar moves,
 *   faints, the forced switch menu and the end. HP numbers come straight from the events.
 * - Names: the player's flexymon go by their species name; the opponent's get `battle.foe_wild`
 *   ("{name} salvaje") or `battle.foe_npc` ("{name} rival").
 * - {@link mainMenu} says which of Atacar / Objeto / Cambiar / Huir is enabled (Huir only against wild
 *   flexymon, through `actionError`), {@link attackMenu} and {@link teamMenu} list the sub-menu rows.
 * - {@link hpColor} picks the HP bar colour band.
 * Every visible text comes from `src/i18n/es.json` or the content files.
 */
import type { Attack, Item, Species } from '../data/schemas';
import { HP_RED_BELOW, HP_YELLOW_BELOW } from './constants';
import { actionError, type BattleEvent, type BattleKind, type BattleState, type Side } from './battle';
import { isFainted, maxHp } from './instance';

/** Translator (`t` from `src/i18n`). */
export type Translate = (key: string, vars?: Record<string, string | number>) => string;

/** The content the view reads. `GameData` satisfies it. */
export interface ViewData {
  readonly flexymon: ReadonlyMap<string, Species>;
  readonly attacks: ReadonlyMap<string, Attack>;
  readonly items: ReadonlyMap<string, Item>;
}

/** One thing the scene does, in order. */
export type ViewStep =
  /** Show a message in the dialog box and wait for A. */
  | { type: 'message'; text: string }
  /** Play a sound (key = its JSON path). */
  | { type: 'sound'; key: string }
  /** Put this flexymon on `who`'s side (sprite, name, HP bar set without animation). */
  | { type: 'show'; who: Side; uid: string; speciesId: string; name: string; hp: number; maxHp: number }
  /** Shake and flash `who`'s sprite. */
  | { type: 'hit'; who: Side }
  /** Animate `who`'s HP bar to `hp`. */
  | { type: 'hp'; who: Side; hp: number; maxHp: number }
  /** `who`'s sprite drops out of view. */
  | { type: 'faint'; who: Side }
  /** `who`'s sprite leaves (switching out). */
  | { type: 'withdraw'; who: Side }
  /** Open the team menu; the player must pick a replacement (B does nothing). */
  | { type: 'need_switch' }
  /** The battle is over. */
  | { type: 'end'; result: 'win' | 'lose' | 'fled' };

/** What {@link viewSteps} needs besides the events. */
export interface ViewContext {
  data: ViewData;
  kind: BattleKind;
  /** The battle state BEFORE the events: uid → species of both teams, and the HP each one starts with. */
  state: BattleState;
  t: Translate;
}

/** Per-side uid → HP as last reported, updated while the events are walked. */
type HpTrack = Record<Side, Map<string, number>>;

function lookup<T>(map: ReadonlyMap<string, T>, id: string, what: string): T {
  const v = map.get(id);
  if (!v) throw new Error(`battle-view: unknown ${what} "${id}"`);
  return v;
}

/** The instance with `uid` on `who`'s side of the state. */
function member(state: BattleState, who: Side, uid: string) {
  const m = state[who].team.find((x) => x.uid === uid);
  if (!m) throw new Error(`battle-view: no flexymon "${uid}" on the ${who} side`);
  return m;
}

/** Display name of `uid` on `who`'s side (the opponent gets "salvaje" / "rival"). */
export function displayName(ctx: ViewContext, who: Side, uid: string): string {
  const species = lookup(ctx.data.flexymon, member(ctx.state, who, uid).speciesId, 'flexymon');
  if (who === 'player') return species.name;
  return ctx.t(ctx.kind === 'wild' ? 'battle.foe_wild' : 'battle.foe_npc', { name: species.name });
}

/** A `show` step for `uid`, with the HP it has at this point of the event list. */
function show(ctx: ViewContext, hp: HpTrack, who: Side, uid: string): ViewStep {
  const inst = member(ctx.state, who, uid);
  const species = lookup(ctx.data.flexymon, inst.speciesId, 'flexymon');
  return {
    type: 'show',
    who,
    uid,
    speciesId: species.id,
    name: displayName(ctx, who, uid),
    hp: hp[who].get(uid) ?? inst.currentHp,
    maxHp: maxHp(species, inst),
  };
}

function cry(ctx: ViewContext, who: Side, uid: string): ViewStep {
  const species = lookup(ctx.data.flexymon, member(ctx.state, who, uid).speciesId, 'flexymon');
  return { type: 'sound', key: species.cry };
}

const msg = (text: string): ViewStep => ({ type: 'message', text });

/**
 * The steps that show `events` (one `chooseAction` result, or `introEvents`), in order. A flexymon that
 * appears or switches in shows the HP it has at that moment: its HP in `ctx.state` (before the round),
 * updated by the `damage` / `heal` / `revive` events seen so far. No HP is ever computed here.
 */
export function viewSteps(events: readonly BattleEvent[], ctx: ViewContext): ViewStep[] {
  const hp: HpTrack = { player: new Map(), opponent: new Map() };
  for (const who of ['player', 'opponent'] as const) {
    for (const m of ctx.state[who].team) hp[who].set(m.uid, m.currentHp);
  }
  const steps: ViewStep[] = [];
  for (const event of events) {
    steps.push(...eventSteps(event, ctx, hp));
    if (event.type === 'damage' || event.type === 'heal' || event.type === 'revive') {
      hp[event.who].set(event.uid, event.hp);
    }
  }
  return steps;
}

/** The steps of one event (see {@link viewSteps}). */
function eventSteps(event: BattleEvent, ctx: ViewContext, hp: HpTrack): ViewStep[] {
  const { t, data } = ctx;
  switch (event.type) {
    case 'appear': {
      const name = displayName(ctx, event.who, event.uid);
      const text =
        event.who === 'player'
          ? t('battle.go', { name })
          : t(ctx.kind === 'wild' ? 'battle.wild_appeared' : 'battle.foe_sends', {
              name: lookup(data.flexymon, event.speciesId, 'flexymon').name,
            });
      return [show(ctx, hp, event.who, event.uid), cry(ctx, event.who, event.uid), msg(text)];
    }
    case 'attack': {
      const attack = lookup(data.attacks, event.attackId, 'attack');
      return [
        msg(t('battle.uses', { name: displayName(ctx, event.who, event.uid), attack: attack.name })),
        { type: 'sound', key: attack.sound },
      ];
    }
    case 'miss':
      return [msg(t('battle.missed'))];
    case 'damage':
      return [
        { type: 'hit', who: event.who },
        { type: 'hp', who: event.who, hp: event.hp, maxHp: event.maxHp },
      ];
    case 'heal':
      return [
        { type: 'hp', who: event.who, hp: event.hp, maxHp: event.maxHp },
        msg(t('battle.healed', { name: displayName(ctx, event.who, event.uid), amount: event.amount })),
      ];
    case 'revive':
      return [
        { type: 'hp', who: event.who, hp: event.hp, maxHp: event.maxHp },
        msg(t('battle.revived', { name: displayName(ctx, event.who, event.uid) })),
      ];
    case 'modifier':
      return [
        msg(
          t(event.kind === 'buff' ? 'battle.stat_up' : 'battle.stat_down', {
            stat: t(`stat.${event.stat}`),
            name: displayName(ctx, event.who, event.uid),
          }),
        ),
      ];
    case 'modifier_end':
      return [
        msg(
          t('battle.stat_normal', {
            stat: t(`stat.${event.stat}`),
            name: displayName(ctx, event.who, event.uid),
          }),
        ),
      ];
    case 'faint':
      return [
        { type: 'faint', who: event.who },
        msg(t('battle.fainted', { name: displayName(ctx, event.who, event.uid) })),
      ];
    case 'switch': {
      const to = displayName(ctx, event.who, event.toUid);
      if (event.who === 'player') {
        const fromName = displayName(ctx, 'player', event.fromUid);
        // A fainted flexymon has already left the field; only a healthy one is called back.
        const back: ViewStep[] =
          (hp.player.get(event.fromUid) ?? 0) <= 0
            ? []
            : [msg(t('battle.come_back', { name: fromName })), { type: 'withdraw', who: 'player' }];
        return [
          ...back,
          show(ctx, hp, 'player', event.toUid),
          cry(ctx, 'player', event.toUid),
          msg(t('battle.go', { name: to })),
        ];
      }
      const species = lookup(data.flexymon, member(ctx.state, 'opponent', event.toUid).speciesId, 'flexymon');
      return [
        show(ctx, hp, 'opponent', event.toUid),
        cry(ctx, 'opponent', event.toUid),
        msg(t('battle.foe_sends', { name: species.name })),
      ];
    }
    case 'item': {
      const item = lookup(data.items, event.itemId, 'item');
      return [
        msg(t('battle.item_used', { item: item.name, name: displayName(ctx, 'player', event.targetUid) })),
      ];
    }
    case 'flee':
      return [msg(t('battle.fled'))];
    case 'need_switch':
      return [{ type: 'need_switch' }];
    case 'end':
      return [
        ...(event.result === 'win' ? [msg(t('battle.win'))] : []),
        ...(event.result === 'lose' ? [msg(t('battle.lose'))] : []),
        { type: 'end', result: event.result },
      ];
  }
}

/** One option of a battle menu. */
export interface MenuOption {
  id: string;
  label: string;
  enabled: boolean;
}

/** The 2 × 2 main menu: Atacar, Objeto / Cambiar, Huir (Huir disabled against NPCs). */
export function mainMenu(state: BattleState, data: ViewData, t: Translate): MenuOption[] {
  return [
    { id: 'attack', label: t('battle.menu_attack'), enabled: true },
    { id: 'item', label: t('battle.menu_item'), enabled: true },
    { id: 'switch', label: t('battle.menu_switch'), enabled: true },
    {
      id: 'flee',
      label: t('battle.menu_flee'),
      enabled: actionError(state, { type: 'flee' }, data) === null,
    },
  ];
}

/** A row of the attack menu: the attack (up to 3) and its accuracy line. */
export interface AttackOption extends MenuOption {
  accuracy: string;
}

/** The active flexymon's attacks, in species order, with "Precisión N %" sub-text. */
export function attackMenu(state: BattleState, data: ViewData, t: Translate): AttackOption[] {
  const active = state.player.team[state.player.active];
  if (!active) return [];
  const species = lookup(data.flexymon, active.speciesId, 'flexymon');
  return species.attacks.map((id) => {
    const attack = lookup(data.attacks, id, 'attack');
    return {
      id,
      label: attack.name,
      enabled: actionError(state, { type: 'attack', attackId: id }, data) === null,
      accuracy: t('battle.accuracy', { n: attack.accuracy }),
    };
  });
}

/** A row of the team menu. `enabled` = the player may switch to it now (alive and not active). */
export interface TeamOption extends MenuOption {
  icon: string;
  hp: number;
  maxHp: number;
  hpText: string;
  fainted: boolean;
  active: boolean;
}

/** The player's team in order: icon, name, "PS hp/max"; fainted and active members are not enabled. */
export function teamMenu(state: BattleState, data: ViewData, t: Translate): TeamOption[] {
  return state.player.team.map((m, i) => {
    const species = lookup(data.flexymon, m.speciesId, 'flexymon');
    const max = maxHp(species, m);
    return {
      id: m.uid,
      label: species.name,
      icon: species.sprite.icon,
      hp: m.currentHp,
      maxHp: max,
      hpText: t('battle.hp', { hp: m.currentHp, max }),
      fainted: isFainted(m),
      active: i === state.player.active,
      enabled: actionError(state, { type: 'switch', uid: m.uid }, data) === null,
    };
  });
}

/** HP bar colour band: `green` from `HP_YELLOW_BELOW` up, `yellow` down to `HP_RED_BELOW`, then `red`. */
export function hpColor(hp: number, max: number): 'green' | 'yellow' | 'red' {
  const ratio = max > 0 ? hp / max : 0;
  if (ratio < HP_RED_BELOW) return 'red';
  if (ratio < HP_YELLOW_BELOW) return 'yellow';
  return 'green';
}
