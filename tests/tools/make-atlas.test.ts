import { describe, expect, it } from 'vitest';
import { atlasJson, packShelves } from '../../tools/make-atlas';
import { parseAtlas } from '../../src/data/atlas';

describe('make-atlas', () => {
  it('packs tallest first in rows, with padding, never overlapping or leaving the width', () => {
    const sizes = [
      { path: 'a', w: 16, h: 16 },
      { path: 'b', w: 64, h: 64 },
      { path: 'c', w: 32, h: 32 },
      { path: 'd', w: 64, h: 64 },
    ];
    const { frames, height } = packShelves(sizes, 140, 1);
    expect(frames.map((f) => f.path)).toEqual(['b', 'd', 'c', 'a']);
    expect(frames[0]).toEqual({ path: 'b', x: 1, y: 1, w: 64, h: 64 });
    expect(frames[1]).toEqual({ path: 'd', x: 67, y: 1, w: 64, h: 64 });
    expect(frames[2]).toEqual({ path: 'c', x: 1, y: 67, w: 32, h: 32 }); // next row
    expect(height).toBe(66 + 34);
    for (const f of frames) expect(f.x + f.w).toBeLessThanOrEqual(140);
    for (const [i, f] of frames.entries())
      for (const g of frames.slice(i + 1))
        expect(f.x + f.w <= g.x || g.x + g.w <= f.x || f.y + f.h <= g.y || g.y + g.h <= f.y).toBe(true);
    expect(() => packShelves([{ path: 'wide', w: 200, h: 8 }], 140)).toThrow(/wider than the atlas/);
  });

  it('writes Phaser JSON hash that the game reads back frame by frame', () => {
    const { frames, height } = packShelves([{ path: 'assets/sprites/items/cafe.png', w: 16, h: 16 }], 64);
    const index = parseAtlas(JSON.parse(JSON.stringify(atlasJson(frames, 64, height))));
    expect(index?.frames.get('assets/sprites/items/cafe.png')).toEqual({ x: 1, y: 1, w: 16, h: 16 });
  });

  it('parseAtlas: anything that is not an atlas is null (sprites then load as files)', () => {
    expect(parseAtlas('<!doctype html>')).toBeNull();
    expect(parseAtlas({ frames: { a: { frame: { x: 0, y: 0, w: 0, h: 4 } } } })).toBeNull();
  });
});
