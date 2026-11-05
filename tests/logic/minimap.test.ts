import { describe, expect, it } from 'vitest';
import { MINIMAP_MAX_H, MINIMAP_MAX_W } from '../../src/logic/constants';
import { minimapCells, minimapDot, minimapLayout, minimapPath } from '../../src/logic/minimap';

describe('minimap', () => {
  it('names each zone image after its id', () => {
    expect(minimapPath('valencia')).toBe('assets/ui/minimap_valencia.png');
  });

  it('keeps an image that fits, at its own size', () => {
    expect(minimapLayout(90, 60, MINIMAP_MAX_W, MINIMAP_MAX_H, 4, 4)).toEqual({
      x: 4,
      y: 4,
      width: 90,
      height: 60,
      scale: 1,
    });
  });

  it('scales a big image down uniformly to fit, never up', () => {
    const wide = minimapLayout(256, 64, 128, 96);
    expect(wide.scale).toBe(0.5);
    expect([wide.width, wide.height]).toEqual([128, 32]);
    const tall = minimapLayout(100, 192, 128, 96);
    expect(tall.scale).toBe(0.5);
    expect([tall.width, tall.height]).toEqual([50, 96]);
    expect(minimapLayout(10, 10, 128, 96).scale).toBe(1);
  });

  it('puts the dot at the centre of the tile, scaled like the image', () => {
    const layout = minimapLayout(90, 60, 128, 96, 4, 4); // 30 × 20 map at 3 px per tile
    expect(minimapDot(layout, 30, 20, 0, 0)).toEqual({ x: 5.5, y: 5.5 });
    expect(minimapDot(layout, 30, 20, 15, 10)).toEqual({ x: 4 + 46.5, y: 4 + 31.5 });
    expect(minimapDot(layout, 30, 20, 29, 19)).toEqual({ x: 4 + 88.5, y: 4 + 58.5 });
    // Real art at another size: the dot follows the map's tiles, not the image's pixels.
    const art = minimapLayout(300, 200, 128, 96); // scale 0.427 → 128 × 85.33
    const dot = minimapDot(art, 30, 20, 15, 10);
    expect(dot.x).toBeCloseTo((15.5 / 30) * 128);
    expect(dot.y).toBeCloseTo((10.5 / 20) * (200 * (128 / 300)));
  });

  it('marks cells solid, encounter or open (solid wins)', () => {
    const map = {
      width: 2,
      height: 2,
      solid: [true, false, false, true],
      encounter: [true, true, false, false],
    };
    expect(minimapCells(map)).toEqual(['solid', 'encounter', 'open', 'solid']);
  });
});
