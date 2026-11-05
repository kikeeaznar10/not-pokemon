/**
 * NameScene (M11) — the player types their name (at most `NAME_MAX_LENGTH` = 10 characters; rules in
 * `src/logic/name-entry.ts`).
 *
 * - An on-screen grid: the letters of `es.json › name.letters` (A–Z, Ñ, á é í ó ú), a space, *Borrar* and *OK*.
 *   Arrows move the cursor, A presses the cell under it, B deletes the last character (on an empty name it
 *   goes back to the title), Start is OK. A tap (or click) on a cell presses it.
 * - The physical keyboard also types: the scene turns on the Input service's text mode, so every letter key
 *   (including Z, X, W, A, S, D, M) types its letter, Space types a space and Backspace deletes; the arrows and
 *   Enter keep their meaning. Text mode is switched off when the scene ends.
 * - OK with no letter shows "Escribe al menos una letra." and stays. Otherwise the IntroScene starts with the
 *   trimmed name.
 */
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { input } from '../core/input';
import { log } from '../core/log';
import { t } from '../i18n';
import { NAME_MAX_LENGTH } from '../logic/constants';
import { canConfirm, deleteChar, finalName, nameGrid, typeChar, type NameCell } from '../logic/name-entry';
import { moveGridCursor } from '../ui/cursor';
import { INTRO_SCENE, type IntroSceneData } from './intro-scene';
import { TITLE_SCENE } from './title-scene';

/** Scene key of {@link NameScene}. */
export const NAME_SCENE = 'Name';

/** The name screen as data (for the E2E hooks). */
export interface NameView {
  name: string;
  cursor: number;
  /** Label of the cell under the cursor. */
  cell: string;
  /** Every cell label in grid order. */
  cells: string[];
  /** The message under the name ("Escribe al menos una letra."), or `''`. */
  message: string;
  /** Each cell's rectangle in base pixels (tests click on them). */
  rects: { x: number; y: number; width: number; height: number }[];
}

const COLS = 11;
const CELL_W = 40;
const CELL_H = 28;
const GRID_TOP = 96;
const GRID_LEFT = (GAME_WIDTH - COLS * CELL_W) / 2;
/** Borrar and OK sit on their own row, wider than a letter cell. */
const BUTTON_W = [100, 60] as const;
const COLOR_BG = 0x283048;
const COLOR_PANEL = 0xf8f8f0;
const COLOR_INK = '#202028';
const COLOR_LIGHT = '#f8f8f0';
const COLOR_CURSOR = 0xd84838;
const STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '16px',
  color: COLOR_INK,
};

/** The name entry screen. */
export class NameScene extends Phaser.Scene {
  private name_ = '';
  private cursor = 0;
  private cells: NameCell[] = [];
  private labels: string[] = [];
  private boxes: Phaser.Geom.Rectangle[] = [];
  private nameText!: Phaser.GameObjects.Text;
  private messageText!: Phaser.GameObjects.Text;
  private cursorBox!: Phaser.GameObjects.Rectangle;
  private leaving = false;

  constructor() {
    super(NAME_SCENE);
  }

