import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng';
import {
  actionError,
  activeFlexymon,
  availableSwitches,
  battleItems,
  chooseAction,
  createBattle,
  introEvents,
  type BattleAction,
  type BattleState,
} from '../../src/logic/battle';
import { gameData, inst, scriptedRng, type Script } from './helpers';

// Portátil hp 40 atk 12 def 10 spd 11 [compilar 40/95, pantallazo_azul def −25% 3t /80, actualizacion heal 30%]
// Ratón    hp 30 atk 10 def  8 spd 14 [pulsacion 35/100, rueda_scroll spd −20% 3t /90]
// Teclado  hp 38 atk 11 def 12 spd  8 [pulsacion, atajo_teclado atk +25% 3t]
const data = gameData();

function play(state: BattleState, action: BattleAction, script: Script) {
  const rng = scriptedRng(script);
  const step = chooseAction(state, action, { data, rng });
  const left = rng.remaining();
  // Every scripted value must be consumed: proves the exact RNG call order.
  expect(Object.values(left).flat()).toEqual([]);
  return step;
}

describe('battle: setup', () => {
  it('sends out the first non-fainted flexymon of each side and copies the teams', () => {
    const team = [inst('portatil', 'p1', { currentHp: 0 }), inst('teclado', 'p2')];
    const s = createBattle(team, [inst('raton', 'w')], 'wild', { cafe: 2 });
    expect(activeFlexymon(s, 'player').uid).toBe('p2');
    expect(s.phase).toBe('choose');
    expect(s.items).toEqual({ cafe: 2 });
    expect(s.player.team).not.toBe(team);
    expect(introEvents(s)).toEqual([
      { type: 'appear', who: 'opponent', uid: 'w', speciesId: 'raton' },
      { type: 'appear', who: 'player', uid: 'p2', speciesId: 'teclado' },
    ]);
  });

  it('refuses a battle where a side cannot fight', () => {
    expect(() => createBattle([inst('portatil', 'p', { currentHp: 0 })], [inst('raton')], 'wild')).toThrow();
    expect(() => createBattle([inst('portatil')], [inst('raton', 'r', { currentHp: 0 })], 'npc')).toThrow();
  });
});

