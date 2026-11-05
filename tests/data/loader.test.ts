import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatDataError, formatPath } from '../../src/data/errors';
import { getGameData, hasGameData, setGameData } from '../../src/data/game-data';
import { loadGameData, type TextFetcher } from '../../src/data/loader';

const dir = join(__dirname, '..', '..', 'public', 'test-world', 'data');
const diskFetcher: TextFetcher = async (url) => readFileSync(join(dir, url.replace('data/', '')), 'utf8');

describe('loader', () => {
  it('loads the shipped data into frozen lookup maps', async () => {
    const result = await loadGameData('data/', diskFetcher);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const data = result.data;
    expect(data.flexymon.get('portatil')?.name).toBe('Portátil');
    expect([...data.flexymon.keys()]).toEqual(['portatil', 'raton', 'teclado']);
    expect(data.attacks.size).toBe(6);
    expect(data.items.get('llaves_audi')?.price).toBeNull();
    expect(data.npcs.get('becario_rio')?.type).toBe('enemy');
    expect(data.zones.get('test')?.indoor).toBe(false);
    expect(data.zones.get('test_house')?.indoor).toBe(true);
    expect(data.shops.get('tienda_alboraya')).toEqual(['cafe', 'redbull', 'regleta']);
    expect(data.start.starter).toBe('portatil');
    expect(data.secretNames[0]?.name).toBe('paco');
    expect(data.car.unlockPairs).toHaveLength(2);

    // Frozen all the way down.
    expect(Object.isFrozen(data)).toBe(true);
    expect(Object.isFrozen(data.flexymon.get('portatil')?.stats)).toBe(true);
    expect(() => (data.flexymon as Map<string, unknown>).set('x', {})).toThrow();
    expect(() => (data.start as { euros: number }).euros++).toThrow();
  });

  it('reports a missing file and invalid JSON as file › (root) errors', async () => {
    const fetcher: TextFetcher = async (url) => {
      if (url.endsWith('car.json')) throw new Error('HTTP 404');
      if (url.endsWith('shops.json')) return '{ "tienda": [ }';
      return diskFetcher(url);
    };
    const result = await loadGameData('data/', fetcher);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const lines = result.errors.map(formatDataError);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^shops\.json › \(root\) › invalid JSON/);
    expect(lines[1]).toBe('car.json › (root) › could not load file (HTTP 404)');
  });

  it('store: getGameData throws before data is set', async () => {
    expect(hasGameData()).toBe(false);
    expect(() => getGameData()).toThrow();
    const result = await loadGameData('data/', diskFetcher);
    if (result.ok) setGameData(result.data);
    expect(getGameData().flexymon.size).toBe(3);
  });
});

describe('formatPath', () => {
  it('formats file › path › message', () => {
    expect(formatPath([3, 'team', 0])).toBe('[3].team[0]');
    expect(formatPath(['spawn', 'map'])).toBe('spawn.map');
    expect(formatPath(['unlockPairs', 1, 1])).toBe('unlockPairs[1][1]');
    expect(formatPath([])).toBe('(root)');
  });
});
