import { describe, expect, it } from 'vitest';
import { fieldItemError, fieldItemNeedsTarget, useFieldItem } from '../../src/logic/field-items';
import type { GameState } from '../../src/logic/save';
import { gameData, inst } from './helpers';

const data = gameData();
const cafe = data.items.get('cafe')!;
/** Content with the effects the shipped items do not have yet. */
const extra = {
  ...data,
  items: new Map([
    ...data.items,
    ['termo', { ...cafe, id: 'termo', effect: { type: 'heal_full' as const } }],
    ['reinicio', { ...cafe, id: 'reinicio', effect: { type: 'revive' as const, percent: 50 } }],
    [
      'lata_campo',
      {
        ...cafe,
        id: 'lata_campo',
        effect: { type: 'buff' as const, stat: 'attack' as const, percent: 10, turns: 2 },
      },
    ],
  ]),
};

function state(over: Partial<GameState> = {}): GameState {
  return {
    player: { name: 'Rogelio', map: 'test', x: 1, y: 1, facing: 'down' },
    euros: 200,
    teamSlots: 2,
    team: [inst('portatil', 'p', { currentHp: 10 }), inst('teclado', 'down', { currentHp: 0 })],
    storage: [],
    items: { cafe: 2, regleta: 1, redbull: 1, llaves_audi: 1, termo: 1, reinicio: 1, lata_campo: 1 },
    npcs: {},
    ...over,
  };
}

describe('useFieldItem', () => {
  it('a Café heals 20 HP on a team member and is consumed', () => {
    const before = state();
    const r = useFieldItem(before, data, 'cafe', 'p');
    expect(r).toMatchObject({ ok: true, use: { type: 'heal', uid: 'p', amount: 20, hp: 30, maxHp: 40 } });
    if (!r.ok) return;
    expect(r.state.team[0]!.currentHp).toBe(30);
    expect(r.state.items.cafe).toBe(1);
    expect(before.items.cafe).toBe(2); // input unchanged
    expect(before.team[0]!.currentHp).toBe(10);
  });

  it('the last one of an item disappears from the bag', () => {
    const r = useFieldItem(state({ items: { cafe: 1 } }), data, 'cafe', 'p');
    expect(r.ok && r.state.items).toEqual({});
  });

  it('heal never goes above max HP and refuses full or fainted targets', () => {
    const r = useFieldItem(state({ team: [inst('portatil', 'p', { currentHp: 35 })] }), data, 'cafe', 'p');
    expect(r).toMatchObject({ ok: true, use: { amount: 5, hp: 40 } });
    expect(useFieldItem(state({ team: [inst('portatil', 'p')] }), data, 'cafe', 'p')).toEqual({
      ok: false,
      reason: 'no_effect',
    });
    expect(useFieldItem(state(), data, 'cafe', 'down')).toEqual({ ok: false, reason: 'no_effect' });
  });

  it('heal_full and revive', () => {
    expect(useFieldItem(state(), extra, 'termo', 'p')).toMatchObject({
      ok: true,
      use: { type: 'heal', amount: 30, hp: 40 },
    });
    expect(useFieldItem(state(), extra, 'reinicio', 'p')).toEqual({ ok: false, reason: 'no_effect' });
    const r = useFieldItem(state(), extra, 'reinicio', 'down');
    expect(r).toMatchObject({ ok: true, use: { type: 'revive', uid: 'down', hp: 19, maxHp: 38 } });
    expect(r.ok && r.state.items.reinicio).toBeUndefined();
  });

  it('Regleta adds a team slot, up to 6', () => {
    const r = useFieldItem(state(), data, 'regleta');
    expect(r).toMatchObject({ ok: true, use: { type: 'team_slot', teamSlots: 3 } });
    expect(r.ok && r.state.teamSlots).toBe(3);
    expect(r.ok && r.state.items.regleta).toBeUndefined();
    expect(useFieldItem(state({ teamSlots: 6 }), data, 'regleta')).toEqual({
      ok: false,
      reason: 'max_slots',
    });
  });

  it('refuses unknown, missing, battle-only, key and buff items, and bad targets', () => {
    expect(useFieldItem(state(), data, 'nada')).toEqual({ ok: false, reason: 'unknown_item' });
    expect(useFieldItem(state({ items: {} }), data, 'cafe', 'p')).toEqual({ ok: false, reason: 'not_owned' });
    expect(useFieldItem(state(), data, 'redbull')).toEqual({ ok: false, reason: 'not_usable_in_field' });
    expect(useFieldItem(state(), data, 'llaves_audi')).toEqual({ ok: false, reason: 'not_usable_in_field' });
    const buffInField = {
      ...extra,
      items: new Map([
        ...extra.items,
        ['lata_campo', { ...extra.items.get('lata_campo')!, usableIn: ['field' as const] }],
      ]),
    };
    expect(useFieldItem(state(), buffInField, 'lata_campo')).toEqual({
      ok: false,
      reason: 'not_usable_in_field',
    });
    expect(useFieldItem(state(), data, 'cafe')).toEqual({ ok: false, reason: 'needs_target' });
    expect(useFieldItem(state(), data, 'cafe', 'zz')).toEqual({ ok: false, reason: 'not_in_team' });
    const stored = state({ storage: [inst('raton', 's', { currentHp: 1 })] });
    expect(useFieldItem(stored, data, 'cafe', 's')).toEqual({ ok: false, reason: 'not_in_team' });
  });

  it('fieldItemError matches useFieldItem; fieldItemNeedsTarget', () => {
    expect(fieldItemError(state(), data, 'cafe', 'p')).toBeNull();
    expect(fieldItemError(state(), data, 'regleta')).toBeNull();
    expect(fieldItemNeedsTarget(cafe)).toBe(true);
    expect(fieldItemNeedsTarget(data.items.get('regleta')!)).toBe(false);
    expect(fieldItemNeedsTarget(extra.items.get('reinicio')!)).toBe(true);
  });
});