describe('battle: attacks', () => {
  it('the faster flexymon attacks first and damage follows the formula', () => {
    const s = createBattle([inst('portatil', 'p')], [inst('raton', 'w')], 'wild');
    // AI picks pulsacion; Ratón (spd 14) first: hit 50, r 1.0 → floor(35×10/10×0.3) = 10.
    // Portátil: hit 50, r 1.0 → floor(40×12/8×0.3) = 18.
    const { state, events } = play(
      s,
      { type: 'attack', attackId: 'compilar' },
      {
        pick: [0],
        int: [50, 50],
        float: [1, 1],
      },
    );
    expect(events).toEqual([
      { type: 'attack', who: 'opponent', uid: 'w', attackId: 'pulsacion' },
      { type: 'damage', who: 'player', uid: 'p', amount: 10, hp: 30, maxHp: 40 },
      { type: 'attack', who: 'player', uid: 'p', attackId: 'compilar' },
      { type: 'damage', who: 'opponent', uid: 'w', amount: 18, hp: 12, maxHp: 30 },
    ]);
    expect(state.round).toBe(1);
    expect(s.round).toBe(0); // the input state is never changed
  });

  it('a roll above accuracy misses and nothing else happens', () => {
    const s = createBattle([inst('portatil', 'p')], [inst('raton', 'w')], 'wild');
    const { events } = play(
      s,
      { type: 'attack', attackId: 'compilar' },
      { pick: [0], int: [50, 96], float: [1] },
    );
    expect(events.slice(2)).toEqual([
      { type: 'attack', who: 'player', uid: 'p', attackId: 'compilar' },
      { type: 'miss', who: 'player', uid: 'p' },
    ]);
  });

  it('a speed tie is decided by rng.chance(50)', () => {
    const fast = { bonus: { hp: 0, attack: 0, defense: 0, speed: 3 } }; // Portátil 11 + 3 = 14 = Ratón
    const s = createBattle([inst('portatil', 'p', fast)], [inst('raton', 'w')], 'wild');
    const first = play(
      s,
      { type: 'attack', attackId: 'compilar' },
      {
        pick: [0],
        chance: [true],
        int: [1, 1],
        float: [1, 1],
      },
    );
    expect(first.events[0]).toMatchObject({ type: 'attack', who: 'player' });
    const second = play(
      s,
      { type: 'attack', attackId: 'compilar' },
      {
        pick: [0],
        chance: [false],
        int: [1, 1],
        float: [1, 1],
      },
    );
    expect(second.events[0]).toMatchObject({ type: 'attack', who: 'opponent' });
  });

  it('a debuff lowers the effective stat (Def 8 −25% → 6) and the same attack replaces it', () => {
    let s = createBattle([inst('portatil', 'p')], [inst('teclado', 'w')], 'wild');
    // Portátil (11) faster than Teclado (8). Teclado uses atajo_teclado (buff, no damage roll).
    let step = play(s, { type: 'attack', attackId: 'pantallazo_azul' }, { pick: [1], int: [1, 1] });
    expect(step.events).toEqual([
      { type: 'attack', who: 'player', uid: 'p', attackId: 'pantallazo_azul' },
      { type: 'modifier', who: 'opponent', uid: 'w', kind: 'debuff', stat: 'defense', percent: 25, turns: 3 },
      { type: 'attack', who: 'opponent', uid: 'w', attackId: 'atajo_teclado' },
      { type: 'modifier', who: 'opponent', uid: 'w', kind: 'buff', stat: 'attack', percent: 25, turns: 3 },
    ]);
    s = step.state;
    expect(s.opponent.mods.map((m) => m.turnsLeft)).toEqual([2, 2]);
    step = play(s, { type: 'attack', attackId: 'pantallazo_azul' }, { pick: [1], int: [1, 1] });
    // Replaced (turns reset to 3, then ticked to 2), not stacked.
    expect(step.state.opponent.mods.filter((m) => m.kind === 'debuff')).toEqual([
      { source: 'attack:pantallazo_azul', kind: 'debuff', stat: 'defense', percent: 25, turnsLeft: 2 },
    ]);
    // Def 12 × 0.75 = 9 → compilar: floor(40 × 12/9 × 0.3) = 16
    step = play(step.state, { type: 'attack', attackId: 'compilar' }, { pick: [1], int: [1, 1], float: [1] });
    expect(step.events[1]).toMatchObject({ type: 'damage', amount: 16 });
  });

  it('modifiers end after their turns with a modifier_end event', () => {
    let s = createBattle([inst('portatil', 'p')], [inst('teclado', 'w')], 'wild');
    s = play(s, { type: 'attack', attackId: 'pantallazo_azul' }, { pick: [1], int: [1, 100] }).state;
    s = play(s, { type: 'attack', attackId: 'actualizacion' }, { pick: [1], int: [1, 100] }).state;
    const third = play(s, { type: 'attack', attackId: 'actualizacion' }, { pick: [1], int: [1, 100] });
    expect(third.events.filter((e) => e.type === 'modifier_end')).toEqual([
      { type: 'modifier_end', who: 'opponent', uid: 'w', kind: 'debuff', stat: 'defense' },
    ]);
    // Only Teclado's own atajo_teclado buff (re-applied each round) is left.
    expect(third.state.opponent.mods.map((m) => m.source)).toEqual(['attack:atajo_teclado']);
  });

  it('a heal attack restores floor(maxHp × percent / 100), never above max', () => {
    const s = createBattle([inst('portatil', 'p', { currentHp: 20 })], [inst('teclado', 'w')], 'wild');
    const { events, state } = play(
      s,
      { type: 'attack', attackId: 'actualizacion' },
      { pick: [1], int: [1, 1] },
    );
    expect(events[1]).toEqual({ type: 'heal', who: 'player', uid: 'p', amount: 12, hp: 32, maxHp: 40 });
    const near = createBattle([inst('portatil', 'p', { currentHp: 35 })], [inst('teclado', 'w')], 'wild');
    expect(
      play(near, { type: 'attack', attackId: 'actualizacion' }, { pick: [1], int: [1, 1] }).events[1],
    ).toMatchObject({ amount: 5, hp: 40 });
    expect(state.player.team[0]?.currentHp).toBe(32);
  });

  it('a flexymon that faints skips the rest of the round; wild faint is a victory', () => {
    const s = createBattle([inst('portatil', 'p')], [inst('teclado', 'w', { currentHp: 5 })], 'wild');
    const { events, state } = play(
      s,
      { type: 'attack', attackId: 'compilar' },
      { pick: [0], int: [1], float: [1] },
    );
    expect(events).toEqual([
      { type: 'attack', who: 'player', uid: 'p', attackId: 'compilar' },
      { type: 'damage', who: 'opponent', uid: 'w', amount: 5, hp: 0, maxHp: 38 },
      { type: 'faint', who: 'opponent', uid: 'w' },
      { type: 'end', result: 'win' },
    ]);
    expect(state.phase).toBe('ended');
    expect(state.result).toBe('win');
    expect(actionError(state, { type: 'attack', attackId: 'compilar' }, data)).toBe('battle_over');
  });

  it('an unknown attack is rejected', () => {
    const s = createBattle([inst('portatil')], [inst('raton')], 'wild');
    expect(actionError(s, { type: 'attack', attackId: 'pulsacion' }, data)).toBe('unknown_attack');
    expect(() =>
      chooseAction(s, { type: 'attack', attackId: 'pulsacion' }, { data, rng: scriptedRng({}) }),
    ).toThrow(/unknown_attack/);
  });
});

