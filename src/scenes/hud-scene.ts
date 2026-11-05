/**
 * HudScene (M10) — a transparent layer over every game scene for small status marks. For now it only
 * shows the save icon: a tiny "Guardando…" box at the top centre (M12: moved from the top-right corner, where
 * the touch Start / Mapa buttons cover it) for `SAVE_ICON_MS` (600 ms) after
 * every auto-save (`save:done`; a new save restarts the timer). Preload launches it once; it never reads
 * input. It sits just below the Debug overlay in the scene list, so it draws over the overworld, the
 * battle and the overlays.
 */
import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/game';
import { events } from '../core/events';
import { t } from '../i18n';
import { SAVE_ICON_MS } from '../logic/constants';

/** Scene key of {@link HudScene}. */
export const HUD_SCENE = 'Hud';

const PAD = 4;
const COLOR_PANEL = 0x202028;

/** The always-on status layer. */
export class HudScene extends Phaser.Scene {
  private icon!: Phaser.GameObjects.Container;
  private hideAt = 0;
  /** True while the save icon shows (read by the E2E hooks). */
  saving = false;

  constructor() {
    super(HUD_SCENE);
  }

  create(): void {
    const text = this.add.text(PAD + 2, PAD, t('save.saving'), {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#f8f8f0',
    });
    const w = text.width + 2 * PAD + 4;
    const h = text.height + 2 * PAD;
    const bg = this.add.rectangle(0, 0, w, h, COLOR_PANEL, 0.85).setOrigin(0);
    this.icon = this.add.container(Math.round((GAME_WIDTH - w) / 2), 4, [bg, text]).setVisible(false);
    this.saving = false;
    const off = events.on('save:done', () => {
      this.hideAt = this.time.now + SAVE_ICON_MS;
      this.saving = true;
      this.icon.setVisible(true);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
  }

  override update(time: number): void {
    if (this.saving && time >= this.hideAt) {
      this.saving = false;
      this.icon.setVisible(false);
    }
  }
}
