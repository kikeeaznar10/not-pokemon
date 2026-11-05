/**
 * TitleScene (M11) — the first screen after loading: the pixel office (`intro.json › titleImage`), the logo
 * (`app.title`) and a blinking "Pulsa START".
 *
 * - Start, A or a tap shows the menu: *Continuar* (only when `flexymon.save.v1` holds a valid save) and
 *   *Nueva partida*. B goes back to "Pulsa START".
 * - The save is read once when the scene starts (`saveStore.load`). A broken save was copied to
 *   `flexymon.save.broken` by the store; the title then offers only *Nueva partida* and says the save could
 *   not be read.
 * - *Continuar* puts the loaded game in the session and enters the overworld where the player was saved.
 * - *Nueva partida* with a save asks for confirmation first (Sí / No, the cursor starts on No); with no save it
 *   goes straight on. A new game continues in the NameScene, then the IntroScene. The old save is only
 *   overwritten when the new game enters its first map (auto-save).
 * - Sounds (M15): opening the menu (Start, A or a tap) and choosing with Start play `confirm`; the menu and the Sí /
 *   No box play their own.
 * - {@link TitleScene.quickStart} (E2E hooks only) does what Start did before M11: continue a valid save,
 *   or start a new game with the default name at `start.json › spawn`, skipping the name and the intro.
 */
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { input } from '../core/input';
import { uiSound } from '../core/ui-sound';
import { log } from '../core/log';
import { saveStore, type LoadOutcome } from '../core/save-store';
import { gameState, resetGameState, setGameState } from '../core/session';
import { getGameData } from '../data/game-data';
import { t } from '../i18n';
import { TITLE_BLINK_MS } from '../logic/constants';
import { ChoiceBox, type ChoiceState } from '../ui/choice-box';
import { GridMenu } from '../ui/grid-menu';
import { NAME_SCENE } from './name-scene';
import { OVERWORLD_SCENE, type OverworldData } from './overworld-scene';

/** Scene key of {@link TitleScene}. */
export const TITLE_SCENE = 'Title';

/** What the title shows: `press` ("Pulsa START"), `menu`, `confirm` (new game over a save), `leaving`. */
export type TitleUi = 'press' | 'menu' | 'confirm' | 'leaving';

/** The title as data (for the E2E hooks). */
export interface TitleView {
  ui: TitleUi;
  /** Menu labels while the menu shows (else `[]`) and its cursor. */
  options: string[];
  cursor: number;
  /** The Sí / No box while confirming, else `null`. */
  confirm: ChoiceState | null;
  /** True when a valid save exists (Continuar is offered). */
  hasSave: boolean;
  /** True when the save could not be read (only Nueva partida). */
  brokenSave: boolean;
  /** The logo and hint texts. */
  logo: string;
  hint: string;
}

type MenuChoice = 'continue' | 'new';

const LOGO_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '40px',
  fontStyle: 'bold',
  color: '#f8f8f0',
  stroke: '#202028',
  strokeThickness: 6,
};
const HINT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '14px',
  color: '#f8f8f0',
  stroke: '#202028',
  strokeThickness: 4,
};
const MENU_W = 200;
const MENU_ROW_H = 24;
const CONFIRM_H = 56;

/** The title screen. */
export class TitleScene extends Phaser.Scene {
  private ui: TitleUi = 'press';
  private outcome: LoadOutcome = { status: 'none' };
  private hint!: Phaser.GameObjects.Text;
  private logo!: Phaser.GameObjects.Text;
  private menu!: GridMenu;
  private choice!: ChoiceBox;
  private confirmPanel: Phaser.GameObjects.Container | null = null;
  private menuItems: MenuChoice[] = [];
  private blinkMs = 0;

  constructor() {
    super(TITLE_SCENE);
  }

