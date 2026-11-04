import { describe, expect, it } from 'vitest';
import { addItem, hasItem, itemCount, removeItem, roomFor } from '../../src/logic/inventory';

describe('inventory', () => {
  it('counts, adds up to 99 and removes', () => {
    const bag = { cafe: 98 };
    expect(itemCount(bag, 'cafe')).toBe(98);
    expect(itemCount(bag, 'redbull')).toBe(0);
    expect(hasItem(bag, 'cafe')).toBe(true);
    expect(roomFor(bag, 'cafe')).toBe(1);
    expect(addItem(bag, 'cafe', 5)).toEqual({ items: { cafe: 99 }, added: 1 });
    expect(addItem(bag, 'redbull', 2)).toEqual({ items: { cafe: 98, redbull: 2 }, added: 2 });
    expect(addItem({ cafe: 99 }, 'cafe', 1)).toEqual({ items: { cafe: 99 }, added: 0 });
    expect(removeItem(bag, 'cafe', 1)).toEqual({ cafe: 97 });
    expect(removeItem({ cafe: 1 }, 'cafe', 1)).toEqual({});
    expect(removeItem(bag, 'redbull', 1)).toBeNull();
    expect(removeItem(bag, 'cafe', -1)).toBeNull();
    expect(bag).toEqual({ cafe: 98 });
  });
});
