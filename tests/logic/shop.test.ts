import { describe, expect, it } from 'vitest';
import { buy, sell } from '../../src/logic/economy';
import { buyRows, rowError, sellRows, shopStock, stepQuantity, totalPrice } from '../../src/logic/shop';
import { gameData } from './helpers';

const data = gameData();
const cafe = data.items.get('cafe')!;

describe('shop rows', () => {
  it('the stock is the shop list in file order', () => {
    expect(shopStock('tienda_alboraya', data).map((i) => i.id)).toEqual(['cafe', 'redbull', 'regleta']);
    expect(() => shopStock('nope', data)).toThrow('unknown shop');
  });

  it('buy rows: price and how many money and bag allow', () => {
    const rows = buyRows('tienda_alboraya', data, 200, { cafe: 3 });
    expect(rows.map((r) => [r.id, r.price, r.owned, r.limit])).toEqual([
      ['cafe', 50, 3, 4],
      ['redbull', 120, 0, 1],
      ['regleta', 1000, 0, 0],
    ]);
    expect(rows[0]!.name).toBe('Café');
    expect(rows[0]!.description).toBe('Recupera 20 PS.');
    // Bag room and the 99 cap limit too.
    expect(buyRows('tienda_alboraya', data, 999_999, { cafe: 97 })[0]!.limit).toBe(2);
    expect(buyRows('tienda_alboraya', data, 999_999, {})[0]!.limit).toBe(99);
  });

  it('sell rows: every bag item, half price; key items listed but not sellable', () => {
    const rows = sellRows(data, { cafe: 3, llaves_audi: 1, nada: 2, redbull: 0 });
    expect(rows.map((r) => [r.id, r.price, r.owned, r.limit])).toEqual([
      ['cafe', 25, 3, 3],
      ['llaves_audi', null, 1, 0],
    ]);
  });

  it('rowError says why nothing can be picked', () => {
    const [cafeRow, , regleta] = buyRows('tienda_alboraya', data, 200, {});
    expect(rowError('buy', cafeRow!, 200)).toBeNull();
    expect(rowError('buy', regleta!, 200)).toBe('not_enough_money');
    const full = buyRows('tienda_alboraya', data, 200, { cafe: 99 })[0]!;
    expect(rowError('buy', full, 200)).toBe('bag_full');
    const keys = sellRows(data, { llaves_audi: 1 })[0]!;
    expect(rowError('sell', keys, 200)).toBe('not_for_sale');
    expect(rowError('sell', sellRows(data, { cafe: 1 })[0]!, 0)).toBeNull();
  });
});

describe('quantity picker', () => {
  it('stays within 1 … limit', () => {
    expect(stepQuantity(1, 1, 4)).toBe(2);
    expect(stepQuantity(4, 1, 4)).toBe(4);
    expect(stepQuantity(1, -1, 4)).toBe(1);
    expect(stepQuantity(1, 10, 99)).toBe(11);
    expect(stepQuantity(5, -10, 99)).toBe(1);
    expect(stepQuantity(3, 10, 4)).toBe(4);
    expect(stepQuantity(1, 1, 0)).toBe(0);
    expect(totalPrice(50, 3)).toBe(150);
  });
});

describe('buying 3 Cafés with 200 € leaves 50 € and 3 more Cafés; selling one gives 25 €', () => {
  it('works through the economy rules', () => {
    const start = { cafe: 3 };
    const limit = buyRows('tienda_alboraya', data, 200, start)[0]!.limit;
    expect(limit).toBeGreaterThanOrEqual(3);
    const bought = buy(200, start, cafe, 3);
    expect(bought).toEqual({ ok: true, euros: 50, items: { cafe: 6 } });
    if (!bought.ok) return;
    const sold = sell(bought.euros, bought.items, cafe, 1);
    expect(sold).toEqual({ ok: true, euros: 75, items: { cafe: 5 } });
  });
});
