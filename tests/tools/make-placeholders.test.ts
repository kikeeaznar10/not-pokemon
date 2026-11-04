import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { collectAssetPaths, makePng, pngSize, wrapLabel } from '../../tools/make-placeholders';

describe('make-placeholders', () => {
  it('collects asset paths from nested JSON', () => {
    const json = [
      {
        id: 'portatil',
        sprite: { front: 'assets/sprites/flexymon/portatil_front.png' },
        cry: 'assets/audio/sfx/cry_portatil.ogg',
        name: 'Portátil',
        file: 'maps/test.tmj',
      },
      { voice: 'assets/audio/sfx/voice_low.mp3', n: 3, x: null },
    ];
    expect([...collectAssetPaths(json)].sort()).toEqual([
      'assets/audio/sfx/cry_portatil.ogg',
      'assets/audio/sfx/voice_low.mp3',
      'assets/sprites/flexymon/portatil_front.png',
    ]);
  });

  it('chooses sizes from the plan', () => {
    expect(pngSize('assets/sprites/flexymon/portatil_front.png')).toBe(64);
    expect(pngSize('assets/sprites/flexymon/portatil_back.png')).toBe(64);
    expect(pngSize('assets/sprites/flexymon/portatil_icon.png')).toBe(16);
    expect(pngSize('assets/sprites/items/cafe.png')).toBe(16);
    expect(pngSize('assets/sprites/npcs/camarero.png')).toBe(32);
  });

  it('wraps labels on underscores', () => {
    expect(wrapLabel('BAR_PACOS', 5)).toEqual(['BAR', 'PACOS']);
    expect(wrapLabel('PORTATIL', 5)).toEqual(['PORTA', 'TIL']);
  });

  it('writes an opaque PNG of the requested size', () => {
    const png = PNG.sync.read(makePng('raton_front', 64));
    expect(png.width).toBe(64);
    expect(png.height).toBe(64);
    expect(png.data[3]).toBe(255);
  });
});
