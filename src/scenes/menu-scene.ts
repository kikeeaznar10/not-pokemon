/**
 * MenuScene (M10) — the Start menu, opened with Start in the overworld and drawn over it while it is
 * paused (game time stops: NPCs freeze, nothing rolls).
 *
 * - Main: a column on the right with *Equipo, Mochila, Mapa, Opciones, Cerrar* (`START_MENU`). B, Start or
 *   *Cerrar* closes the menu: it asks for an auto-save (`save:request` `menu`), emits `overlay:closed`
 *   and stops; the overworld resumes.
 * - Equipo: the team in battle order (icon, name, "PS hp/max"). A opens a member's detail page: front
 *   sprite, HP, the four stats as "value (base + bonus)" and the attacks with their accuracy, plus
 *   *Mover* / *Volver*. *Mover* goes back to the list asking for the new position; A there moves the
 *   flexymon (`reorderTeam`; the first one is sent into battle first). B goes back one step.
 * - Mochila: the bag with icons and "x{n}"; the description of the item under the cursor shows at the
 *   bottom. Items usable outside battle can be chosen (others are greyed): heal / revive items ask for a
 *   team member (greyed when it would do nothing), the Regleta is used at once; `useFieldItem` does the
 *   rest and the result is shown in the dialogue box. An empty bag says so.
 * - Mapa (M12): outdoors it toggles the minimap (`src/ui/minimap.ts`, same as M) and says "Minimapa activado." /
 *   "Minimapa desactivado."; the change shows at once in the paused overworld underneath. Indoors (`zones.json ›
 *   indoor`) it only says there is no map inside.
 * - Opciones: *Música*, *Efectos* (0–10) and *Texto* (lenta / normal / rápida). Up/Down choose, Left/Right
 *   change the value at once (saved in `flexymon.options`, applied live), A on *Volver* or B goes back.
 * Sounds (M15): menus play their own; Start closing the menu plays `cancel`, the options page `cursor` on a move or
 * a changed value (after the change, so a new effects volume is heard), refused bag items `error`.
 * Every rule (rows, enabled options, stats, messages) comes from `src/logic/menu.ts` and
 * `src/logic/options.ts`; this scene only draws and reads input.
 */
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { events } from '../core/events';
import { input } from '../core/input';
import { uiSound } from '../core/ui-sound';
import { log } from '../core/log';
import { getOptions, setOptions } from '../core/options';
import { gameState, setGameState } from '../core/session';
import { getGameData } from '../data/game-data';
import { t } from '../i18n';
import { fieldItemNeedsTarget, useFieldItem } from '../logic/field-items';
import {
  bagRows,
  bagTargetRows,
  fieldErrorMessage,
  fieldUseMessages,
  flexymonDetail,
  START_MENU,
  teamRows,
  type BagRow,
  type FlexymonDetail,
} from '../logic/menu';
import { OPTION_KEYS, stepOption, type OptionKey, type Options } from '../logic/options';
import { reorderTeam } from '../logic/team';
import { DIALOG_HEIGHT, DialogBox } from '../ui/dialog-box';
import { GridMenu, type GridMenuState } from '../ui/grid-menu';
import { toggleMinimap } from '../ui/minimap';

/** Scene key of {@link MenuScene}. */
export const MENU_SCENE = 'Menu';

/** What the menu is showing. */
export type MenuUi =
  'main' | 'team' | 'detail' | 'move' | 'bag' | 'bag_target' | 'options' | 'message' | 'closed';

/** The menu as plain data (for the E2E hooks). */
export interface MenuView {
  ui: MenuUi;
  /** The open list (options + cursor), or `null`. */
  menu: GridMenuState | null;
  /** The detail page while it shows, else `null`. */
  detail: FlexymonDetail | null;
  /** Options screen: the values and the row under the cursor (0–2 options, 3 = Volver). */
  options: Options & { cursor: number };
  /** Description panel text (Mochila), or `''`. */
  description: string;
  /** Text of the open dialogue box, or `null`. */
  message: string | null;
  /** True once the open dialogue box shows its whole text (A then goes on); `false` with no box. */
  messageTyped: boolean;
}

const MAIN_W = 150;
const ROW_H = 22;
const LIST_H = GAME_HEIGHT - DIALOG_HEIGHT;
const DETAIL_MENU_W = 130;
const DETAIL_MENU_H = 60;
const COLOR_PANEL = 0xf8f8f0;
const COLOR_BORDER = 0x202028;
const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '14px',
  color: '#202028',
};

