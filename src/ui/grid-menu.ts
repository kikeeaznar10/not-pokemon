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
 * - Lists longer than the frame scroll (M9): only the rows that fit are drawn, the window follows the
 *   cursor, and small arrows on the right edge show that rows are hidden above / below.
 * - The owner calls {@link GridMenu.update} every frame while {@link GridMenu.isOpen}; the frame it
 *   opens it ignores input, so the press that opened it does not also choose.
 * - Sounds (M15, `src/core/ui-sound.ts`): `cursor` on a move, `confirm` on A, `error` on A over a disabled option,
 *   `cancel` on B.
 * - A disabled option is greyed AND struck through (M15), so it is not told apart by colour alone.
 * Texts come from the caller (i18n or content), never from this file.
 */
import Phaser from 'phaser';
import { input } from '../core/input';
import { uiSound } from '../core/ui-sound';
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
/** Line through a disabled label (M15). */
const COLOR_STRIKE = 0x606068;
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
  /** First visible row (0 unless the list scrolled, M9). */
  firstRow?: number;
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
  private layout: GridMenuLayout | null = null;
  /** Rows that fit in the frame, and the first one shown (M9: long lists scroll). */
  private visibleRows = 1;
  private firstRow = 0;

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
    this.options = [...options];
    this.layout = layout;
    this.cols = Math.max(1, layout.cols);
    this.rowH = layout.rowH ?? 22;
    this.cellW = (layout.width - 2 * PAD_X) / this.cols;
    this.top = PAD_Y + (layout.title ? this.rowH : 0);
    this.visibleRows = Math.max(1, Math.floor((layout.height - this.top - PAD_Y + 4) / this.rowH));
    this.opts = opts;
    this.skipInput = true;
    this.cursor = Math.min(Math.max(0, opts.initial ?? 0), options.length - 1);
    this.firstRow = this.scrolledFirstRow(0);
    this.render();
    opts.onMove?.(this.cursor);
  }

  /** First visible row so that the cursor's row is inside the window (it only moves when needed). */
  private scrolledFirstRow(current: number): number {
    const rows = Math.ceil(this.options.length / this.cols);
    const row = Math.floor(this.cursor / this.cols);
    if (rows <= this.visibleRows) return 0;
    let first = current;
    if (row < first) first = row;
    if (row >= first + this.visibleRows) first = row - this.visibleRows + 1;
    return Math.min(Math.max(0, first), rows - this.visibleRows);
  }

  /** (Re)draw the frame, the title, the visible options and the cursor. */
  private render(): void {
    this.destroyView();
    const layout = this.layout;
    if (!layout) return;
    const parts: Phaser.GameObjects.GameObject[] = [
      this.scene.add
        .rectangle(0, 0, layout.width, layout.height, COLOR_FILL)
        .setOrigin(0)
        .setStrokeStyle(2, COLOR_BORDER),
    ];
    if (layout.title) parts.push(this.scene.add.text(PAD_X, PAD_Y, layout.title, TEXT_STYLE));
    const rows = Math.ceil(this.options.length / this.cols);
    this.options.forEach((o, i) => {
      const row = Math.floor(i / this.cols) - this.firstRow;
      if (row < 0 || row >= this.visibleRows) return;
      const cx = PAD_X + (i % this.cols) * this.cellW;
      const cy = this.top + row * this.rowH;
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
      const label = this.scene.add.text(lx, cy, o.label, { ...TEXT_STYLE, color });
      parts.push(label);
      // M15: strike disabled labels through, so "not available" does not rely on colour alone.
      if (!o.enabled) {
        parts.push(
          this.scene.add
            .rectangle(lx - 1, cy + Math.round(label.height / 2), label.width + 2, 1, COLOR_STRIKE)
            .setOrigin(0, 0.5),
        );
      }
      if (o.right) {
        parts.push(
          this.scene.add.text(cx + this.cellW - 4, cy, o.right, { ...TEXT_STYLE, color }).setOrigin(1, 0),
        );
      }
    });
    // Small arrows on the right edge when rows are hidden above / below.
    if (this.firstRow > 0) {
      parts.push(
        this.scene.add.triangle(layout.width - 12, this.top, 0, 6, 8, 6, 4, 0, COLOR_BORDER).setOrigin(0),
      );
    }
    if (this.firstRow + this.visibleRows < rows) {
      const y = this.top + (this.visibleRows - 1) * this.rowH + 8;
      parts.push(this.scene.add.triangle(layout.width - 12, y, 0, 0, 8, 0, 4, 6, COLOR_BORDER).setOrigin(0));
    }
    this.cursorMark = this.scene.add.triangle(0, 0, 0, 0, 0, 8, 6, 4, COLOR_BORDER).setOrigin(0);
    parts.push(this.cursorMark);
    this.root = this.scene.add.container(layout.x, layout.y, parts).setScrollFactor(0).setDepth(DEPTH);
    this.root.setName('grid-menu');
    this.placeCursor();
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
      if (this.options[this.cursor]?.enabled) {
        uiSound('confirm');
        this.finish(this.cursor);
      } else uiSound('error');
      return;
    } else if (input.justPressed('b')) {
      if (opts.cancelable !== false) {
        uiSound('cancel');
        this.finish(null);
      }
      return;
    }
    if (next !== this.cursor) {
      uiSound('cursor');
      this.cursor = next;
      const first = this.scrolledFirstRow(this.firstRow);
      if (first !== this.firstRow) {
        this.firstRow = first;
        this.render();
      } else this.placeCursor();
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
      firstRow: this.firstRow,
    };
  }

  private placeCursor(): void {
    const cx = PAD_X + (this.cursor % this.cols) * this.cellW;
    const cy = this.top + (Math.floor(this.cursor / this.cols) - this.firstRow) * this.rowH;
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
