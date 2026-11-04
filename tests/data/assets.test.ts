import { describe, expect, it } from 'vitest';
import { collectAssets } from '../../src/data/assets';
import { validateGameData } from '../../src/data/loader';
import { validFiles } from './fixture';

describe('collectAssets', () => {
  it('lists every sprite and sound in the data once, with OGG then MP3 urls', () => {
    const result = validateGameData(validFiles());
    if (!result.ok) throw new Error('fixture invalid');
    const { images, sounds } = collectAssets(result.data);
    // 3 flexymon × 3 sprites + 6 items + 2 NPCs.
    expect(images).toHaveLength(17);
    expect(images).toContain('assets/sprites/flexymon/portatil_icon.png');
    expect(images).toContain('assets/sprites/items/lata.png');
    expect(images).toContain('assets/sprites/npcs/becario.png');
    // 3 cries + 6 attack sounds + 2 voices + 1 music.
    expect(sounds).toHaveLength(12);
    expect(sounds).toContainEqual({
      key: 'assets/audio/music/valencia.ogg',
      urls: ['assets/audio/music/valencia.ogg', 'assets/audio/music/valencia.mp3'],
    });
  });
});
