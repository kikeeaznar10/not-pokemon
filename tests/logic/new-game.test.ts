import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng';
import { newGameState } from '../../src/logic/new-game';
import { gameData } from './helpers';

describe('newGameState', () => {
  it('builds the start.json state: starter alone at full HP, euros, slots, items, spawn', () => {
    const data = gameData();
    const s = newGameState(data, createRng(1), 'Rogelio');
    expect(s.player).toEqual({ name: 'Rogelio', ...data.start.spawn });
    expect(s.euros).toBe(data.start.euros);
    expect(s.teamSlots).toBe(data.start.teamSlots);
    expect(s.items).toEqual(data.start.items);
    expect(s.storage).toEqual([]);
    expect(s.npcs).toEqual({});
    expect(s.team).toHaveLength(1);
    expect(s.team[0]).toMatchObject({
      speciesId: data.start.starter,
      bonus: { hp: 0, attack: 0, defense: 0, speed: 0 },
      currentHp: data.flexymon.get(data.start.starter)?.stats.hp,
    });
  });

  it('does not share objects with the content', () => {
    const data = gameData();
    const s = newGameState(data, createRng(1), 'A');
    expect(s.items).not.toBe(data.start.items);
  });

  it('throws on an unknown starter', () => {
    const data = gameData();
    expect(() =>
      newGameState({ ...data, start: { ...data.start, starter: 'nadie' } }, createRng(1), 'A'),
    ).toThrow();
  });
});
