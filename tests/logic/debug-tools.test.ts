import { describe, expect, it } from 'vitest';
import { DEBUG_GIVE_EUROS, EUROS_MAX, ITEM_COUNT_MAX } from '../../src/logic/constants';
import { giveEuros, giveItem } from '../../src/logic/debug-tools';
import type { GameState } from '../../src/logic/save';

const state = (): GameState => ({
  player: { name: 'Ana', map: 'test', x: 1, y: 2, facing: 'down' },
  euros: 200,
  teamSlots: 2,
  team: [],
  storage: [],
  items: { cafe: 3 },
  npcs: {},
});

describe('debug tools (M15)', () => {
  it('giveEuros adds DEBUG_GIVE_EUROS, clamped to EUROS_MAX, and leaves the input alone', () => {
    const s = state();
    expect(giveEuros(s).euros).toBe(200 + DEBUG_GIVE_EUROS);
    expect(giveEuros({ ...s, euros: EUROS_MAX - 5 }).euros).toBe(EUROS_MAX);
    expect(s.euros).toBe(200);
  });

  it('giveItem adds one of any item (key items too), capped at ITEM_COUNT_MAX', () => {
    expect(giveItem(state(), 'cafe')).toMatchObject({ state: { items: { cafe: 4 } }, added: 1 });
    expect(giveItem(state(), 'llaves_audi').state.items).toEqual({ cafe: 3, llaves_audi: 1 });
    const full = { ...state(), items: { cafe: ITEM_COUNT_MAX } };
    expect(giveItem(full, 'cafe')).toMatchObject({ state: { items: { cafe: ITEM_COUNT_MAX } }, added: 0 });
  });
});