describe('battle: NPC teams, switching and losing', () => {
  it('NPC: the next flexymon comes in automatically; the last faint is a victory', () => {
    const s = createBattle(
      [inst('portatil', 'p')],
      [inst('teclado', 'n1', { currentHp: 5 }), inst('teclado', 'n2', { currentHp: 5 })],
      'npc',
    );
    // NPC AI is deterministic: pulsacion is its only damage attack (no rng).
    const r1 = play(s, { type: 'attack', attackId: 'compilar' }, { int: [1], float: [1] });
    expect(r1.events.slice(2)).toEqual([
      { type: 'faint', who: 'opponent', uid: 'n1' },
      { type: 'switch', who: 'opponent', fromUid: 'n1', toUid: 'n2' },
    ]);
    expect(r1.state.phase).toBe('choose');
    const r2 = play(r1.state, { type: 'attack', attackId: 'compilar' }, { int: [1], float: [1] });
    expect(r2.events.at(-1)).toEqual({ type: 'end', result: 'win' });
  });

  it('cannot flee from an NPC; fleeing from a wild flexymon always works', () => {
    const npc = createBattle([inst('portatil')], [inst('raton')], 'npc');
    expect(actionError(npc, { type: 'flee' }, data)).toBe('cannot_flee');
    const wild = createBattle([inst('portatil')], [inst('raton')], 'wild');
    const { events, state } = play(wild, { type: 'flee' }, {});
    expect(events).toEqual([
      { type: 'flee', who: 'player' },
      { type: 'end', result: 'fled' },
    ]);
    expect(state.result).toBe('fled');
  });

  it('Cambiar uses the turn: the opponent attacks the new active, old modifiers are cleared', () => {
    let s = createBattle([inst('portatil', 'p'), inst('teclado', 't')], [inst('raton', 'w')], 'wild');
    s = play(s, { type: 'attack', attackId: 'actualizacion' }, { pick: [1], int: [1, 1] }).state; // rueda_scroll on p
    expect(s.player.mods).toHaveLength(1);
    expect(availableSwitches(s).map((m) => m.uid)).toEqual(['t']);
    const { events, state } = play(s, { type: 'switch', uid: 't' }, { pick: [0], int: [1], float: [1] });
    expect(events).toEqual([
      { type: 'switch', who: 'player', fromUid: 'p', toUid: 't' },
      { type: 'attack', who: 'opponent', uid: 'w', attackId: 'pulsacion' },
      // floor(35 × 10/12 × 0.3) = 8
      { type: 'damage', who: 'player', uid: 't', amount: 8, hp: 30, maxHp: 38 },
    ]);
    expect(state.player.mods).toEqual([]);
    expect(actionError(state, { type: 'switch', uid: 't' }, data)).toBe('already_active');
    expect(actionError(state, { type: 'switch', uid: 'zz' }, data)).toBe('not_in_team');
  });

  it('player faint with others alive: a free replacement (no turn), only switch allowed', () => {
    const s = createBattle(
      [
        inst('portatil', 'p', { currentHp: 5 }),
        inst('teclado', 't'),
        inst('raton', 'down', { currentHp: 0 }),
      ],
      [inst('raton', 'w')],
      'wild',
    );
    const r1 = play(s, { type: 'attack', attackId: 'compilar' }, { pick: [0], int: [1], float: [1] });
    expect(r1.events).toEqual([
      { type: 'attack', who: 'opponent', uid: 'w', attackId: 'pulsacion' },
      { type: 'damage', who: 'player', uid: 'p', amount: 5, hp: 0, maxHp: 40 },
      { type: 'faint', who: 'player', uid: 'p' },
      { type: 'need_switch', who: 'player' },
    ]);
    expect(r1.state.phase).toBe('must_switch');
    expect(actionError(r1.state, { type: 'attack', attackId: 'compilar' }, data)).toBe('must_switch');
    expect(actionError(r1.state, { type: 'switch', uid: 'down' }, data)).toBe('fainted');
    const r2 = play(r1.state, { type: 'switch', uid: 't' }, {}); // no rng: the opponent does not act
    expect(r2.events).toEqual([{ type: 'switch', who: 'player', fromUid: 'p', toUid: 't' }]);
    expect(r2.state.phase).toBe('choose');
    expect(r2.state.round).toBe(1);
  });

  it('when the whole team faints the player loses', () => {
    const s = createBattle([inst('portatil', 'p', { currentHp: 1 })], [inst('raton', 'w')], 'npc');
    const { events, state } = play(s, { type: 'attack', attackId: 'compilar' }, { int: [1], float: [1] });
    expect(events.slice(-2)).toEqual([
      { type: 'faint', who: 'player', uid: 'p' },
      { type: 'end', result: 'lose' },
    ]);
    expect(state.result).toBe('lose');
  });
});

