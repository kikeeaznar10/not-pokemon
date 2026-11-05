/**
 * DialogBox: the text box at the bottom of the screen (512 × 80), fixed to the camera.
 *
 * - `open(strings, { voice, onClose })` shows the strings one box each; long strings are word-wrapped
 *   to the box and continue on extra boxes if needed (`src/logic/dialogue.ts`).
 * - Text types out at the text speed option's rate (lenta / normal / rápida = `TEXT_SPEED_CPS`;
 *   normal is `TEXT_CPS`). A shows the whole box at once; A on a full box goes to the next one, and after
 *   the last one closes the box and calls `onClose`.
 * - A small arrow blinks in the bottom-right corner when another box follows.
 * - The speaker's `voice` (a sound key = its JSON path) plays every `VOICE_EVERY_CHARS` characters, at the
 *   effects volume option.
 * - Input: the owner calls {@link DialogBox.update} every frame while {@link DialogBox.isOpen}; the box
 *   reads the Input service itself. The frame it opens it ignores input, so the A press that started a
 *   conversation does not also skip the first box.
 *
 * Font: the browser's monospace font at a pixel size (no pixel font asset exists yet; see docs/ART.md).
 */
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { input } from '../core/input';
import { getOptions, sfxVolume } from '../core/options';
import { textCps } from '../logic/options';
import { DIALOG_ARROW_BLINK_MS } from '../logic/constants';
import {
  dialoguePages,
  isTyped,
  pressA,
  revealAll,
  startTyping,
  typeTick,
  visibleText,
  type Typing,
} from '../logic/dialogue';
import { FRAME, framedBox } from './frame';

/** Box height in base pixels (512 × 80). */
export const DIALOG_HEIGHT = 80;
/** Draw order: above every map layer, the player and the NPCs. */
const DEPTH = 100;
const PAD_X = 12;
const PAD_Y = 10;
const FONT_PX = 14;
const LINE_SPACING = 6;
const COLOR_BORDER = FRAME.border;
const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: `${FONT_PX}px`,
  color: '#202028',
  lineSpacing: LINE_SPACING,
};

/** Options for {@link DialogBox.open}. */
export interface DialogOptions {
  /** Sound key played while typing (the NPC's `voice`). */
  voice?: string;
  /** Called once after the last box closes. */
  onClose?: () => void;
  /**
   * A question box. A no longer closes the last box (it can still reveal its text); the box stays on
   * screen under a ChoiceBox until the owner calls {@link DialogBox.dismiss}.
   */
  hold?: boolean;
}

/** What the box shows (for the E2E hooks). */
export interface DialogState {
  /** 0-based index of the box shown and how many there are in this conversation. */
  page: number;
  pages: number;
  /** Characters visible now, and the whole box text (wrapped, `\n` between lines). */
  text: string;
  full: string;
  typed: boolean;
  /** True when another box follows (the arrow blinks once the box is typed). */
  more: boolean;
  /** How many times the voice played since the box opened. */
  voicePlays: number;
}

/** The dialogue text box. One per scene; create it in `create()`. */
export class DialogBox {
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly text: Phaser.GameObjects.Text;
  private readonly arrow: Phaser.GameObjects.Triangle;
  private readonly maxChars: number;
  private readonly maxLines: number;
  private pages: string[] = [];
  private page = 0;
  private typing: Typing = startTyping('');
  private opts: DialogOptions = {};
  private open_ = false;
  private skipInput = false;
  private blinkMs = 0;
  private voicePlays = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const top = GAME_HEIGHT - DIALOG_HEIGHT;
    const bg = framedBox(scene, 2, 2, GAME_WIDTH - 4, DIALOG_HEIGHT - 4);
    this.text = scene.add.text(PAD_X, PAD_Y, '', TEXT_STYLE);
    const ax = GAME_WIDTH - PAD_X - 4;
    const ay = DIALOG_HEIGHT - PAD_Y;
    this.arrow = scene.add.triangle(ax - 5, ay - 6, 0, 0, 10, 0, 5, 6, COLOR_BORDER).setOrigin(0);
    this.root = scene.add
      .container(0, top, [...bg, this.text, this.arrow])
      .setScrollFactor(0)
      .setDepth(DEPTH)
      .setVisible(false);
    this.root.setName('dialog-box');

    // Measure the monospace font once to know how many characters and lines fit.
    const probe = scene.add.text(0, 0, 'MMMMMMMMMM\nM', TEXT_STYLE).setVisible(false);
    const charW = probe.width / 10;
    const lineH = probe.height / 2;
    probe.destroy();
    this.maxChars = Math.max(1, Math.floor((GAME_WIDTH - 2 * PAD_X - 12) / charW));
    this.maxLines = Math.max(1, Math.floor((DIALOG_HEIGHT - 2 * PAD_Y + LINE_SPACING) / lineH));
  }

  /** True from {@link open} until the last box is closed. */
  get isOpen(): boolean {
    return this.open_;
  }

  /** Show `strings` (one box each, wrapped). Opening with no strings closes at once. */
  open(strings: readonly string[], opts: DialogOptions = {}): void {
    this.pages = dialoguePages(strings, this.maxChars, this.maxLines);
    this.opts = opts;
    this.voicePlays = 0;
    if (this.pages.length === 0) {
      opts.onClose?.();
      return;
    }
    this.open_ = true;
    this.skipInput = true;
    this.root.setVisible(true);
    this.showPage(0);
  }

  /** Advance typing by `dtMs` and handle A. Call every frame while open. */
  update(dtMs: number): void {
    if (!this.open_) return;
    const pressed = !this.skipInput && input.justPressed('a');
    this.skipInput = false;
    if (pressed) {
      if (pressA(this.typing) === 'reveal') this.typing = revealAll(this.typing);
      else if (this.page + 1 < this.pages.length) this.showPage(this.page + 1);
      else if (this.opts.hold) {
        // A question box: the ChoiceBox shown with it handles A; the owner dismisses this box.
      } else {
        this.close();
        return;
      }
    } else {
      const r = typeTick(this.typing, dtMs, textCps(getOptions().textSpeed));
      this.typing = r.typing;
      if (r.voice) this.playVoice();
    }
    this.text.setText(visibleText(this.typing));
    this.blinkMs += dtMs;
    const more = this.page + 1 < this.pages.length;
    this.arrow.setVisible(
      more && isTyped(this.typing) && Math.floor(this.blinkMs / DIALOG_ARROW_BLINK_MS) % 2 === 0,
    );
  }

  /** The current box (for tests and the debug overlay), or `null` when closed. */
  state(): DialogState | null {
    if (!this.open_) return null;
    return {
      page: this.page,
      pages: this.pages.length,
      text: visibleText(this.typing),
      full: this.typing.text,
      typed: isTyped(this.typing),
      more: this.page + 1 < this.pages.length,
      voicePlays: this.voicePlays,
    };
  }

  /** Close the box now (a `hold` question box once its choice is made); `onClose` runs as usual. */
  dismiss(): void {
    if (this.open_) this.close();
  }

  private showPage(i: number): void {
    this.page = i;
    this.typing = startTyping(this.pages[i] ?? '');
    this.blinkMs = 0;
    this.text.setText('');
    this.arrow.setVisible(false);
  }

  private close(): void {
    this.open_ = false;
    this.root.setVisible(false);
    const done = this.opts.onClose;
    this.opts = {};
    done?.();
  }

  private playVoice(): void {
    this.voicePlays += 1;
    const key = this.opts.voice;
    if (key && this.scene.cache.audio.exists(key)) this.scene.sound.play(key, { volume: sfxVolume() });
  }
}
