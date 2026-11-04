/**
 * BootScene — the first scene. Sets up anything needed before loading assets, then starts Preload.
 * From M1 it loads and validates the JSON content and shows ErrorScene on failure.
 */
import Phaser from 'phaser';
import { log } from '../core/log';

/** Scene key of {@link BootScene}. */
export const BOOT_SCENE = 'Boot';

/** First scene: boot-time setup, then hands over to Preload. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(BOOT_SCENE);
  }

  create(): void {
    log('Boot');
    this.scene.start('Preload');
  }
}
