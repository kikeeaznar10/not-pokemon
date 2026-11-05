// M14: the real world (public/data/ + public/maps/<zone>.tmj) and the switch to the frozen test world.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { formatDataError } from '../../src/data/errors';
import type { GameData } from '../../src/data/game-data';
import { loadGameData } from '../../src/data/loader';
import { isBlocked } from '../../src/data/tiled';
import { chooseDataDir, TEST_WORLD_DATA_DIR, WORLD_DATA_DIR } from '../../src/data/world';
import { blockedWithWarps, warpAt } from '../../src/logic/warp';

const pub = join(__dirname, '..', '..', 'public');

let data: GameData;
let warnings: string[];

beforeAll(async () => {
  const result = await loadGameData('data/', async (url) => readFileSync(join(pub, url), 'utf8'), {
    mapsBaseUrl: '',
  });
  if (!result.ok) throw new Error(result.errors.map(formatDataError).join('\n'));
  data = result.data;
  warnings = (result.warnings ?? []).map(formatDataError);
});

/** Tiles (`map:x,y`) a player can stand on, walking from `start` through step warps (doors and edges). */
function reachable(start: { map: string; x: number; y: number }): Set<string> {
  // Still NPCs block their tile; wanderers move, so they never wall a path off for good.
  const still = new Set(
    [...data.npcs.values()].filter((n) => n.wander === null).map((n) => `${n.map}:${n.spawn.x},${n.spawn.y}`),
  );
  const seen = new Set<string>();
  const queue = [start];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const key = `${cur.map}:${cur.x},${cur.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const map = data.maps.get(cur.map)!.info;
    const blocked = blockedWithWarps(map, map.warps, (x, y) => isBlocked(map, x, y));
    for (const [dx, dy] of [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ] as const) {
      const x = cur.x + dx;
      const y = cur.y + dy;
      if (blocked(x, y) || still.has(`${cur.map}:${x},${y}`)) continue;
      const w = warpAt(map.warps, x, y, 'step');
      if (w) queue.push({ map: w.toMap, x: w.toX ?? x, y: w.toY ?? y });
      else queue.push({ map: cur.map, x, y });
    }
  }
  return seen;
}

/** True if some tile next to (x, y) on `map` is in `tiles`. */
const nextTo = (tiles: Set<string>, map: string, x: number, y: number) =>
  [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ].some(([dx, dy]) => tiles.has(`${map}:${x + dx!},${y + dy!}`));

const VALENCIA_SIDE = ['alboraya', 'huerta_norte', 'valencia', 'playa', 'pueblo_sur'];
const MURCIA_SIDE = ['murcia', 'vinedos', 'poligono'];
const INTERIORS = [
  'oficina_ahora',
  'bar_pacos',
  'bar_las_rusas',
  'tienda_alboraya',
  'tienda_valencia',
  'agora',
  'tienda_sur',
  'isaval',
  'tienda_murcia',
  'ciruelo',
];

describe('the real world (M14)', () => {
  it('loads with zero errors and zero warnings', () => {
    expect(warnings).toEqual([]);
  });

  it('has every planned zone and no test map', () => {
    expect([...data.zones.keys()].sort()).toEqual([...VALENCIA_SIDE, ...MURCIA_SIDE, ...INTERIORS].sort());
    expect(
      [...data.zones.values()]
        .filter((z) => z.indoor)
        .map((z) => z.id)
        .sort(),
    ).toEqual([...INTERIORS].sort());
    for (const id of MURCIA_SIDE) expect(data.zones.get(id)!.region).toBe('murcia');
  });

  it('meets the content target: 12 flexymon, 24 attacks, 8 items, 25 NPCs (15 enemies)', () => {
    expect(data.flexymon.size).toBe(12);
    expect(data.attacks.size).toBe(24);
    expect(data.items.size).toBe(8);
    expect(data.npcs.size).toBe(25);
    expect([...data.npcs.values()].filter((n) => n.type === 'enemy')).toHaveLength(15);
    // Every species and attack is used somewhere.
    const used = new Set([...data.flexymon.values()].flatMap((s) => s.attacks));
    expect(used.size).toBe(24);
    const met = new Set<string>();
    for (const z of data.zones.values())
      for (const g of Object.values(z.encounters)) for (const f of g.flexymon) met.add(f.id);
    // Every species but the starter (handed over in the intro) is met in the wild.
    met.add(data.start.starter);
    expect(met.size).toBe(12);
  });

  it('follows the balance guide: totals 60–100 in Valencia, 100–140 for the Murcia species', () => {
    const total = (id: string) => Object.values(data.flexymon.get(id)!.stats).reduce((a, b) => a + b, 0);
    const murcia = new Set<string>();
    for (const id of MURCIA_SIDE)
      for (const g of Object.values(data.zones.get(id)!.encounters))
        for (const f of g.flexymon) murcia.add(f.id);
    for (const id of data.flexymon.keys()) {
      if (murcia.has(id)) expect(total(id), id).toBeGreaterThanOrEqual(100);
      if (murcia.has(id)) expect(total(id), id).toBeLessThanOrEqual(140);
      else {
        expect(total(id), id).toBeGreaterThanOrEqual(60);
        expect(total(id), id).toBeLessThanOrEqual(100);
      }
    }
  });

  it('from the new-game spawn, every Valencia zone and interior can be walked to, but not Murcia', () => {
    const tiles = reachable(data.start.spawn);
    const maps = new Set([...tiles].map((t) => t.split(':')[0]));
    for (const id of [
      ...VALENCIA_SIDE,
      ...INTERIORS.filter((i) => !['tienda_murcia', 'ciruelo'].includes(i)),
    ])
      expect(maps.has(id), id).toBe(true);
    for (const id of [...MURCIA_SIDE, 'tienda_murcia', 'ciruelo']) expect(maps.has(id), id).toBe(false);
    // The respawn point is on the same walkable network.
    expect(tiles.has(`${data.start.respawn.map}:${data.start.respawn.x},${data.start.respawn.y}`)).toBe(true);
  });

  it('the office car can be reached, and from Murcia every Murcia zone and the car back', () => {
    const valencia = reachable(data.start.spawn);
    const officeCar = data.maps.get('alboraya')!.info.warps.find((w) => w.car === 'murcia')!;
    expect(
      nextTo(valencia, 'alboraya', officeCar.x, officeCar.y + 1) ||
        valencia.has(`alboraya:${officeCar.x},${officeCar.y + 1}`),
    ).toBe(true);
    const murcia = reachable(data.car.toMurcia);
    const maps = new Set([...murcia].map((t) => t.split(':')[0]));
    for (const id of [...MURCIA_SIDE, 'tienda_murcia', 'ciruelo']) expect(maps.has(id), id).toBe(true);
    for (const id of VALENCIA_SIDE) expect(maps.has(id), id).toBe(false);
    const murciaCar = data.maps.get('murcia')!.info.warps.find((w) => w.car === 'valencia')!;
    expect(murcia.has(`murcia:${murciaCar.x},${murciaCar.y + 1}`)).toBe(true);
    // Coming back lands right under the office car.
    expect(data.car.toValencia).toMatchObject({ map: 'alboraya', x: officeCar.x, y: officeCar.y + 1 });
    expect(data.car.toMurcia).toMatchObject({ map: 'murcia', x: murciaCar.x, y: murciaCar.y + 1 });
  });

  it('every NPC can be walked up to and talked to', () => {
    const tiles = new Set([...reachable(data.start.spawn), ...reachable(data.car.toMurcia)]);
    for (const npc of data.npcs.values())
      expect(nextTo(tiles, npc.map, npc.spawn.x, npc.spawn.y), npc.id).toBe(true);
  });

  it('the car items have a source: the keys at the start, a double coffee or a licence in a shop', () => {
    expect(data.start.items).toMatchObject({ llaves_audi: 1 });
    const sold = (id: string) => [...data.shops].filter(([, items]) => items.includes(id)).map(([s]) => s);
    expect(sold('cafe_doble')).toEqual(['bar_las_rusas']);
    expect(sold('carnet')).toEqual(['tienda_sur']);
    expect(data.items.get('cafe_doble')!.price).toBeGreaterThan(0);
    expect(data.items.get('carnet')!.price).toBeGreaterThan(0);
    for (const pair of data.car.unlockPairs) expect(pair).toContain('llaves_audi');
    // Every shop belongs to a shopkeeper, and every town (and both bars) has one.
    const shopkeepers = [...data.npcs.values()].filter((n) => n.type === 'shopkeeper');
    expect(new Set(shopkeepers.map((n) => n.shop))).toEqual(new Set(data.shops.keys()));
    expect(shopkeepers.map((n) => n.map).sort()).toEqual(
      [
        'bar_las_rusas',
        'bar_pacos',
        'tienda_alboraya',
        'tienda_murcia',
        'tienda_sur',
        'tienda_valencia',
      ].sort(),
    );
  });

  it('the office has the healer and the storage box; the intro plays there', () => {
    const office = [...data.npcs.values()].filter((n) => n.map === 'oficina_ahora').map((n) => n.type);
    expect(office.sort()).toEqual(['healer', 'storage']);
    expect(data.start.spawn.map).toBe('oficina_ahora');
    expect(data.start.respawn.map).toBe('oficina_ahora');
  });
});

describe('chooseDataDir (M14)', () => {
  it('uses the real world unless a dev / E2E build asks for the test world', () => {
    expect(chooseDataDir(false, '?world=test', 'test')).toBe(WORLD_DATA_DIR);
    expect(chooseDataDir(true, '', null)).toBe(WORLD_DATA_DIR);
    expect(chooseDataDir(true, '?world=test', null)).toBe(TEST_WORLD_DATA_DIR);
    expect(chooseDataDir(true, '', 'test')).toBe(TEST_WORLD_DATA_DIR);
    // The URL wins over localStorage.
    expect(chooseDataDir(true, '?world=real', 'test')).toBe(WORLD_DATA_DIR);
    expect(chooseDataDir(true, '?debug=1', 'other')).toBe(WORLD_DATA_DIR);
  });
});
