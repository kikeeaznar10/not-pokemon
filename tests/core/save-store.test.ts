import { describe, expect, it } from 'vitest';
import { BROKEN_SAVE_KEY, SAVE_KEY, SaveStore, type KeyValueStore } from '../../src/core/save-store';
import type { GameState } from '../../src/logic/save';
import { gameData, inst } from '../logic/helpers';
import { memoryStorage } from './memory-storage';

const data = gameData();

const state = (): GameState => ({
  player: { name: 'Rogelio', map: 'test', x: 4, y: 6, facing: 'left' },
  euros: 340,
  teamSlots: 2,
  team: [inst('portatil', 'a1', { bonus: { hp: 4, attack: 0, defense: 1, speed: 0 }, currentHp: 31 })],
  storage: [inst('raton', 'b2')],
  items: { cafe: 2 },
  npcs: { becario_rio: 'cooldown' },
});

describe('SaveStore', () => {
  it('writes to flexymon.save.v1 and loads the same state back', () => {
    const mem = memoryStorage();
    const store = new SaveStore(mem);
    expect(store.load(data)).toEqual({ status: 'none' });
    expect(store.write(state(), new Date('2026-11-05T10:00:00Z'))).toBe(true);
    expect(SAVE_KEY).toBe('flexymon.save.v1');
    expect(JSON.parse(mem.map.get(SAVE_KEY) ?? '')).toMatchObject({
      version: 1,
      savedAt: '2026-11-05T10:00:00.000Z',
    });
    const loaded = store.load(data);
    expect(loaded.status).toBe('loaded');
    if (loaded.status !== 'loaded') return;
    expect(loaded.state).toEqual(state());
    expect(loaded.warnings).toEqual([]);
  });

  it('garbage is copied to flexymon.save.broken and reported, never thrown', () => {
    const mem = memoryStorage({ [SAVE_KEY]: 'garbage{' });
    const outcome = new SaveStore(mem).load(data);
    expect(outcome).toMatchObject({ status: 'broken', reason: 'invalid_json' });
    expect(BROKEN_SAVE_KEY).toBe('flexymon.save.broken');
    expect(mem.map.get(BROKEN_SAVE_KEY)).toBe('garbage{');
  });

  it('a save that fails its schema is broken too', () => {
    const mem = memoryStorage({ [SAVE_KEY]: JSON.stringify({ version: 1, team: 'x' }) });
    expect(new SaveStore(mem).load(data)).toMatchObject({ status: 'broken', reason: 'invalid_schema' });
    expect(mem.map.has(BROKEN_SAVE_KEY)).toBe(true);
  });

  it('migration warnings are passed on (unknown ids dropped)', () => {
    const mem = memoryStorage();
    const store = new SaveStore(mem);
    store.write({ ...state(), items: { cafe: 2, nada: 1 } });
    const loaded = store.load(data);
    expect(loaded.status).toBe('loaded');
    if (loaded.status === 'loaded') {
      expect(loaded.state.items).toEqual({ cafe: 2 });
      expect(loaded.warnings).toEqual(['dropped unknown item "nada"']);
    }
  });

  it('remove deletes only the save', () => {
    const mem = memoryStorage({ [BROKEN_SAVE_KEY]: 'old' });
    const store = new SaveStore(mem);
    store.write(state());
    store.remove();
    expect(store.raw()).toBeNull();
    expect(mem.map.get(BROKEN_SAVE_KEY)).toBe('old');
  });

  it('a storage that throws (full, blocked) or is missing never breaks the game', () => {
    const throwing: KeyValueStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    const store = new SaveStore(throwing);
    expect(store.write(state())).toBe(false);
    expect(store.load(data)).toEqual({ status: 'none' });
    expect(() => store.remove()).not.toThrow();
    const none = new SaveStore(null);
    expect(none.write(state())).toBe(false);
    expect(none.load(data)).toEqual({ status: 'none' });
  });
});
