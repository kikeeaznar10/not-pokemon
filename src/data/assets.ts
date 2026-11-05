/**
 * Lists every asset referenced by the content, for the Preload scene.
 * Each asset is loaded with its JSON path as the Phaser key (e.g. `assets/sprites/items/cafe.png`).
 */
import type { GameData } from './game-data';

/** A sound to load: the key (path as written in the JSON) and the OGG/MP3 URLs to try, in order. */
export interface SoundAsset {
  key: string;
  urls: string[];
}

/** Every image path and sound referenced by the data, de-duplicated and sorted. */
export interface AssetList {
  images: string[];
  sounds: SoundAsset[];
}

/** Collect sprites (flexymon, items, NPCs, M11 title + coworker) and sounds (cries, attacks, voices, zone music, M11 jingle). */
export function collectAssets(data: GameData): AssetList {
  const images = new Set<string>();
  const sounds = new Set<string>();
  for (const sp of data.flexymon.values()) {
    images.add(sp.sprite.front).add(sp.sprite.back).add(sp.sprite.icon);
    sounds.add(sp.cry);
  }
  for (const it of data.items.values()) images.add(it.sprite);
  for (const npc of data.npcs.values()) {
    images.add(npc.sprite);
    sounds.add(npc.voice);
  }
  for (const a of data.attacks.values()) sounds.add(a.sound);
  for (const z of data.zones.values()) sounds.add(z.music);
  // M11: the title image, the intro coworker and the handover jingle.
  images.add(data.intro.titleImage).add(data.intro.coworker.sprite);
  sounds.add(data.intro.coworker.voice).add(data.intro.jingle);

  return {
    images: [...images].sort(),
    sounds: [...sounds].sort().map((key) => {
      const stem = key.replace(/\.(ogg|mp3)$/, '');
      return { key, urls: [`${stem}.ogg`, `${stem}.mp3`] };
    }),
  };
}