/** The Start menu. */
export class MenuScene extends Phaser.Scene {
  private ui: MenuUi = 'main';
  private menu!: GridMenu;
  private dialog!: DialogBox;
  /** Full-screen backing panel of the sub-screens (hidden on the main menu, so the map shows). */
  private backdrop!: Phaser.GameObjects.Rectangle;
  private descText!: Phaser.GameObjects.Text;
  private descPanel!: Phaser.GameObjects.Container;
  private page: Phaser.GameObjects.Container | null = null;
  private detail: FlexymonDetail | null = null;
  private teamCursor = 0;
  private bagCursor = 0;
  private optionCursor = 0;
  private bag: BagRow[] = [];
  /** The frame the menu opens it ignores input (the Start that opened it). */
  private skipInput = false;

  constructor() {
    super(MENU_SCENE);
  }

  create(): void {
    this.ui = 'main';
    this.detail = null;
    this.page = null;
    this.teamCursor = 0;
    this.bagCursor = 0;
    this.optionCursor = 0;
    this.skipInput = true;
    this.backdrop = this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLOR_PANEL)
      .setOrigin(0)
      .setStrokeStyle(2, COLOR_BORDER)
      .setVisible(false);
    this.descText = this.add.text(12, 10, '', { ...TEXT_STYLE, wordWrap: { width: GAME_WIDTH - 24 } });
    const descBg = this.add
      .rectangle(0, 0, GAME_WIDTH, DIALOG_HEIGHT, COLOR_PANEL)
      .setOrigin(0)
      .setStrokeStyle(2, COLOR_BORDER);
    this.descPanel = this.add
      .container(0, GAME_HEIGHT - DIALOG_HEIGHT, [descBg, this.descText])
      .setDepth(90)
      .setVisible(false);
    this.menu = new GridMenu(this);
    this.dialog = new DialogBox(this);
    log('Menu: open');
    this.openMain(0);
  }

  override update(_time: number, delta: number): void {
    if (this.ui === 'closed') return;
    if (this.skipInput) {
      this.skipInput = false;
      return;
    }
    if (this.dialog.isOpen) this.dialog.update(delta);
    else if (this.ui === 'options') this.updateOptions();
    else if (this.ui === 'main' && input.justPressed('start')) {
      uiSound('cancel');
      this.close();
    } else if (this.menu.isOpen) this.menu.update();
  }

  /** Remove the current sub-screen drawing (detail page, options page). */
  private clearPage(): void {
    this.page?.destroy();
    this.page = null;
  }

  /** Show `lines` in the dialogue box, then run `next`. */
  private say(lines: string[], next: () => void): void {
    this.ui = 'message';
    this.menu.close();
    this.dialog.open(lines, { onClose: next });
  }

  /** The column on the right: Equipo, Mochila, Mapa, Opciones, Cerrar. */
  private openMain(initial: number): void {
    this.ui = 'main';
    this.clearPage();
    this.detail = null;
    this.backdrop.setVisible(false);
    this.descPanel.setVisible(false);
    const options = START_MENU.map((entry) => ({ label: t(`menu.${entry}`), enabled: true }));
    this.menu.open(
      options,
      {
        x: GAME_WIDTH - MAIN_W - 4,
        y: 4,
        width: MAIN_W,
        height: options.length * ROW_H + 16,
        cols: 1,
      },
      {
        initial,
        onChoose: (i) => {
          const entry = i === null ? 'close' : START_MENU[i];
          if (entry === 'team') this.openTeam(0, 'team');
          else if (entry === 'bag') this.openBag(0);
          else if (entry === 'map') this.say([this.mapMessage()], () => this.openMain(2));
          else if (entry === 'options') this.openOptions();
          else this.close();
        },
      },
    );
  }

  /** *Mapa* (M12): toggle the minimap outdoors and return what to say about it. */
  private mapMessage(): string {
    const zone = getGameData().zones.get(gameState().player.map);
    if (!zone || zone.indoor) return t('menu.map_indoor');
    return toggleMinimap() ? t('menu.map_on') : t('menu.map_off');
  }

  /** The team list. In `move` mode A puts the member being moved at the chosen position. */
  private openTeam(initial: number, mode: 'team' | 'move'): void {
    this.ui = mode;
    this.clearPage();
    this.backdrop.setVisible(true);
    this.descPanel.setVisible(false);
    const rows = teamRows(gameState(), getGameData());
    const moving = this.detail;
    this.menu.open(
      rows.map((r) => ({
        label: r.name,
        enabled: true,
        icon: r.icon,
        right: t('menu.hp', { hp: r.hp, max: r.maxHp }),
      })),
      {
        x: 0,
        y: 0,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        cols: 1,
        title: mode === 'move' && moving ? t('menu.move_title', { name: moving.name }) : t('menu.team_title'),
      },
      {
        initial,
        onMove: (i) => {
          if (mode === 'team') this.teamCursor = i;
        },
        onChoose: (i) => {
          if (mode === 'team') {
            if (i === null) return this.openMain(0);
            return this.openDetail(i);
          }
          if (i === null || !moving) return this.openDetail(this.teamCursor);
          const result = reorderTeam(gameState(), moving.uid, i);
          if (result.ok) {
            setGameState({ ...gameState(), team: result.party.team });
            log(`Menu: moved ${moving.uid} to position ${i}`);
          }
          this.teamCursor = i;
          this.detail = null;
          this.openTeam(i, 'team');
        },
      },
    );
  }

  /** The detail page of team member `index`: sprite, HP, stats (base + bonus), attacks; Mover / Volver. */
  private openDetail(index: number): void {
    const inst = gameState().team[index];
    const detail = inst ? flexymonDetail(inst, getGameData()) : null;
    if (!detail) return this.openTeam(0, 'team');
    this.ui = 'detail';
    this.teamCursor = index;
    this.detail = detail;
    this.clearPage();
    this.backdrop.setVisible(true);
    const parts: Phaser.GameObjects.GameObject[] = [];
    if (this.textures.exists(detail.sprite)) parts.push(this.add.image(16, 16, detail.sprite).setOrigin(0));
    parts.push(this.add.text(96, 16, detail.name, { ...TEXT_STYLE, fontSize: '18px' }));
    parts.push(this.add.text(96, 44, t('menu.position', { n: index + 1 }), TEXT_STYLE));
    detail.stats.forEach((s, i) => {
      const y = 100 + i * ROW_H;
      const value = s.stat === 'hp' ? t('menu.hp_value', { hp: detail.hp, max: s.value }) : String(s.value);
      parts.push(this.add.text(16, y, t(`stat.${s.stat}`), TEXT_STYLE));
      parts.push(this.add.text(120, y, value, TEXT_STYLE));
      parts.push(this.add.text(220, y, t('menu.stat_parts', { base: s.base, bonus: s.bonus }), TEXT_STYLE));
    });
    parts.push(this.add.text(330, 16, t('menu.attacks'), TEXT_STYLE));
    detail.attacks.forEach((a, i) => {
      const y = 40 + i * ROW_H;
      parts.push(this.add.text(330, y, a.name, TEXT_STYLE));
      parts.push(
        this.add.text(GAME_WIDTH - 12, y, t('menu.accuracy', { n: a.accuracy }), TEXT_STYLE).setOrigin(1, 0),
      );
    });
    this.page = this.add.container(0, 0, parts).setDepth(80);
    const canMove = gameState().team.length > 1;
    this.menu.open(
      [
        { label: t('menu.move'), enabled: canMove },
        { label: t('menu.back'), enabled: true },
      ],
      {
        x: GAME_WIDTH - DETAIL_MENU_W - 8,
        y: GAME_HEIGHT - DETAIL_MENU_H - 8,
        width: DETAIL_MENU_W,
        height: DETAIL_MENU_H,
        cols: 1,
      },
      {
        initial: canMove ? 0 : 1,
        onChoose: (i) => {
          if (i === 0) this.openTeam(index, 'move');
          else {
            this.detail = null;
            this.openTeam(index, 'team');
          }
        },
      },
    );
  }

  /** The bag; usable items can be chosen, the description follows the cursor. */
  private openBag(initial: number): void {
    this.clearPage();
    this.bag = bagRows(gameState(), getGameData());
    if (this.bag.length === 0) {
      this.backdrop.setVisible(false);
      this.descPanel.setVisible(false);
      return this.say([t('bag.empty')], () => this.openMain(1));
    }
    this.ui = 'bag';
    this.backdrop.setVisible(true);
    this.descPanel.setVisible(true);
    const start = Math.min(initial, this.bag.length - 1);
    this.menu.open(
      this.bag.map((r) => ({
        label: r.name,
        enabled: r.usable,
        icon: r.icon,
        right: t('bag.count', { n: r.count }),
      })),
      { x: 0, y: 0, width: GAME_WIDTH, height: LIST_H, cols: 1, title: t('menu.bag_title') },
      {
        initial: start,
        onMove: (i) => {
          this.bagCursor = i;
          this.descText.setText(this.bag[i]?.description ?? '');
        },
        onChoose: (i) => {
          const row = i === null ? undefined : this.bag[i];
          if (!row) return this.openMain(1);
          this.chooseItem(row);
        },
      },
    );
  }

  /** Use `row`'s item: ask for a team member first when it needs one. */
  private chooseItem(row: BagRow): void {
    const item = getGameData().items.get(row.itemId);
    if (!item) return;
    if (!fieldItemNeedsTarget(item)) return this.useItem(row);
    this.ui = 'bag_target';
    this.descPanel.setVisible(false);
    const targets = bagTargetRows(gameState(), getGameData(), row.itemId);
    this.menu.open(
      targets.map((r) => ({
        label: r.name,
        enabled: r.enabled,
        icon: r.icon,
        right: t('menu.hp', { hp: r.hp, max: r.maxHp }),
      })),
      {
        x: 0,
        y: 0,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        cols: 1,
        title: t('bag.target', { item: row.name }),
      },
      {
        onChoose: (i) => {
          const target = i === null ? undefined : targets[i];
          if (!target) return this.openBag(this.bagCursor);
          this.useItem(row, target.uid);
        },
      },
    );
  }

  /** Run `useFieldItem` and show what happened, then back to the bag. */
  private useItem(row: BagRow, targetUid?: string): void {
    const data = getGameData();
    const result = useFieldItem(gameState(), data, row.itemId, targetUid);
    this.descPanel.setVisible(false);
    if (!result.ok) {
      uiSound('error');
      return this.say([fieldErrorMessage(result.reason, t)], () => this.openBag(this.bagCursor));
    }
    setGameState(result.state);
    log(`Menu: used ${row.itemId}${targetUid ? ` on ${targetUid}` : ''}`);
    this.say(fieldUseMessages(result.use, row.name, result.state, data, t), () =>
      this.openBag(this.bagCursor),
    );
  }

  /** The options page. */
  private openOptions(): void {
    this.ui = 'options';
    this.menu.close();
    this.backdrop.setVisible(true);
    this.descPanel.setVisible(false);
    this.optionCursor = 0;
    this.renderOptions();
  }

  /** Up/Down choose a row, Left/Right change it, A on Volver or B goes back. */
  private updateOptions(): void {
    const rows = OPTION_KEYS.length + 1;
    const before = this.optionCursor;
    if (input.justPressed('up')) this.optionCursor = Math.max(0, this.optionCursor - 1);
    else if (input.justPressed('down')) this.optionCursor = Math.min(rows - 1, this.optionCursor + 1);
    else if (input.justPressed('left') || input.justPressed('right')) {
      const key = OPTION_KEYS[this.optionCursor];
      if (key) {
        const delta = input.justPressed('left') ? -1 : 1;
        setOptions(stepOption(getOptions(), key, delta));
        log(`Menu: option ${key} = ${String(getOptions()[key])}`);
        // Played after the change, so a new effects volume is heard at once.
        uiSound('cursor');
      }
    } else if (input.justPressed('b') || (input.justPressed('a') && this.optionCursor === rows - 1)) {
      uiSound(input.justPressed('b') ? 'cancel' : 'confirm');
      return this.openMain(3);
    } else return;
    if (this.optionCursor !== before) uiSound('cursor');
    this.renderOptions();
  }

  /** The text of option `key`'s value. */
  private optionValue(key: OptionKey): string {
    const o = getOptions();
    if (key === 'textSpeed') return t(`options.speed_${o.textSpeed}`);
    return t('options.level', { n: o[key] });
  }

  private renderOptions(): void {
    this.clearPage();
    const parts: Phaser.GameObjects.GameObject[] = [this.add.text(16, 12, t('options.title'), TEXT_STYLE)];
    const labels = [...OPTION_KEYS.map((k) => t(`options.${k}`)), t('menu.back')];
    labels.forEach((label, i) => {
      const y = 48 + i * 30;
      parts.push(this.add.text(36, y, label, TEXT_STYLE));
      const key = OPTION_KEYS[i];
      if (key)
        parts.push(this.add.text(220, y, t('options.value', { value: this.optionValue(key) }), TEXT_STYLE));
      if (i === this.optionCursor) {
        parts.push(this.add.triangle(20, y + 4, 0, 0, 0, 8, 6, 4, COLOR_BORDER).setOrigin(0));
      }
    });
    parts.push(this.add.text(16, GAME_HEIGHT - 30, t('options.hint'), TEXT_STYLE));
    this.page = this.add.container(0, 0, parts).setDepth(80);
  }

  /** Leave: auto-save request, tell the overworld, stop. */
  private close(): void {
    this.ui = 'closed';
    this.menu.close();
    log('Menu: close');
    events.emit('save:request', { reason: 'menu' });
    events.emit('overlay:closed', { scene: MENU_SCENE });
    this.scene.stop();
  }

  /** The menu as plain data (for the E2E hooks). */
  view(): MenuView {
    return {
      ui: this.ui,
      menu: this.menu.state(),
      detail: this.ui === 'detail' ? this.detail : null,
      options: { ...getOptions(), cursor: this.optionCursor },
      description: this.descPanel.visible ? this.descText.text : '',
      message: this.dialog.state()?.full ?? null,
      messageTyped: this.dialog.state()?.typed ?? false,
    };
  }
}
