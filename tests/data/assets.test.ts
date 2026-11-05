import { describe, expect, it } from 'vitest';
import { collectAssets } from '../../src/data/assets';
import { validateGameData } from '../../src/data/loader';
import { validFiles } from './fixture';

describe('collectAssets', () => {
  it('lists every sprite and sound in the data once, with OGG then MP3 urls', () => {
    const result = validateGameData(validFiles());
    if (!result.ok) throw new Error('fixture invalid');
    const { images, sounds } = collectAssets(result.data);
    // 3 flexymon × 3 sprites + 6 items + 5 NPCs (M9 added the healer, storage and shopkeeper)
    // + M11's title image and intro coworker.
    expect(images).toHaveLength(22);
    expect(images).toContain('assets/ui/title.png');
    expect(images).toContain('assets/sprites/npcs/companera.png');
    expect(images).toContain('assets/sprites/flexymon/portatil_icon.png');
    expect(images).toContain('assets/sprites/items/lata.png');
    expect(images).toContain('assets/sprites/npcs/becario.png');
    // 3 cries + 6 attack sounds + 2 voices + 2 music (test, interior) + M11's jingle (the coworker reuses a voice).
    expect(sounds).toHaveLength(14);
    expect(sounds.map((s) => s.key)).toContain('assets/audio/sfx/jingle_starter.ogg');
    expect(sounds).toContainEqual({
      key: 'assets/audio/music/test.ogg',
      urls: ['assets/audio/music/test.ogg', 'assets/audio/music/test.mp3'],
    });
  });
});
