import { describe, expect, it } from 'vitest';
import { findBuildings } from '../../tools/make-buildings';
import { zoneSchema } from '../../src/data/schemas';

describe('findBuildings', () => {
  it('finds a house with its door as one rectangle', () => {
    const rows = ['........', '.^^^^^..', '.hhDhh..', '........'];
    expect(findBuildings(rows)).toEqual([{ x: 1, y: 1, width: 5, height: 2 }]);
  });

  it('keeps neighbouring buildings of different materials apart', () => {
    const rows = ['^^^^8888', 'hhhhSSSS'.replace(/S/g, '8')];
    expect(findBuildings(rows)).toEqual([
      { x: 0, y: 0, width: 4, height: 2 },
      { x: 4, y: 0, width: 4, height: 2 },
    ]);
  });

  it('ignores groups under four tiles and layouts without buildings', () => {
    expect(findBuildings(['..^^..', '......'])).toEqual([]);
  });
});

describe('zone building skins', () => {
  const zone = {
    id: 'valencia',
    name: 'Valencia',
    file: 'maps/valencia.tmj',
    region: 'valencia',
    music: 'assets/audio/music/x.ogg',
    indoor: false,
    encounters: {},
  };
  const skin = { id: 'oficina', image: 'assets/buildings/oficina.png', x: 75, y: 5, width: 10, height: 3 };

  it('accepts a zone without skins and with one', () => {
    expect(zoneSchema.safeParse(zone).success).toBe(true);
    expect(zoneSchema.safeParse({ ...zone, buildings: [skin] }).success).toBe(true);
  });

  it('rejects a skin with a bad image path or an empty rectangle', () => {
    expect(zoneSchema.safeParse({ ...zone, buildings: [{ ...skin, image: 'oficina.png' }] }).success).toBe(
      false,
    );
    expect(zoneSchema.safeParse({ ...zone, buildings: [{ ...skin, width: 0 }] }).success).toBe(false);
  });
});
