/**
 * PreloadScene — loads every asset (from M1: every sprite and sound listed in the data, keyed by
 * its path). For M0 it only shows the game title centred on the black screen.
 */
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { events } from '../core/events';
import { log } from '../core/log';
import { t } from '../i18n';

/** Scene key of {@link PreloadScene}. */
export const PRELOAD_SCENE = 'Preload';

/** Loads assets, then shows the title text (placeholder until the Title scene exists). */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(PRELOAD_SCENE);
  }

  create(): void {
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, t('app.title'), {
        fontFamily: 'monospace',
        fontSize: '32px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    log('Preload complete');
    events.emit('game:ready');
  }
}
