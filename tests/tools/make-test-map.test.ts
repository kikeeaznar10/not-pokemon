import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { drawPlayer, drawTileset, makeTestMap } from '../../tools/make-test-map';

describe('make-test-map', () => {
  it('draws an 8 × 2 tileset and a 2 × 4 player sheet of 32 px tiles', () => {
    const ts = PNG.sync.read(drawTileset());
    expect([ts.width, ts.height]).toEqual([256, 64]);
    const pl = PNG.sync.read(drawPlayer());
    expect([pl.width, pl.height]).toEqual([64, 128]);
  });

  it('never overwrites existing files without --force', () => {
    expect(makeTestMap(false)).toEqual([]);
  });
});
