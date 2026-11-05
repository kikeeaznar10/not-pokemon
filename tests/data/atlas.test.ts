import { describe, expect, it } from 'vitest';
import { ATLAS_JSON, getAtlas, loadAtlasIndex } from '../../src/data/atlas';

describe('loadAtlasIndex', () => {
  it('fetches the atlas from the base URL and keeps it', async () => {
    const urls: string[] = [];
    const atlas = await loadAtlasIndex('./', async (url) => {
      urls.push(url);
      return JSON.stringify({ frames: { 'assets/sprites/a.png': { frame: { x: 1, y: 1, w: 8, h: 8 } } } });
    });
    expect(urls).toEqual([`./${ATLAS_JSON}`]);
    expect(atlas?.frames.size).toBe(1);
    expect(getAtlas()).toBe(atlas);
  });

  it('a missing or broken atlas gives null', async () => {
    expect(
      await loadAtlasIndex('./', () => {
        throw new Error('HTTP 404');
      }),
    ).toBeNull();
    expect(await loadAtlasIndex('./', async () => '<html>')).toBeNull();
    expect(getAtlas()).toBeNull();
  });
});