describe('battle: items', () => {
  it('a Café heals 20 HP, is consumed, and the opponent then acts', () => {
    const s = createBattle([inst('portatil', 'p', { currentHp: 10 })], [inst('raton', 'w')], 'wild', {
      cafe: 1,
    });
    expect(battleItems(s, data)).toEqual(['cafe']);
    const { events, state } = play(
      s,
      { type: 'item', itemId: 'cafe', targetUid: 'p' },
      {
        pick: [0],
        int: [1],
        float: [1],
      },
    );
    expect(events).toEqual([
      { type: 'item', who: 'player', itemId: 'cafe', targetUid: 'p' },
      { type: 'heal', who: 'player', uid: 'p', amount: 20, hp: 30, maxHp: 40 },
      { type: 'attack', who: 'opponent', uid: 'w', attackId: 'pulsacion' },
      { type: 'damage', who: 'player', uid: 'p', amount: 10, hp: 20, maxHp: 40 },
    ]);
    expect(state.items).toEqual({});
    expect(actionError(state, { type: 'item', itemId: 'cafe', targetUid: 'p' }, data)).toBe('not_owned');
  });

  it('an item can heal a non-active team member', () => {
    const s = createBattle(
      [inst('portatil', 'p'), inst('teclado', 't', { currentHp: 30 })],
      [inst('raton', 'w')],
      'wild',
      { cafe: 3 },
    );
    const { events, state } = play(
      s,
      { type: 'item', itemId: 'cafe', targetUid: 't' },
      {
        pick: [1],
        int: [100],
      },
    );
    expect(events[1]).toEqual({ type: 'heal', who: 'player', uid: 't', amount: 8, hp: 38, maxHp: 38 });
    expect(state.items).toEqual({ cafe: 2 });
  });

  it('a buff item goes on the active flexymon', () => {
    const s = createBattle([inst('portatil', 'p'), inst('teclado', 't')], [inst('raton', 'w')], 'wild', {
      redbull: 1,
    });
    const { events, state } = play(
      s,
      { type: 'item', itemId: 'redbull', targetUid: 't' },
      {
        pick: [1],
        int: [100],
      },
    );
    expect(events[1]).toEqual({
      type: 'modifier',
      who: 'player',
      uid: 'p',
      kind: 'buff',
      stat: 'attack',
      percent: 30,
      turns: 3,
    });
    expect(state.player.mods.map((m) => m.source)).toContain('item:redbull');
  });

  it('refuses items that cannot be used or would do nothing', () => {
    const s = createBattle(
      [inst('portatil', 'p'), inst('teclado', 'down', { currentHp: 0 })],
      [inst('raton', 'w')],
      'wild',
      { cafe: 1, regleta: 1, llaves_audi: 1 },
    );
    expect(battleItems(s, data)).toEqual(['cafe']);
    expect(actionError(s, { type: 'item', itemId: 'cafe', targetUid: 'p' }, data)).toBe('no_effect'); // full HP
    expect(actionError(s, { type: 'item', itemId: 'cafe', targetUid: 'down' }, data)).toBe('no_effect'); // fainted
    expect(actionError(s, { type: 'item', itemId: 'cafe', targetUid: 'zz' }, data)).toBe('not_in_team');
    expect(actionError(s, { type: 'item', itemId: 'regleta', targetUid: 'p' }, data)).toBe(
      'not_usable_in_battle',
    );
    expect(actionError(s, { type: 'item', itemId: 'redbull', targetUid: 'p' }, data)).toBe('not_owned');
  });
});

