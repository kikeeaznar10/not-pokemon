/**
 * GridMenu (M6): a framed menu of options laid out in `cols` columns with a cursor, fixed to the camera.
 * The battle uses it for the 2 × 2 main menu, the attack list and the team list.
 *
 * - Arrows move the cursor on the grid (`moveGridCursor`, no wrapping); A chooses the option under the
 *   cursor if it is enabled (a disabled option is drawn greyed out and A does nothing); B cancels with
 *   `null` when `cancelable` (default true), otherwise B does nothing.
 * - Each option may have an icon (a texture key) and a right-aligned text (e.g. "PS 31/40").
 * - `onMove` is called with the cursor index on open and after every move (for side panels such as
 *   the attack's accuracy).
 * - The owner calls {@link GridMenu.update} every frame while {@link GridMenu.isOpen}; the frame it
 *   opens it ignores input, so the press that opened it does not also choose.
 * Texts come from the caller (i18n or content), never from this file.
 */
import Phaser from 'phaser';
import { input } from '../core/input';
import { moveGridCursor } from './cursor';

const DEPTH = 102;
const PAD_X = 10;
const PAD_Y = 8;
const CURSOR_W = 12;
const ICON_W = 20;
const COLOR_FILL = 0xf8f8f0;
const COLOR_BORDER = 0x202028;
const COLOR_TEXT = '#202028';
const COLOR_DISABLED = '#9898a0';
const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '14px',
  color: COLOR_TEXT,
};

/** One option. */
export interface GridOption {
  label: string;
  enabled: boolean;
  /** Texture key drawn left of the label (16 × 16 icons). */
  icon?: string;
  /** Text drawn right-aligned in the option's cell. */
  right?: string;
}

/** Where and how to draw the menu. */
export interface GridMenuLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  cols: number;
  /** Row height in pixels (default 22). */
  rowH?: number;
  /** A title line above the options. */
  title?: string;
}

/** Callbacks and behaviour. */
export interface GridMenuOptions {
  onChoose: (index: number | null) => void;
  onMove?: (index: number) => void;
  cancelable?: boolean;
  initial?: number;
}

/** What the menu shows (for the E2E hooks). */
export interface GridMenuState {
  options: { label: string; enabled: boolean }[];
  cursor: number;
}

/** A grid of options with a cursor. Open it again to replace it. */
export class GridMenu {
  private readonly scene: Phaser.Scene;
  private root: Phaser.GameObjects.Container | null = null;
  private cursorMark: Phaser.GameObjects.Triangle | null = null;
  private options: GridOption[] = [];
  private cols = 1;
  private cellW = 0;
  private rowH = 22;
  private top = 0;
  private cursor = 0;
  private opts: GridMenuOptions | null = null;
  private skipInput = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** True from {@link open} until an option is chosen or the menu is cancelled / closed. */
  get isOpen(): boolean {
    return this.opts !== null;
  }

  /** Show `options` (at least one). */
  open(options: readonly GridOption[], layout: GridMenuLayout, opts: GridMenuOptions): void {
    if (options.length === 0) throw new Error('GridMenu: no options');
    this.destroyView();
    this.options = [...options];
    this.cols = Math.max(1, layout.cols);
    this.rowH = layout.rowH ?? 22;
    this.cellW = (layout.width - 2 * PAD_X) / this.cols;
    this.opts = opts;
    this.skipInput = true;
    this.cursor = Math.min(Math.max(0, opts.initial ?? 0), options.length - 1);

    const parts: Phaser.GameObjects.GameObject[] = [
      this.scene.add
        .rectangle(0, 0, layout.width, layout.height, COLOR_FILL)
        .setOrigin(0)
        .setStrokeStyle(2, COLOR_BORDER),
    ];
    this.top = PAD_Y;
    if (layout.title) {
      parts.push(this.scene.add.text(PAD_X, PAD_Y, layout.title, TEXT_STYLE));
      this.top += this.rowH;
    }
    this.options.forEach((o, i) => {
      const cx = PAD_X + (i % this.cols) * this.cellW;
      const cy = this.top + Math.floor(i / this.cols) * this.rowH;
      const color = o.enabled ? COLOR_TEXT : COLOR_DISABLED;
      let lx = cx + CURSOR_W;
      if (o.icon && this.scene.textures.exists(o.icon)) {
        parts.push(
          this.scene.add
            .image(lx, cy + 1, o.icon)
            .setOrigin(0)
            .setAlpha(o.enabled ? 1 : 0.5),
        );
        lx += ICON_W;
      }
      parts.push(this.scene.add.text(lx, cy, o.label, { ...TEXT_STYLE, color }));
      if (o.right) {
        parts.push(
          this.scene.add.text(cx + this.cellW - 4, cy, o.right, { ...TEXT_STYLE, color }).setOrigin(1, 0),
        );
      }
    });
    this.cursorMark = this.scene.add.triangle(0, 0, 0, 0, 0, 8, 6, 4, COLOR_BORDER).setOrigin(0);
    parts.push(this.cursorMark);
    this.root = this.scene.add.container(layout.x, layout.y, parts).setScrollFactor(0).setDepth(DEPTH);
    this.root.setName('grid-menu');
    this.placeCursor();
    opts.onMove?.(this.cursor);
  }

  /** Handle arrows / A / B. Call every frame while open. */
  update(): void {
    const opts = this.opts;
    if (!opts) return;
    if (this.skipInput) {
      this.skipInput = false;
      return;
    }
    const count = this.options.length;
    let next = this.cursor;
    if (input.justPressed('up')) next = moveGridCursor(this.cursor, 0, -1, this.cols, count);
    else if (input.justPressed('down')) next = moveGridCursor(this.cursor, 0, 1, this.cols, count);
    else if (input.justPressed('left')) next = moveGridCursor(this.cursor, -1, 0, this.cols, count);
    else if (input.justPressed('right')) next = moveGridCursor(this.cursor, 1, 0, this.cols, count);
    else if (input.justPressed('a')) {
      if (this.options[this.cursor]?.enabled) this.finish(this.cursor);
      return;
    } else if (input.justPressed('b')) {
      if (opts.cancelable !== false) this.finish(null);
      return;
    }
    if (next !== this.cursor) {
      this.cursor = next;
      this.placeCursor();
      opts.onMove?.(next);
    }
  }

  /** Close without calling `onChoose`. */
  close(): void {
    this.opts = null;
    this.destroyView();
  }

  /** Options and cursor while open, else `null`. */
  state(): GridMenuState | null {
    if (!this.opts) return null;
    return {
      options: this.options.map((o) => ({ label: o.label, enabled: o.enabled })),
      cursor: this.cursor,
    };
  }

  private placeCursor(): void {
    const cx = PAD_X + (this.cursor % this.cols) * this.cellW;
    const cy = this.top + Math.floor(this.cursor / this.cols) * this.rowH;
    this.cursorMark?.setPosition(cx, cy + 4);
  }

  private finish(choice: number | null): void {
    const done = this.opts?.onChoose;
    this.close();
    done?.(choice);
  }

  private destroyView(): void {
    this.root?.destroy();
    this.root = null;
    this.cursorMark = null;
  }
}
