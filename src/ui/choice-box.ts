/**
 * ChoiceBox (M5): a small framed list of options with a cursor, fixed to the camera. Used for Sí/No,
 * Llevármelo/Dejarlo and shop lists (from M7/M9).
 *
 * - Up/Down move the cursor (wrapping around), A chooses, B cancels (when `cancelable`, the default)
 *   and chooses `null`. Either way the box closes and `onChoose` is called once.
 * - By default it sits at the right edge, just above the DialogBox, so a question can stay visible
 *   underneath.
 * - The owner calls {@link ChoiceBox.update} every frame while {@link ChoiceBox.isOpen}; the frame it
 *   opens it ignores input (so the press that opened it does not also choose).
 * - Sounds (M15, `src/core/ui-sound.ts`): `cursor` on a move, `confirm` on A, `cancel` on B.
 * Option texts come from the caller (i18n keys or content), never from this file.
 */
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { input } from '../core/input';
import { uiSound } from '../core/ui-sound';
import { DIALOG_HEIGHT } from './dialog-box';
import { moveCursor } from './cursor';

const DEPTH = 101;
const PAD_X = 10;
const PAD_Y = 8;
const CURSOR_W = 12;
const ROW_SPACING = 4;
const COLOR_FILL = 0xf8f8f0;
const COLOR_BORDER = 0x202028;
const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '14px',
  color: '#202028',
};

/** Options for {@link ChoiceBox.open}. */
export interface ChoiceOptions {
  /** Called with the chosen index, or `null` when cancelled with B. */
  onChoose: (index: number | null) => void;
  /** B cancels (default true). */
  cancelable?: boolean;
  /** Cursor start (default 0). */
  initial?: number;
  /** Top-left corner in screen pixels; default: right edge, just above the dialog box. */
  x?: number;
  y?: number;
}

/** What the box shows (for the E2E hooks). */
export interface ChoiceState {
  options: string[];
  cursor: number;
}

/** A list of options with a cursor. One per scene; create it in `create()`. */
export class ChoiceBox {
  private readonly scene: Phaser.Scene;
  private root: Phaser.GameObjects.Container | null = null;
  private cursorMark: Phaser.GameObjects.Triangle | null = null;
  private options: string[] = [];
  private cursor = 0;
  private rowH = 0;
  private opts: ChoiceOptions | null = null;
  private skipInput = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** True from {@link open} until an option is chosen or the box is cancelled. */
  get isOpen(): boolean {
    return this.opts !== null;
  }

  /** Show `options` (at least one). Replaces a box that is already open (without calling its callback). */
  open(options: readonly string[], opts: ChoiceOptions): void {
    if (options.length === 0) throw new Error('ChoiceBox: no options');
    this.root?.destroy();
    this.options = [...options];
    this.cursor = moveCursor(opts.initial ?? 0, 0, options.length);
    this.opts = opts;
    this.skipInput = true;

    const texts = this.options.map((o) => this.scene.add.text(PAD_X + CURSOR_W, 0, o, TEXT_STYLE));
    this.rowH = Math.max(...texts.map((tx) => tx.height)) + ROW_SPACING;
    texts.forEach((tx, i) => tx.setY(PAD_Y + i * this.rowH));
    const w = Math.ceil(PAD_X * 2 + CURSOR_W + Math.max(...texts.map((tx) => tx.width)));
    const h = Math.ceil(PAD_Y * 2 + this.rowH * texts.length - ROW_SPACING);
    const x = opts.x ?? GAME_WIDTH - w - 4;
    const y = opts.y ?? GAME_HEIGHT - DIALOG_HEIGHT - h - 2;
    const bg = this.scene.add.rectangle(0, 0, w, h, COLOR_FILL).setOrigin(0).setStrokeStyle(2, COLOR_BORDER);
    this.cursorMark = this.scene.add.triangle(0, 0, 0, 0, 0, 8, 6, 4, COLOR_BORDER).setOrigin(0);
    this.root = this.scene.add
      .container(x, y, [bg, ...texts, this.cursorMark])
      .setScrollFactor(0)
      .setDepth(DEPTH);
    this.root.setName('choice-box');
    this.placeCursor();
  }

  /** Handle Up/Down/A/B. Call every frame while open. */
  update(): void {
    if (!this.opts) return;
    if (this.skipInput) {
      this.skipInput = false;
      return;
    }
    const before = this.cursor;
    if (input.justPressed('up')) this.cursor = moveCursor(this.cursor, -1, this.options.length);
    else if (input.justPressed('down')) this.cursor = moveCursor(this.cursor, 1, this.options.length);
    else if (input.justPressed('a')) {
      uiSound('confirm');
      return this.finish(this.cursor);
    } else if (input.justPressed('b') && this.opts.cancelable !== false) {
      uiSound('cancel');
      return this.finish(null);
    }
    if (this.cursor !== before) uiSound('cursor');
    this.placeCursor();
  }

  /** Options and cursor while open, else `null`. */
  state(): ChoiceState | null {
    return this.opts ? { options: [...this.options], cursor: this.cursor } : null;
  }

  private placeCursor(): void {
    this.cursorMark?.setPosition(PAD_X, PAD_Y + this.cursor * this.rowH + (this.rowH - ROW_SPACING - 8) / 2);
  }

  private finish(choice: number | null): void {
    const done = this.opts?.onChoose;
    this.opts = null;
    this.root?.destroy();
    this.root = null;
    this.cursorMark = null;
    done?.(choice);
  }
}