  create(): void {
    this.name_ = '';
    this.cursor = 0;
    this.leaving = false;
    this.cells = nameGrid(t('name.letters'));
    this.labels = this.cells.map((c) =>
      c.kind === 'delete'
        ? t('name.delete')
        : c.kind === 'ok'
          ? t('name.ok')
          : c.char === ' '
            ? t('name.space')
            : c.char,
    );
    this.cameras.main.setBackgroundColor(COLOR_BG);
    this.add.text(GAME_WIDTH / 2, 14, t('name.title'), { ...STYLE, color: COLOR_LIGHT }).setOrigin(0.5, 0);
    this.add.rectangle(GAME_WIDTH / 2, 56, 220, 30, COLOR_PANEL).setStrokeStyle(2, 0x202028);
    this.nameText = this.add.text(GAME_WIDTH / 2, 56, '', { ...STYLE, fontSize: '18px' }).setOrigin(0.5);
    this.messageText = this.add
      .text(GAME_WIDTH / 2, 80, '', { ...STYLE, fontSize: '12px', color: '#f8a088' })
      .setOrigin(0.5, 0);
    this.add
      .rectangle(GRID_LEFT - 6, GRID_TOP - 6, COLS * CELL_W + 12, this.gridHeight() + 12, COLOR_PANEL)
      .setOrigin(0)
      .setStrokeStyle(2, 0x202028);
    this.boxes = this.cells.map((_, i) => this.cellBox(i));
    this.cursorBox = this.add.rectangle(0, 0, CELL_W, CELL_H).setOrigin(0).setStrokeStyle(2, COLOR_CURSOR);
    this.labels.forEach((label, i) => {
      const b = this.boxes[i]!;
      this.add.text(b.centerX, b.centerY, label, STYLE).setOrigin(0.5);
      this.add
        .zone(b.x, b.y, b.width, b.height)
        .setOrigin(0)
        .setInteractive()
        .on('pointerdown', () => {
          this.cursor = i;
          this.press(i);
          this.redraw();
        });
    });
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 10, t('name.hint'), {
        ...STYLE,
        fontSize: '11px',
        color: COLOR_LIGHT,
      })
      .setOrigin(0.5, 1);
    input.setTextMode(true);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => input.setTextMode(false));
    this.redraw();
  }

  override update(): void {
    if (this.leaving) return;
    for (const ch of input.takeTyped()) {
      if (ch === '\b') this.setName(deleteChar(this.name_));
      else this.setName(typeChar(this.name_, ch));
    }
    const count = this.cells.length;
    if (input.justPressed('up')) this.cursor = this.move(0, -1);
    else if (input.justPressed('down')) this.cursor = this.move(0, 1);
    else if (input.justPressed('left')) this.cursor = this.move(-1, 0);
    else if (input.justPressed('right')) this.cursor = this.move(1, 0);
    else if (input.justPressed('a')) this.press(this.cursor);
    else if (input.justPressed('b')) {
      if (this.name_ === '') {
        this.leaving = true;
        this.scene.start(TITLE_SCENE);
        return;
      }
      this.setName(deleteChar(this.name_));
    } else if (input.justPressed('start')) this.confirm();
    this.cursor = Math.min(Math.max(0, this.cursor), count - 1);
    if (!this.leaving) this.redraw();
  }

  /** The screen as data. */
  view(): NameView {
    return {
      name: this.name_,
      cursor: this.cursor,
      cell: this.labels[this.cursor] ?? '',
      cells: [...this.labels],
      message: this.messageText.text,
      rects: this.boxes.map((b) => ({ x: b.x, y: b.y, width: b.width, height: b.height })),
    };
  }

  /** Cursor movement: letters as a grid; from the bottom letter row Down goes to Borrar / OK. */
  private move(dx: number, dy: number): number {
    const letters = this.cells.length - 2;
    const del = letters;
    const ok = letters + 1;
    if (this.cursor >= letters) {
      if (dx !== 0) return this.cursor === del ? ok : del;
      if (dy < 0)
        return Math.min(letters - 1, (Math.ceil(letters / COLS) - 1) * COLS + (this.cursor === del ? 0 : 2));
      return this.cursor;
    }
    const lastRow = Math.ceil(letters / COLS) - 1;
    if (dy > 0 && Math.floor(this.cursor / COLS) === lastRow) return this.cursor % COLS < 2 ? del : ok;
    return moveGridCursor(this.cursor, dx, dy, COLS, letters);
  }

  /** Press cell `i`: type its character, delete, or OK. */
  private press(i: number): void {
    const cell = this.cells[i];
    if (!cell || this.leaving) return;
    if (cell.kind === 'char') this.setName(typeChar(this.name_, cell.char));
    else if (cell.kind === 'delete') this.setName(deleteChar(this.name_));
    else this.confirm();
  }

  private setName(name: string): void {
    if (name !== this.name_) this.messageText.setText('');
    this.name_ = name;
  }

  private confirm(): void {
    if (!canConfirm(this.name_)) {
      this.messageText.setText(t('name.empty'));
      return;
    }
    this.leaving = true;
    const name = finalName(this.name_);
    log(`Name: "${name}"`);
    this.scene.start(INTRO_SCENE, { name } satisfies IntroSceneData);
  }

  private gridHeight(): number {
    return (Math.ceil((this.cells.length - 2) / COLS) + 1) * CELL_H + 4;
  }

  private cellBox(i: number): Phaser.Geom.Rectangle {
    const letters = this.cells.length - 2;
    if (i < letters) {
      return new Phaser.Geom.Rectangle(
        GRID_LEFT + (i % COLS) * CELL_W,
        GRID_TOP + Math.floor(i / COLS) * CELL_H,
        CELL_W,
        CELL_H,
      );
    }
    const y = GRID_TOP + Math.ceil(letters / COLS) * CELL_H + 4;
    const k = i - letters;
    const x = GRID_LEFT + (k === 0 ? 0 : BUTTON_W[0] + 20);
    return new Phaser.Geom.Rectangle(x, y, BUTTON_W[k === 0 ? 0 : 1], CELL_H);
  }

  private redraw(): void {
    const shown = this.name_ + '_'.repeat(Math.max(0, NAME_MAX_LENGTH - [...this.name_].length));
    this.nameText.setText(shown);
    const b = this.boxes[this.cursor];
    if (b) this.cursorBox.setPosition(b.x, b.y).setSize(b.width, b.height);
  }
}
