/**
 * StorageScene (M9) — the storage box opened by a `storage` NPC, drawn over the paused overworld.
 *
 * - Two columns: *Equipo* (left, "Equipo (n/slots)") and *Caja* (right, "Caja (n)"), each row with the
 *   flexymon's icon, name and "PS hp/max" (fainted ones greyed). Long columns scroll (`scrollTop`).
 * - Up/Down move the cursor in the column, Left/Right switch column. A moves the flexymon under the
 *   cursor to the other column (`boxMove`, `src/logic/storage-box.ts`): refused with a message for the
 *   last team member ("No puedes dejar tu equipo vacío.") and when the team is full ("Tu equipo está
 *   lleno."). Every move is written to the game state at once.
 * - B closes the box: emits `overlay:closed` and stops; the overworld resumes.
 * - Sounds (M15): `cursor` on a move, `confirm` when a flexymon moves, `error` with a refusal, `cancel` on B.
 */
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { events } from '../core/events';
import { input } from '../core/input';
import { uiSound } from '../core/ui-sound';
import { log } from '../core/log';
import { gameState, setGameState } from '../core/session';
import { getGameData } from '../data/game-data';
import { t } from '../i18n';
import { boxMove, boxRows, clampCursor, otherColumn, scrollTop, type BoxColumn } from '../logic/storage-box';
import { DialogBox } from '../ui/dialog-box';

/** Scene key of {@link StorageScene}. */
export const STORAGE_SCENE = 'Storage';

/** The storage screen as plain data (for the E2E hooks). */
export interface StorageView {
  column: BoxColumn;
  cursor: number;
  /** Species ids in each column, in order. */
  team: string[];
  storage: string[];
  teamSlots: number;
  message: string | null;
}

const COL_W = GAME_WIDTH / 2;
const HEADER_Y = 8;
const ROWS_Y = 34;
const ROW_H = 22;
const HINT_H = 30;
const VISIBLE = Math.floor((GAME_HEIGHT - ROWS_Y - HINT_H - 4) / ROW_H);
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

/** The storage box. */
export class StorageScene extends Phaser.Scene {
  private column: BoxColumn = 'team';
  private cursor = 0;
  private top: Record<BoxColumn, number> = { team: 0, storage: 0 };
  private content: Phaser.GameObjects.Container | null = null;
  private dialog!: DialogBox;
  private open = false;
  /** The frame the box opens it ignores input (the A that closed the NPC's dialogue). */
  private skipInput = false;

  constructor() {
    super(STORAGE_SCENE);
  }

