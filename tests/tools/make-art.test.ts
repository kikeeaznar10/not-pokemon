import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { lookFor, NPC_LOOKS } from '../../tools/art/characters';
import { hasFlexymonArt } from '../../tools/art/flexymon';
import { hasItemArt } from '../../tools/art/sprites';
import { artFor, makeArt, PLAYER_PATH } from '../../tools/make-art';
import { readAssetPaths, TITLE_IMAGE } from '../../tools/make-placeholders';

const size = (png: Buffer | null) => {
  expect(png).not.toBeNull();
  const p = PNG.sync.read(png!);
  return [p.width, p.height];
};

describe('make-art (post-M15 restyle)', () => {
  it('draws every sprite at the size the game reads', () => {
    expect(size(artFor(PLAYER_PATH))).toEqual([64, 128]);
    expect(size(artFor('assets/sprites/npcs/jefe.png'))).toEqual([64, 128]);
    expect(size(artFor('assets/sprites/flexymon/portatil_front.png'))).toEqual([64, 64]);
    expect(size(artFor('assets/sprites/flexymon/portatil_back.png'))).toEqual([64, 64]);
    expect(size(artFor('assets/sprites/flexymon/portatil_icon.png'))).toEqual([16, 16]);
    expect(size(artFor('assets/sprites/items/cafe.png'))).toEqual([16, 16]);
    expect(size(artFor('assets/sprites/car/audi.png'))).toEqual([96, 40]);
    expect(size(artFor(TITLE_IMAGE))).toEqual([512, 288]);
  });

  it('still draws new content: unknown flexymon, items and NPCs get generic art', () => {
    expect(size(artFor('assets/sprites/flexymon/nuevo_front.png'))).toEqual([64, 64]);
    expect(size(artFor('assets/sprites/items/nuevo.png'))).toEqual([16, 16]);
    expect(lookFor('nuevo_npc')).toEqual(lookFor('nuevo_npc'));
    expect(artFor('assets/audio/sfx/hit.ogg')).toBeNull();
    expect(artFor('assets/ui/minimap_test.png')).toBeNull();
  });

  it('has hand-made art for every flexymon, item and NPC sprite in the content', () => {
    const paths = readAssetPaths();
    const missing = paths.filter((p) => {
      const name = p.split('/').pop()!.replace('.png', '');
      if (p.startsWith('assets/sprites/flexymon/'))
        return !hasFlexymonArt(name.replace(/_(front|back|icon)$/, ''));
      if (p.startsWith('assets/sprites/items/')) return !hasItemArt(name);
      if (p.startsWith('assets/sprites/npcs/')) return !(name in NPC_LOOKS);
      return false;
    });
    expect(missing).toEqual([]);
  });

  it('never overwrites existing files without --force', () => {
    expect(makeArt(false)).toEqual([]);
  });
});
