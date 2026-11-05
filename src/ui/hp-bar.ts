/**
 * HpBar: a framed HP bar, optionally with a "PS 31/40" line under it.
 *
 * - {@link HpBar.set} jumps to a value; {@link HpBar.animateTo} moves the bar (and the number) over
 *   `HP_ANIM_MS` and resolves when done. The numbers always come from the battle events; the bar never
 *   computes HP.
 * - Colour band from `hpColor()` (`src/logic/battle-view.ts`): green, yellow below 50 %, red below 20 %.
 * - {@link HpBar.shown} is the value drawn right now (for the E2E hooks: it equals the logic HP once the
 *   animation has finished).
 */
import Phaser from 'phaser';
import { t } from '../i18n';
import { hpColor } from '../logic/battle-view';
import { HP_ANIM_MS } from '../logic/constants';

const BAR_H = 6;
const COLORS = { green: 0x38b848, yellow: 0xf0c020, red: 0xe03828 } as const;
const COLOR_BG = 0x484850;
const COLOR_BORDER = 0x202028;
const LABEL_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '12px',
  color: '#202028',
};

/** An HP bar at (`x`, `y`) of `width` base pixels. */
export class HpBar {
  private readonly scene: Phaser.Scene;
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text | null;
  private readonly width: number;
  private readonly objects: Phaser.GameObjects.GameObject[];
  private tween: Phaser.Tweens.Tween | null = null;
  private value = 0;
  private max = 1;

  constructor(scene: Phaser.Scene, x: number, y: number, width: number, withNumbers: boolean) {
    this.scene = scene;
    this.width = width;
    const tag = scene.add.text(x, y - 3, t('stat.hp'), { ...LABEL_STYLE, fontSize: '10px' });
    const barX = x + 20;
    const inner = width - 20;
    const bg = scene.add
      .rectangle(barX, y, inner, BAR_H, COLOR_BG)
      .setOrigin(0)
      .setStrokeStyle(1, COLOR_BORDER);
    this.fill = scene.add.rectangle(barX, y, inner, BAR_H, COLORS.green).setOrigin(0);
    this.label = withNumbers ? scene.add.text(x + width, y + 9, '', LABEL_STYLE).setOrigin(1, 0) : null;
    this.objects = [tag, bg, this.fill, ...(this.label ? [this.label] : [])];
  }

  /** The game objects of the bar (to put them in a container). */
  get parts(): Phaser.GameObjects.GameObject[] {
    return this.objects;
  }

  /** The HP drawn right now (rounded) and the max. */
  get shown(): { hp: number; maxHp: number } {
    return { hp: Math.round(this.value), maxHp: this.max };
  }

  /** The "PS hp/max" text, or `null` for a bar without numbers. */
  get text(): string | null {
    return this.label?.text ?? null;
  }

  /** Jump to `hp` / `max` with no animation. */
  set(hp: number, max: number): void {
    this.tween?.stop();
    this.tween = null;
    this.max = max;
    this.draw(hp);
  }

  /** Animate to `hp` (and `max`) over `HP_ANIM_MS`; resolves when the bar arrives. */
  animateTo(hp: number, max: number): Promise<void> {
    this.tween?.stop();
    this.max = max;
    const from = { v: this.value };
    return new Promise((resolve) => {
      this.tween = this.scene.tweens.add({
        targets: from,
        v: hp,
        duration: HP_ANIM_MS,
        onUpdate: () => this.draw(from.v),
        onComplete: () => {
          this.tween = null;
          this.draw(hp);
          resolve();
        },
        onStop: () => resolve(),
      });
    });
  }

  private draw(hp: number): void {
    this.value = hp;
    const ratio = this.max > 0 ? Math.max(0, Math.min(1, hp / this.max)) : 0;
    const inner = this.width - 20;
    this.fill.setSize(Math.max(0, Math.round(inner * ratio)), BAR_H);
    this.fill.setFillStyle(COLORS[hpColor(hp, this.max)]);
    this.label?.setText(t('battle.hp', { hp: Math.round(hp), max: this.max }));
  }
}
