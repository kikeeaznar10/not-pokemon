import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findSpawn, isBlocked, parseTiledMap, resolveMapPath, tiledProperty } from '../../src/data/tiled';
import { buildTestMap } from '../../tools/make-test-map';

const shipped = () =>
  JSON.parse(readFileSync(join(__dirname, '..', '..', 'public', 'maps', 'test.tmj'), 'utf8')) as unknown;

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

  it('the shipped map is what the tool generates (no hand edits lost)', () => {
    expect(shipped()).toEqual(JSON.parse(JSON.stringify(buildTestMap())));
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
