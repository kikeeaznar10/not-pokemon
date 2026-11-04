import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatDataError } from '../../src/data/errors';
import { loadGameData, type TextFetcher } from '../../src/data/loader';
import type { Json } from './fixture';

const pub = join(__dirname, '..', '..', 'public');
const disk: TextFetcher = async (url) => readFileSync(join(pub, url), 'utf8');

/** Load data + maps from disk, letting `edit(file, json)` change any file first. */
async function load(edit: (file: string, json: Json) => void = () => undefined): Promise<string[] | 'ok'> {
  const fetcher: TextFetcher = async (url) => {
    const json = JSON.parse(await disk(url)) as Json;
    edit(url.replace(/^data\//, ''), json);
    return JSON.stringify(json);
  };
  const result = await loadGameData('data/', fetcher, { mapsBaseUrl: '' });
  return result.ok ? 'ok' : result.errors.map(formatDataError);
}

/** Set a property of a warp object in a map's `warps` layer. */
const setWarp = (map: Json, name: string, prop: string, value: unknown) => {
  const warp = map.layers.find((l: Json) => l.name === 'warps').objects.find((o: Json) => o.name === name);
  const p = warp.properties.find((x: Json) => x.name === prop);
  if (p) p.value = value;
  else warp.properties.push({ name: prop, type: typeof value === 'number' ? 'int' : 'string', value });
};

describe('maps at load time (M4)', () => {
  it('the shipped data and maps load, with the parsed maps in GameData', async () => {
    const result = await loadGameData('data/', disk, { mapsBaseUrl: '' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect([...result.data.maps.keys()]).toEqual(['test', 'test_house', 'test_east']);
    const house = result.data.maps.get('test_house')!;
    expect(house.info).toMatchObject({ width: 10, height: 8 });
    expect(Object.isFrozen(house.info)).toBe(true);
    expect(Object.isFrozen(house.json)).toBe(false);
  });

  it('without mapsBaseUrl, maps are skipped', async () => {
    const result = await loadGameData('data/', disk);
    expect(result.ok && result.data.maps.size).toBe(0);
  });

  it('a warp pointing at a wall fails with a clear message', async () => {
    expect(
      await load((file, json) => {
        if (file === 'maps/test.tmj') {
          setWarp(json, 'house_door', 'toX', 0);
          setWarp(json, 'house_door', 'toY', 0);
        }
      }),
    ).toEqual(['maps/test.tmj › warps.house_door › target tile (0, 0) on map "test_house" is not walkable']);
  });

  it('a warp to an unknown map or outside the target map fails', async () => {
    expect(await load((f, j) => f === 'maps/test.tmj' && setWarp(j, 'house_door', 'toMap', 'luna'))).toEqual([
      'maps/test.tmj › warps.house_door › unknown map "luna"',
    ]);
    expect(await load((f, j) => f === 'maps/test.tmj' && setWarp(j, 'house_door', 'toY', 8))).toEqual([
      'maps/test.tmj › warps.house_door › target tile (4, 8) is outside map "test_house" (10 × 8)',
    ]);
  });

  it('an edge warp checks every row it can land on', async () => {
    const errors = await load((file, json) => {
      if (file !== 'maps/test_east.tmj') return;
      const deco = json.layers.find((l: Json) => l.name === 'deco');
      deco.data[7 * 30 + 0] = 3; // wall at (0, 7): test's east_edge lands there for row 7
    });
    expect(errors).toEqual([
      'maps/test.tmj › warps.east_edge › target tile (0, 7) on map "test_east" is not walkable',
    ]);
  });

  it('NPC spawns, start points, car points and map spawn points must be walkable', async () => {
    expect(
      await load((file, json) => {
        if (file === 'npcs.json') json[0].spawn = { x: 0, y: 0 }; // wall in test_house
        if (file === 'start.json') json.respawn.x = 11; // wall west of the spawn (y 11)
        if (file === 'car.json') json.toMurcia = { map: 'test_east', x: 20, y: 10, facing: 'down' };
        if (file === 'maps/test.tmj') {
          const spawns = json.layers.find((l: Json) => l.name === 'spawns');
          spawns.objects[0].x = 11 * 32;
        }
      }),
    ).toEqual([
      'npcs.json › [0].spawn › tile (0, 0) on map "test_house" is not walkable',
      'start.json › respawn › tile (11, 11) on map "test" is not walkable',
      'car.json › toMurcia › tile (20, 10) on map "test_east" is not walkable',
      'maps/test.tmj › spawns.default › tile (11, 10) on map "test" is not walkable',
    ]);
  });

  it('a missing or broken map file is reported against the map file', async () => {
    const fetcher: TextFetcher = async (url) => {
      if (url.endsWith('test_east.tmj')) throw new Error('HTTP 404');
      if (url.endsWith('test_house.tmj')) return '{"orientation":"isometric"}';
      return disk(url);
    };
    const result = await loadGameData('data/', fetcher, { mapsBaseUrl: '' });
    expect(result.ok ? [] : result.errors.map(formatDataError)).toEqual([
      'maps/test_house.tmj › (root) › orientation: Invalid input: expected "orthogonal"',
      'maps/test_east.tmj › (root) › could not load map (HTTP 404)',
    ]);
  });
});
