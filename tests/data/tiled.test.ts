import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findSpawn, isBlocked, parseTiledMap, resolveMapPath, tiledProperty } from '../../src/data/tiled';
import { buildTestEast, buildTestHouse, buildTestMap } from '../../tools/make-test-map';

const shipped = (name = 'test') =>
  JSON.parse(readFileSync(join(__dirname, '..', '..', 'public', 'maps', `${name}.tmj`), 'utf8')) as unknown;

describe('Tiled maps', () => {
  it('resolves tileset paths relative to the map', () => {
    expect(resolveMapPath('maps/test.tmj', '../assets/tilesets/test.png')).toBe('assets/tilesets/test.png');
    expect(resolveMapPath('maps/sub/a.tmj', './b.png')).toBe('maps/sub/b.png');
  });

  it('reads properties', () => {
    expect(tiledProperty([{ name: 'solid', value: true }], 'solid')).toBe(true);
    expect(tiledProperty(undefined, 'solid')).toBeUndefined();
  });

  it('the shipped test map: 30 × 20, walls, water, hidden collision, open path, edges, spawn', () => {
    const info = parseTiledMap(shipped(), 'maps/test.tmj');
    expect(info.width).toBe(30);
    expect(info.height).toBe(20);
    expect(info.tilesetImages).toEqual([{ name: 'test', path: 'assets/tilesets/test.png' }]);
    expect(findSpawn(info)).toEqual({ name: 'default', x: 15, y: 10 });
    expect(findSpawn(info, 'nope')).toBeNull();
    expect(isBlocked(info, 11, 10)).toBe(true); // wall (deco, solid property)
    expect(isBlocked(info, 20, 13)).toBe(true); // water (ground, solid property)
    expect(isBlocked(info, 18, 6)).toBe(true); // tree trunk: blocked by the hidden collision layer
    expect(isBlocked(info, 18, 5)).toBe(false); // tree top is drawn above, walkable
    expect(isBlocked(info, 12, 10)).toBe(false);
    expect(isBlocked(info, 13, 7)).toBe(false); // flowers
    for (let y = 0; y <= 10; y += 1) expect(isBlocked(info, 15, y)).toBe(false);
    expect(isBlocked(info, -1, 0)).toBe(true);
    expect(isBlocked(info, 30, 0)).toBe(true);
    expect(isBlocked(info, 0, 20)).toBe(true);
    expect(info.encounter.some(Boolean)).toBe(false); // tall grass comes in M7
  });

  it('the shipped maps are what the tool generates (no hand edits lost)', () => {
    expect(shipped()).toEqual(JSON.parse(JSON.stringify(buildTestMap())));
    expect(shipped('test_house')).toEqual(JSON.parse(JSON.stringify(buildTestHouse())));
    expect(shipped('test_east')).toEqual(JSON.parse(JSON.stringify(buildTestEast())));
  });

  it('reads warps: door, off-map edge (row kept), interior exit', () => {
    const test = parseTiledMap(shipped(), 'maps/test.tmj');
    expect(test.warps).toEqual([
      {
        name: 'house_door',
        x: 6,
        y: 6,
        width: 1,
        height: 1,
        toMap: 'test_house',
        toX: 4,
        toY: 7,
        toFacing: 'up',
        trigger: 'step',
      },
      {
        name: 'east_edge',
        x: 30,
        y: 0,
        width: 1,
        height: 20,
        toMap: 'test_east',
        toX: 0,
        toY: null,
        toFacing: null,
        trigger: 'step',
      },
    ]);
    expect(isBlocked(test, 6, 6)).toBe(false); // the door tile is walkable
    const house = parseTiledMap(shipped('test_house'), 'maps/test_house.tmj');
    expect(house.warps[0]).toMatchObject({ x: 4, y: 8, toMap: 'test', toX: 6, toY: 7, toFacing: 'down' });
    const east = parseTiledMap(shipped('test_east'), 'maps/test_east.tmj');
    expect(east.warps[0]).toMatchObject({ x: -1, y: 0, height: 20, toMap: 'test', toX: 29, toY: null });
  });

  it('rejects a warp with missing or wrong properties, naming it', () => {
    const map = buildTestMap() as {
      layers: { name: string; objects?: { name: string; properties?: object[] }[] }[];
    };
    const warps = map.layers.find((l) => l.name === 'warps')!.objects!;
    warps[0]!.properties = [{ name: 'toMap', type: 'string', value: 'x' }];
    expect(() => parseTiledMap(map, 'maps/x.tmj')).toThrow(/maps\/x\.tmj: warp "house_door": trigger/);
    warps[0]!.name = '';
    warps[0]!.properties = [
      { name: 'toMap', value: 'x' },
      { name: 'trigger', value: 'step' },
      { name: 'toFacing', value: 'sideways' },
    ];
    expect(() => parseTiledMap(map, 'maps/x.tmj')).toThrow(/warp #0: toFacing/);
    warps[0]!.properties = [{ name: 'trigger', value: 'step' }];
    expect(() => parseTiledMap(map, 'maps/x.tmj')).toThrow(/needs a toMap property/);
  });

  it('flags encounter tiles and strips flip bits', () => {
    const map = buildTestMap() as { layers: { name: string; data?: number[] }[] };
    const ground = map.layers.find((l) => l.name === 'ground')!;
    ground.data![0] = 8; // tall grass (local id 7)
    ground.data![1] = (0x80000000 | 3) >>> 0; // flipped wall (local id 2)
    const info = parseTiledMap(map, 'maps/test.tmj');
    expect(info.encounter[0]).toBe(true);
    expect(isBlocked(info, 1, 0)).toBe(true);
  });

  it('rejects invalid maps with a readable message', () => {
    expect(() => parseTiledMap({ orientation: 'isometric' }, 'maps/x.tmj')).toThrow(
      /maps\/x\.tmj: orientation/,
    );
    const map = buildTestMap() as { layers: { data?: number[] }[] };
    map.layers[0]!.data = [1, 2, 3];
    expect(() => parseTiledMap(map, 'maps/x.tmj')).toThrow(/has 3 cells, expected 600/);
    expect(() => parseTiledMap(null, 'maps/x.tmj')).toThrow(/\(root\)/);
  });

  it('maps without a spawns layer have no spawn points', () => {
    const map = buildTestMap() as { layers: { name: string }[] };
    map.layers = map.layers.filter((l) => l.name !== 'spawns');
    expect(parseTiledMap(map, 'maps/x.tmj').spawns).toEqual([]);
  });
});
