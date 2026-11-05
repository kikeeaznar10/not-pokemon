/**
 * PreloadScene — loads every sprite and sound listed in the content data, using its JSON path as the
 * Phaser key (`this.textures.exists('assets/sprites/items/cafe.png')`), plus every map's tileset images
 * and the player sheet. Sounds load the OGG, falling
 * back to the MP3 with the same name (also the title image, the intro coworker and the jingle, all
 * listed by `collectAssets`). Sprites held by the sprite atlas (`src/data/atlas.ts`) come from that one image
 * and are copied into textures under their own paths. When done it emits `game:ready`, launches the HudScene (save icon) and
 * the DebugScene when debugging is enabled, and starts the TitleScene, which reads the save.
 */
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, TILE_SIZE } from '../config/game';
import { PLAYER_SPRITE } from '../world/player';
import { BOOT_SCENE } from './boot-scene';
import { DEBUG_SCENE, debugEnabled } from './debug-scene';
import { HUD_SCENE } from './hud-scene';
import { TITLE_SCENE } from './title-scene';
import { events } from '../core/events';
import { error, log } from '../core/log';
import { collectAssets } from '../data/assets';
import { ATLAS_IMAGE, ATLAS_KEY, getAtlas } from '../data/atlas';
import { getGameData } from '../data/game-data';
import { t } from '../i18n';

/** Scene key of {@link PreloadScene}. */
export const PRELOAD_SCENE = 'Preload';

/** Loads all content assets, then starts the title. */
export class PreloadScene extends Phaser.Scene {
  /** Sprite paths taken from the atlas; empty without one. */
  fromAtlas: string[] = [];
  /** True once every asset finished loading (read by the E2E hooks). */
  complete = false;
  /** Keys of files that failed to load. */
  failed: string[] = [];

  constructor() {
    super(PRELOAD_SCENE);
  }

  preload(): void {
    const assets = collectAssets(getGameData());
    // Sprites in the atlas come from one image; the rest (and everything without an atlas) load as files.
    const atlas = getAtlas();
    this.fromAtlas = atlas ? assets.images.filter((p) => atlas.frames.has(p)) : [];
    for (const path of assets.images) if (!this.fromAtlas.includes(path)) this.load.image(path, path);
    if (atlas && this.fromAtlas.length > 0) this.load.atlas(ATLAS_KEY, ATLAS_IMAGE, atlas.json);
    for (const s of assets.sounds) this.load.audio(s.key, s.urls);
    // Map art: every tileset image used by a zone map, plus the player sheet.
    const tilesets = new Set<string>();
    for (const m of getGameData().maps.values()) for (const ts of m.info.tilesetImages) tilesets.add(ts.path);
    for (const path of tilesets) this.load.image(path, path);
    this.load.spritesheet(PLAYER_SPRITE, PLAYER_SPRITE, { frameWidth: TILE_SIZE, frameHeight: TILE_SIZE });

    const barW = GAME_WIDTH / 2;
    const x = (GAME_WIDTH - barW) / 2;
    const y = GAME_HEIGHT / 2 + 24;
    const label = this.add.text(GAME_WIDTH / 2, y - 14, t('boot.loading'), {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ffffff',
    });
    label.setOrigin(0.5);
    const frame = this.add.rectangle(x, y, barW, 6).setOrigin(0).setStrokeStyle(1, 0xffffff);
    const bar = this.add.rectangle(x + 1, y + 1, 0, 4, 0xffffff).setOrigin(0);
    this.load.on('progress', (p: number) => bar.setSize((barW - 2) * p, 4));
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      if (file.key === ATLAS_KEY) {
        // No atlas image after all: load its sprites as files.
        error(`Could not load the sprite atlas (${file.url}); loading sprites one by one`);
        for (const path of this.fromAtlas) this.load.image(path, path);
        this.fromAtlas = [];
        return;
      }
      this.failed.push(file.key);
      error(`Could not load asset "${file.key}" (${file.url})`);
    });
    this.load.once('complete', () => {
      label.destroy();
      frame.destroy();
      bar.destroy();
    });
  }

  create(): void {
    this.unpackAtlas();
    this.scene.stop(BOOT_SCENE);
    this.scene.launch(HUD_SCENE);
    if (debugEnabled()) this.scene.launch(DEBUG_SCENE);
    this.complete = true;
    log('Preload complete');
    events.emit('game:ready');
    this.scene.start(TITLE_SCENE);
  }

  /**
   * Copy every atlas frame into its own canvas texture keyed by its asset path (same key and size as the
   * file it replaces), then drop the atlas texture.
   */
  private unpackAtlas(): void {
    const atlas = getAtlas();
    if (!atlas || !this.textures.exists(ATLAS_KEY)) return;
    for (const path of this.fromAtlas) {
      const f = atlas.frames.get(path);
      if (!f || this.textures.exists(path)) continue;
      this.textures.createCanvas(path, f.w, f.h)?.drawFrame(ATLAS_KEY, path).refresh();
    }
    this.textures.remove(ATLAS_KEY);
  }
}
