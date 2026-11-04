/**
 * DebugScene — developer overlay, available only in dev builds (`npm run dev`) or with `?debug=1` in
 * the URL. Preload launches it once (it is last in the scene list, so it draws on top of every scene).
 *
 * F2 (`debug` action) cycles: hidden → info → teleport menu → hidden.
 * - Info (M3): map id, player tile x/y (same numbers as Tiled's status bar), FPS.
 * - Teleport menu (M4): every zone in `zones.json`; up/down choose, A teleports to that zone's `default`
 *   spawn (event `debug:teleport`), B closes the menu. While the menu is open it emits
 *   `debug:menu { open: true }` and the overworld ignores movement.
 * Later milestones add more commands here (battles, items…).
 */
import Phaser from 'phaser';
import { events } from '../core/events';
import { input } from '../core/input';
import { getGameData } from '../data/game-data';
import { t } from '../i18n';

/** Scene key of {@link DebugScene}. */
export const DEBUG_SCENE = 'Debug';

/** What the overlay shows. */
export type DebugMode = 'hidden' | 'info' | 'menu';

/** True in dev builds or when the page URL has `?debug=1`. */
export function debugEnabled(search: string = globalThis.location?.search ?? ''): boolean {
  return import.meta.env.DEV || new URLSearchParams(search).get('debug') === '1';
}

/** The F2 overlay. */
export class DebugScene extends Phaser.Scene {
  private text!: Phaser.GameObjects.Text;
  private panel!: Phaser.GameObjects.Rectangle;
  private where = { map: '-', x: 0, y: 0 };
  private cursor = 0;
  /** Current mode (read by the E2E hooks). */
  mode: DebugMode = 'hidden';

  constructor() {
    super(DEBUG_SCENE);
  }

  /** Whether the overlay is showing anything. */
  get shown(): boolean {
    return this.mode !== 'hidden';
  }

  create(): void {
    this.panel = this.add.rectangle(2, 2, 150, 40, 0x000000, 0.7).setOrigin(0);
    this.text = this.add.text(6, 5, '', { fontFamily: 'monospace', fontSize: '10px', color: '#00ff66' });
    const off = events.on('player:moved', (p) => {
      this.where = { map: p.map, x: p.x, y: p.y };
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
    this.setMode('hidden');
  }

  override update(): void {
    if (input.justPressed('debug')) {
      this.setMode(this.mode === 'hidden' ? 'info' : this.mode === 'info' ? 'menu' : 'hidden');
    } else if (this.mode === 'menu') {
      const zones = this.zoneIds();
      if (input.justPressed('up')) this.cursor = (this.cursor + zones.length - 1) % zones.length;
      if (input.justPressed('down')) this.cursor = (this.cursor + 1) % zones.length;
      if (input.justPressed('b')) this.setMode('info');
      else if (input.justPressed('a')) {
        const map = zones[this.cursor];
        this.setMode('info');
        if (map) events.emit('debug:teleport', { map });
      }
    }
    if (!this.shown) return;
    this.text.setText(this.lines());
    this.panel.setSize(Math.max(120, this.text.width + 8), this.text.height + 6);
  }

  private zoneIds(): string[] {
    return [...getGameData().zones.keys()];
  }

  /** The overlay's text lines (info, plus the zone list with a `>` cursor in menu mode). */
  lines(): string[] {
    const info = [
      t('debug.map', { map: this.where.map }),
      t('debug.tile', { x: this.where.x, y: this.where.y }),
      t('debug.fps', { fps: Math.round(this.game.loop.actualFps) }),
    ];
    if (this.mode !== 'menu') return info;
    const zones = this.zoneIds().map((id, i) => `${i === this.cursor ? '>' : ' '} ${id}`);
    return [...info, t('debug.teleport_title'), ...zones];
  }

  /** Switch mode; opening/closing the menu is announced with `debug:menu`. */
  setMode(mode: DebugMode): void {
    const wasMenu = this.mode === 'menu';
    this.mode = mode;
    this.text.setVisible(mode !== 'hidden');
    this.panel.setVisible(mode !== 'hidden');
    if (wasMenu !== (mode === 'menu')) events.emit('debug:menu', { open: mode === 'menu' });
  }
}