  create(): void {
    this.column = 'team';
    this.cursor = 0;
    this.top = { team: 0, storage: 0 };
    this.open = true;
    this.skipInput = true;
    this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLOR_FILL)
      .setOrigin(0)
      .setStrokeStyle(2, COLOR_BORDER);
    this.add.rectangle(COL_W, 4, 2, GAME_HEIGHT - HINT_H - 8, COLOR_BORDER).setOrigin(0.5, 0);
    this.add.rectangle(0, GAME_HEIGHT - HINT_H, GAME_WIDTH, 2, COLOR_BORDER).setOrigin(0);
    this.add.text(12, GAME_HEIGHT - HINT_H + 7, t('storage.hint'), TEXT_STYLE);
    this.dialog = new DialogBox(this);
    this.content = null;
    log('Storage: open');
    this.render();
  }

  override update(_time: number, delta: number): void {
    if (!this.open) return;
    if (this.skipInput) {
      this.skipInput = false;
      return;
    }
    if (this.dialog.isOpen) {
      this.dialog.update(delta);
      return;
    }
    const party = gameState();
    const count = party[this.column].length;
    if (input.justPressed('up') || input.justPressed('down')) {
      const to = clampCursor(this.cursor + (input.justPressed('up') ? -1 : 1), count);
      if (to !== this.cursor) uiSound('cursor');
      this.moveCursor(to);
    } else if (input.justPressed('left') || input.justPressed('right')) {
      const next = input.justPressed('left') ? 'team' : 'storage';
      if (next !== this.column) {
        uiSound('cursor');
        this.column = next;
        this.moveCursor(this.cursor);
      }
    } else if (input.justPressed('a') && count > 0) this.move();
    else if (input.justPressed('b')) this.close();
  }

  private moveCursor(to: number): void {
    const count = gameState()[this.column].length;
    const next = clampCursor(to, count);
    this.cursor = next;
    this.top[this.column] = scrollTop(next, this.top[this.column], VISIBLE, count);
    this.render();
  }

  /** Move the flexymon under the cursor to the other column, or say why not. */
  private move(): void {
    const gs = gameState();
    const result = boxMove(gs, this.column, this.cursor);
    if (!result.ok) {
      const key = result.reason === 'last_member' ? 'storage.last_member' : 'storage.team_full';
      if (result.reason === 'not_found') return;
      uiSound('error');
      this.dialog.open([t(key)], { onClose: () => this.render() });
      return;
    }
    const { team, storage } = result.party;
    uiSound('confirm');
    log(`Storage: moved from ${this.column} (${team.length} in team, ${storage.length} stored)`);
    setGameState({ ...gs, team, storage });
    this.moveCursor(this.cursor);
    const other = otherColumn(this.column);
    this.top[other] = scrollTop(
      gameState()[other].length - 1,
      this.top[other],
      VISIBLE,
      gameState()[other].length,
    );
    this.render();
  }

  /** Redraw both columns and the cursor. */
  private render(): void {
    this.content?.destroy();
    const gs = gameState();
    const data = getGameData();
    const parts: Phaser.GameObjects.GameObject[] = [
      this.add.text(12, HEADER_Y, t('storage.team', { n: gs.team.length, max: gs.teamSlots }), TEXT_STYLE),
      this.add.text(COL_W + 12, HEADER_Y, t('storage.box', { n: gs.storage.length }), TEXT_STYLE),
    ];
    for (const column of ['team', 'storage'] as const) {
      const x0 = column === 'team' ? 0 : COL_W;
      const rows = boxRows(gs, column, data.flexymon);
      if (rows.length === 0) {
        parts.push(
          this.add.text(x0 + 24, ROWS_Y, t('storage.empty'), { ...TEXT_STYLE, color: COLOR_DISABLED }),
        );
      }
      const top = this.top[column];
      rows.slice(top, top + VISIBLE).forEach((r, i) => {
        const y = ROWS_Y + i * ROW_H;
        const color = r.fainted ? COLOR_DISABLED : COLOR_TEXT;
        let x = x0 + 24;
        if (r.icon && this.textures.exists(r.icon)) {
          parts.push(
            this.add
              .image(x, y + 1, r.icon)
              .setOrigin(0)
              .setAlpha(r.fainted ? 0.5 : 1),
          );
          x += ICON_W;
        }
        parts.push(this.add.text(x, y, r.name, { ...TEXT_STYLE, color }));
        parts.push(
          this.add
            .text(x0 + COL_W - 10, y, t('storage.hp', { hp: r.hp, max: r.maxHp }), { ...TEXT_STYLE, color })
            .setOrigin(1, 0),
        );
      });
    }
    const count = gs[this.column].length;
    if (count > 0) {
      const x = (this.column === 'team' ? 0 : COL_W) + 10;
      const y = ROWS_Y + (this.cursor - this.top[this.column]) * ROW_H + 4;
      parts.push(this.add.triangle(x, y, 0, 0, 0, 8, 6, 4, COLOR_BORDER).setOrigin(0));
    }
    this.content = this.add.container(0, 0, parts);
  }

  /** Leave: tell the overworld and stop. */
  private close(): void {
    uiSound('cancel');
    this.open = false;
    log('Storage: close');
    events.emit('overlay:closed', { scene: STORAGE_SCENE });
    this.scene.stop();
  }

  /** The screen as plain data (for the E2E hooks). */
  view(): StorageView {
    const gs = gameState();
    return {
      column: this.column,
      cursor: this.cursor,
      team: gs.team.map((m) => m.speciesId),
      storage: gs.storage.map((m) => m.speciesId),
      teamSlots: gs.teamSlots,
      message: this.dialog.state()?.full ?? null,
    };
  }
}