describe('battle: heal_full and revive items (not in the shipped content yet)', () => {
  const cafe = data.items.get('cafe')!;
  const extra = {
    ...data,
    items: new Map([
      ...data.items,
      ['termo', { ...cafe, id: 'termo', effect: { type: 'heal_full' as const } }],
      ['reinicio', { ...cafe, id: 'reinicio', effect: { type: 'revive' as const, percent: 50 } }],
    ]),
  };
  const team = () => [inst('portatil', 'p', { currentHp: 3 }), inst('teclado', 'down', { currentHp: 0 })];

  it('heal_full restores max HP', () => {
    const s = createBattle(team(), [inst('raton', 'w')], 'wild', { termo: 1 });
    const step = chooseAction(
      s,
      { type: 'item', itemId: 'termo', targetUid: 'p' },
      {
        data: extra,
        rng: scriptedRng({ pick: [1], int: [100] }),
      },
    );
    expect(step.events[1]).toEqual({ type: 'heal', who: 'player', uid: 'p', amount: 37, hp: 40, maxHp: 40 });
  });

  it('revive brings a fainted member back to percent of max HP and only works on fainted ones', () => {
    const s = createBattle(team(), [inst('raton', 'w')], 'wild', { reinicio: 1 });
    expect(actionError(s, { type: 'item', itemId: 'reinicio', targetUid: 'p' }, extra)).toBe('no_effect');
    const step = chooseAction(
      s,
      { type: 'item', itemId: 'reinicio', targetUid: 'down' },
      {
        data: extra,
        rng: scriptedRng({ pick: [1], int: [100] }),
      },
    );
    expect(step.events[1]).toEqual({ type: 'revive', who: 'player', uid: 'down', hp: 19, maxHp: 38 });
    expect(availableSwitches(step.state).map((m) => m.uid)).toEqual(['down']);
  });
});

describe('battle: full scripted battle with a fixed seed', () => {
  it('Portátil vs wild Ratón, seed 2026: exact event list', () => {
    const rng = createRng(2026);
    let s = createBattle([inst('portatil', 'p')], [inst('raton', 'w')], 'wild');
    const all = [...introEvents(s)];
    const moves = ['pantallazo_azul', 'compilar', 'compilar', 'compilar', 'compilar'];
    for (const attackId of moves) {
      if (s.phase === 'ended') break;
      const step = chooseAction(s, { type: 'attack', attackId }, { data, rng });
      all.push(...step.events);
      s = step.state;
    }
    expect(all).toEqual(EXPECTED_SEED_2026);
    expect(s.result).toBe('win');
    expect(s.player.team[0]?.currentHp).toBe(12);
  });
});

/**
 * Hand-checked against the formulas (Ratón spd 14 > Portátil 11, so it always attacks first):
 * - pulsacion on Portátil: floor(35 × 10/10 × 0.3 × r) = 10 for r ≥ 0.953, else 9 (r ≥ 0.857).
 * - compilar on Ratón with Def −25% (8 → 6): floor(40 × 12/6 × 0.3 × r) = 20..24.
 */
const EXPECTED_SEED_2026 = [
  { type: 'appear', who: 'opponent', uid: 'w', speciesId: 'raton' },
  { type: 'appear', who: 'player', uid: 'p', speciesId: 'portatil' },
  // Round 1
  { type: 'attack', who: 'opponent', uid: 'w', attackId: 'pulsacion' },
  { type: 'damage', who: 'player', uid: 'p', amount: 9, hp: 31, maxHp: 40 },
  { type: 'attack', who: 'player', uid: 'p', attackId: 'pantallazo_azul' },
  { type: 'modifier', who: 'opponent', uid: 'w', kind: 'debuff', stat: 'defense', percent: 25, turns: 3 },
  // Round 2
  { type: 'attack', who: 'opponent', uid: 'w', attackId: 'pulsacion' },
  { type: 'damage', who: 'player', uid: 'p', amount: 10, hp: 21, maxHp: 40 },
  { type: 'attack', who: 'player', uid: 'p', attackId: 'compilar' },
  { type: 'damage', who: 'opponent', uid: 'w', amount: 21, hp: 9, maxHp: 30 },
  // Round 3 (the debuff is still active: 1 turn left)
  { type: 'attack', who: 'opponent', uid: 'w', attackId: 'pulsacion' },
  { type: 'damage', who: 'player', uid: 'p', amount: 9, hp: 12, maxHp: 40 },
  { type: 'attack', who: 'player', uid: 'p', attackId: 'compilar' },
  // Overkill: the event reports the HP actually lost (9), not the rolled damage.
  { type: 'damage', who: 'opponent', uid: 'w', amount: 9, hp: 0, maxHp: 30 },
  { type: 'faint', who: 'opponent', uid: 'w' },
  { type: 'end', result: 'win' },
];
