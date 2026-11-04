import { describe, expect, it } from 'vitest';
import { errorsAfter, type Json } from './fixture';

describe('cross-references (one test per rule)', () => {
  it('attack ids in flexymon', () => {
    expect(errorsAfter((f) => (f['flexymon.json'][0].attacks[0] = 'compilarr'))).toEqual([
      'flexymon.json › [0].attacks[0] › unknown attack "compilarr"',
    ]);
  });

  it('flexymon ids in NPC teams', () => {
    expect(errorsAfter((f) => (f['npcs.json'][1].team[1] = 'monitor'))).toEqual([
      'npcs.json › [1].team[1] › unknown flexymon "monitor"',
    ]);
  });

  it('flexymon id of the starter', () => {
    expect(errorsAfter((f) => (f['start.json'].starter = 'monitor'))).toEqual([
      'start.json › starter › unknown flexymon "monitor"',
    ]);
  });

  it('flexymon ids in encounters', () => {
    expect(errorsAfter((f) => (f['zones.json'][0].encounters.jardin_turia.flexymon[1].id = 'movil'))).toEqual(
      ['zones.json › [0].encounters.jardin_turia.flexymon[1].id › unknown flexymon "movil"'],
    );
  });

  it('item ids in shops, and shops only sell buyable items', () => {
    expect(errorsAfter((f) => f['shops.json'].tienda_alboraya.push('chupito'))).toEqual([
      'shops.json › tienda_alboraya[3] › unknown item "chupito"',
    ]);
    expect(errorsAfter((f) => f['shops.json'].tienda_alboraya.push('llaves_audi'))).toEqual([
      'shops.json › tienda_alboraya[3] › item "llaves_audi" has price null and cannot be sold',
    ]);
  });

  it('item ids in start', () => {
    expect(errorsAfter((f) => (f['start.json'].items.chupito = 1))).toEqual([
      'start.json › items.chupito › unknown item "chupito"',
    ]);
  });

  it('item ids in secret names', () => {
    expect(errorsAfter((f) => (f['secret-names.json'][0].items.chupito = 2))).toEqual([
      'secret-names.json › [0].items.chupito › unknown item "chupito"',
    ]);
  });

  it('item ids in the car pairs', () => {
    expect(errorsAfter((f) => (f['car.json'].unlockPairs[1][1] = 'gasolina'))).toEqual([
      'car.json › unlockPairs[1][1] › unknown item "gasolina"',
    ]);
  });

  it('shop ids in shopkeepers', () => {
    const toShopkeeper = (shop: string) => (f: Record<string, Json>) => {
      f['npcs.json'][0] = { ...f['npcs.json'][0], type: 'shopkeeper', shop };
    };
    expect(errorsAfter(toShopkeeper('tienda_alboraya'))).toEqual([]);
    expect(errorsAfter(toShopkeeper('tienda_murcia'))).toEqual([
      'npcs.json › [0].shop › unknown shop "tienda_murcia"',
    ]);
  });

  it('map ids in NPCs, start, car', () => {
    expect(errorsAfter((f) => (f['npcs.json'][0].map = 'bar_pacos'))).toEqual([
      'npcs.json › [0].map › unknown map "bar_pacos"',
    ]);
    expect(
      errorsAfter((f) => {
        f['start.json'].spawn.map = 'oficina_ahora';
        f['start.json'].respawn.map = 'oficina_ahora';
      }),
    ).toEqual([
      'start.json › spawn.map › unknown map "oficina_ahora"',
      'start.json › respawn.map › unknown map "oficina_ahora"',
    ]);
    expect(
      errorsAfter((f) => {
        f['car.json'].toMurcia.map = 'murcia';
        f['car.json'].toValencia.map = 'oficina_exterior';
      }),
    ).toEqual([
      'car.json › toMurcia.map › unknown map "murcia"',
      'car.json › toValencia.map › unknown map "oficina_exterior"',
    ]);
  });

  it('ids are unique in each collection', () => {
    expect(errorsAfter((f) => (f['flexymon.json'][2].id = 'raton'))).toContain(
      'flexymon.json › [2].id › duplicate id "raton"',
    );
    expect(errorsAfter((f) => (f['attacks.json'][1].id = 'compilar'))).toContain(
      'attacks.json › [1].id › duplicate id "compilar"',
    );
    expect(errorsAfter((f) => (f['items.json'][1].id = 'cafe'))).toContain(
      'items.json › [1].id › duplicate id "cafe"',
    );
    expect(errorsAfter((f) => (f['npcs.json'][1].id = 'camarero_pacos'))).toEqual([
      'npcs.json › [1].id › duplicate id "camarero_pacos"',
    ]);
    expect(errorsAfter((f) => f['zones.json'].push({ ...f['zones.json'][0] }))).toEqual([
      'zones.json › [1].id › duplicate id "valencia"',
    ]);
  });

  it('secret names may not match each other', () => {
    expect(
      errorsAfter((f) => f['secret-names.json'].push({ ...f['secret-names.json'][0], name: '  PÁCO ' })),
    ).toEqual(['secret-names.json › [1].name › "PÁCO" matches the same names as entry [0]']);
    expect(
      errorsAfter((f) => f['secret-names.json'].push({ ...f['secret-names.json'][0], name: 'pacoo' })),
    ).toEqual([]);
  });
});
