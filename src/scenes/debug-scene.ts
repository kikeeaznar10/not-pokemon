/**
 * DebugScene — developer overlay (M3), available only in dev builds (`npm run dev`) or with `?debug=1`
 * in the URL. Preload launches it once (it is last in the scene list, so it draws on top of every
 * scene) hidden; F2 (`debug` action) toggles it.
 * Shows the map id, the player's tile x/y (same numbers as Tiled's status bar) and the FPS.
 * Later milestones add commands here (teleport, battles, items…).
 */
import Phaser from 'phaser';
import { events } from '../core/events';
import { input } from '../core/input';
import { t } from '../i18n';

/** Scene key of {@link DebugScene}. */
export const DEBUG_SCENE = 'Debug';

/** True in dev builds or when the page URL has `?debug=1`. */
export function debugEnabled(search: string = globalThis.location?.search ?? ''): boolean {
  return import.meta.env.DEV || new URLSearchParams(search).get('debug') === '1';
}

/** The F2 overlay. */
export class DebugScene extends Phaser.Scene {
  private text!: Phaser.GameObjects.Text;
  private panel!: Phaser.GameObjects.Rectangle;
  private where = { map: '-', x: 0, y: 0 };
  private offMoved: (() => void) | null = null;
  /** Whether the overlay is showing (read by the E2E hooks). */
  shown = false;

  constructor() {
    super(DEBUG_SCENE);
  }

  create(): void {
    this.panel = this.add.rectangle(2, 2, 150, 40, 0x000000, 0.6).setOrigin(0);
    this.text = this.add.text(6, 5, '', { fontFamily: 'monospace', fontSize: '10px', color: '#00ff66' });
    this.offMoved = events.on('player:moved', (p) => {
      this.where = { map: p.map, x: p.x, y: p.y };
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.offMoved?.());
    this.setShown(false);
  }

  override update(): void {
    if (input.justPressed('debug')) this.setShown(!this.shown);
    if (!this.shown) return;
    this.text.setText(this.lines());
    this.panel.setSize(Math.max(120, this.text.width + 8), this.text.height + 6);
  }

  /** The overlay's text lines. */
  lines(): string[] {
    return [
      t('debug.map', { map: this.where.map }),
      t('debug.tile', { x: this.where.x, y: this.where.y }),
      t('debug.fps', { fps: Math.round(this.game.loop.actualFps) }),
    ];
  }

  /** Show or hide the overlay. */
  setShown(shown: boolean): void {
    this.shown = shown;
    this.text.setVisible(shown);
    this.panel.setVisible(shown);
  }
}