  create(): void {
    this.ui = 'press';
    this.blinkMs = 0;
    this.confirmPanel = null;
    const data = getGameData();
    if (this.textures.exists(data.intro.titleImage)) {
      this.add
        .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, data.intro.titleImage)
        .setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    }
    this.logo = this.add.text(GAME_WIDTH / 2, 48, t('app.title'), LOGO_STYLE).setOrigin(0.5);
    this.hint = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 40, t('title.press_start'), HINT_STYLE)
      .setOrigin(0.5);
    this.menu = new GridMenu(this);
    this.choice = new ChoiceBox(this);

    this.outcome = saveStore.load(data);
    if (this.outcome.status === 'broken') {
      this.add
        .text(GAME_WIDTH / 2, GAME_HEIGHT - 14, t('title.broken_save'), { ...HINT_STYLE, fontSize: '11px' })
        .setOrigin(0.5);
    }
    this.menuItems = this.outcome.status === 'loaded' ? ['continue', 'new'] : ['new'];
    this.input.on('pointerdown', () => {
      if (this.ui !== 'press') return;
      uiSound('confirm');
      this.openMenu();
    });
    log(`Title: save ${this.outcome.status}`);
  }

  override update(_time: number, delta: number): void {
    if (this.ui === 'press') {
      this.blinkMs = (this.blinkMs + delta) % (2 * TITLE_BLINK_MS);
      this.hint.setVisible(this.blinkMs < TITLE_BLINK_MS);
      if (input.justPressed('start') || input.justPressed('a')) {
        uiSound('confirm');
        this.openMenu();
      }
      return;
    }
    if (this.ui === 'menu') {
      if (input.justPressed('start') && this.menu.isOpen) {
        // Start chooses like A (the cursor's option).
        const cursor = this.menu.state()?.cursor ?? 0;
        uiSound('confirm');
        this.menu.close();
        this.onMenu(cursor);
        return;
      }
      this.menu.update();
    } else if (this.ui === 'confirm') this.choice.update();
  }

  /** Show the Continuar / Nueva partida menu. */
  private openMenu(): void {
    if (this.ui !== 'press') return;
    this.ui = 'menu';
    this.hint.setVisible(false);
    const labels = this.menuItems.map((m) => t(m === 'continue' ? 'title.continue' : 'title.new_game'));
    const h = 16 + MENU_ROW_H * labels.length;
    this.menu.open(
      labels.map((label) => ({ label, enabled: true })),
      {
        x: (GAME_WIDTH - MENU_W) / 2,
        y: GAME_HEIGHT - h - 28,
        width: MENU_W,
        height: h,
        cols: 1,
        rowH: MENU_ROW_H,
      },
      { onChoose: (i) => this.onMenu(i) },
    );
  }

  private onMenu(index: number | null): void {
    const item = index === null ? null : this.menuItems[index];
    if (item === null || item === undefined) {
      this.ui = 'press';
      this.blinkMs = 0;
      return;
    }
    if (item === 'continue') return this.continueGame();
    if (this.outcome.status === 'loaded') return this.askNewGame();
    this.newGame();
  }

  /** Nueva partida over a save: "¿Empezar una nueva?" with Sí / No (No first). */
  private askNewGame(): void {
    this.ui = 'confirm';
    const w = GAME_WIDTH - 16;
    const bg = this.add.rectangle(0, 0, w, CONFIRM_H, 0xf8f8f0).setOrigin(0).setStrokeStyle(2, 0x202028);
    const text = this.add.text(10, 8, t('title.confirm_new'), {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#202028',
      wordWrap: { width: w - 20 },
    });
    this.confirmPanel = this.add.container(8, GAME_HEIGHT - CONFIRM_H - 8, [bg, text]).setDepth(100);
    this.choice.open([t('title.yes'), t('title.no')], {
      initial: 1,
      y: GAME_HEIGHT - CONFIRM_H - 8 - 62,
      onChoose: (i) => {
        this.confirmPanel?.destroy();
        this.confirmPanel = null;
        if (i === 0) return this.newGame();
        this.ui = 'press';
        this.blinkMs = 0;
      },
    });
  }

  /** Continue the loaded save in the overworld. */
  private continueGame(): void {
    if (this.outcome.status !== 'loaded') return;
    this.ui = 'leaving';
    setGameState(this.outcome.state);
    const { map, x, y, facing } = gameState().player;
    log(`Title: continuing the saved game at ${map} ${x},${y}`);
    this.scene.start(OVERWORLD_SCENE, { map, x, y, facing } satisfies OverworldData);
  }

  /** Start a new game: the name screen, then the intro. */
  private newGame(): void {
    this.ui = 'leaving';
    resetGameState();
    log('Title: new game');
    this.scene.start(NAME_SCENE);
  }

  /**
   * E2E only: continue a valid save, else start a new game with the default name at the spawn point,
   * skipping the menu, the name and the intro. False if the title is not showing.
   */
  quickStart(): boolean {
    if (!this.sys.isActive() || this.ui === 'leaving') return false;
    this.menu.close();
    if (this.outcome.status === 'loaded') {
      this.continueGame();
      return true;
    }
    this.ui = 'leaving';
    resetGameState();
    const { map, x, y, facing } = gameState().player;
    this.scene.start(OVERWORLD_SCENE, { map, x, y, facing } satisfies OverworldData);
    return true;
  }

  /** The title as data. */
  view(): TitleView {
    const m = this.menu.state();
    return {
      ui: this.ui,
      options: m ? m.options.map((o) => o.label) : [],
      cursor: m?.cursor ?? 0,
      confirm: this.choice.state(),
      hasSave: this.outcome.status === 'loaded',
      brokenSave: this.outcome.status === 'broken',
      logo: this.logo.text,
      hint: this.hint.text,
    };
  }
}
