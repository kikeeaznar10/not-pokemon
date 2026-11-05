import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import {
  buildWorld,
  checkLayout,
  drawWorldTileset,
  findDoormat,
  makeWorld,
  readWorld,
  WT,
  type WorldSpec,
} from '../../tools/make-world';

describe('make-world (M14)', () => {
  it('draws an 8 × 4 tileset of 32 px tiles', () => {
    const ts = PNG.sync.read(drawWorldTileset());
    expect([ts.width, ts.height]).toEqual([256, 128]);
  });

  it('rejects uneven rows and unknown characters', () => {
    expect(() => checkLayout('x', ['..', '.'])).toThrow('x.txt: row 1 has 1 tiles, expected 2');
    expect(() => checkLayout('x', ['.?'])).toThrow('x.txt: unknown tile "?" at (1, 0)');
    expect(() => checkLayout('x', [])).toThrow('x.txt: empty layout');
    expect(() => findDoormat('room', ['###', '#=#', '###'])).toThrow(/doormat/);
  });

  it('builds doors and edges with their way back', () => {
    const world: WorldSpec = {
      maps: {
        out: {
          ground: 'grass',
          spawn: [1, 2],
          doors: [{ x: 1, y: 1, to: 'room' }],
          edges: [{ side: 'east', from: 2, to: 3, map: 'east' }],
        },
        east: { ground: 'sand' },
        room: { ground: 'floor', indoor: true },
      },
    };
    const layouts: Record<string, string[]> = {
      out: ['###', '#D#', '...', '.T.'],
      east: ['ss', 'ss', 'ss', 'ss'],
      room: ['###', '#=#', '#_#'],
    };
    const built = buildWorld(world, (id) => layouts[id]!);
    const props = (o: { properties?: { name: string; value: unknown }[] }) =>
      Object.fromEntries((o.properties ?? []).map((p) => [p.name, p.value]));
    const out = built.get('out')!;
    expect(out.warps.map((w) => [w.name, w.x, w.y, w.width, w.height, props(w)])).toEqual([
      ['door_room', 1, 1, 1, 1, { toMap: 'room', toX: 1, toY: 2, toFacing: 'up', trigger: 'step' }],
      ['edge_east', 3, 2, 1, 2, { toMap: 'east', toX: 0, trigger: 'step' }],
    ]);
    expect(built.get('room')!.warps.map((w) => [w.name, w.x, w.y, props(w)])).toEqual([
      ['exit', 1, 3, { toMap: 'out', toX: 1, toY: 2, toFacing: 'down', trigger: 'step' }],
    ]);
    expect(built.get('east')!.warps.map((w) => [w.name, w.x, w.y, w.height, props(w)])).toEqual([
      ['edge_out', -1, 2, 2, { toMap: 'out', toX: 2, trigger: 'step' }],
    ]);
    // Trees: trunk in deco, blocked in collision, top drawn above on the tile above.
    expect(out.layers.deco[3 * 3 + 1]).toBe(WT.trunk);
    expect(out.layers.collision[3 * 3 + 1]).toBe(WT.blocker);
    expect(out.layers.above[2 * 3 + 1]).toBe(WT.treetop);
    // Deco tiles sit on the map's base ground; spawns default to the doormat indoors.
    expect(out.layers.ground[0]).toBe(WT.grass);
    expect(built.get('room')!.spawns[0]).toMatchObject({ name: 'default', x: 1, y: 2 });
    expect(out.spawns[0]).toMatchObject({ x: 1, y: 2 });
  });

  it('checks that doors and cars are drawn where world.json says', () => {
    const base = { room: { ground: 'floor' as const, indoor: true } };
    const layouts: Record<string, string[]> = { out: ['..'], room: ['_'] };
    expect(() =>
      buildWorld(
        { maps: { out: { ground: 'grass', doors: [{ x: 0, y: 0, to: 'room' }] }, ...base } },
        (id) => layouts[id]!,
      ),
    ).toThrow('world.json › out: door to room at (0, 0) is not a "D" tile');
    expect(() =>
      buildWorld(
        { maps: { out: { ground: 'grass', car: { x: 0, y: 0, to: 'murcia' } } } },
        (id) => layouts[id]!,
      ),
    ).toThrow(/needs "Aa"/);
  });

  it('the shipped layouts build, and the tool never overwrites without --force', () => {
    expect(buildWorld(readWorld()).size).toBe(18);
    expect(makeWorld(false)).toEqual([]);
  });
});
