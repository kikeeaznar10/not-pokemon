/**
 * BattleScene (M6) — the battle screen, driven entirely by the M2 logic (`src/logic/battle.ts`).
 *
 * - Start it with {@link BattleSceneData}: the battle kind, the opponent's team and optionally an RNG
 *   seed (applied before the first roll, so tests replay a battle exactly). The player's team and bag
 *   come from the game state (`src/core/session.ts`).
 * - Layout (512 × 288): opponent sprite top right, its name and HP bar top left; the player's flexymon
 *   (back sprite) bottom left, its name, HP bar and "PS 31/40" bottom right; messages and menus in the
 *   bottom 80 px (the DialogBox for messages).
 * - Each player choice goes through `chooseAction()`; the returned `events[]` become view steps
 *   (`src/logic/battle-view.ts`) played in order: message (A to go on), attack sound, shake/flash on a
 *   hit, HP bar animating over `HP_ANIM_MS`, faint / switch. The scene never computes a rule: menus ask
 *   the logic what is allowed (greyed out otherwise) and HP numbers come from the events.
 * - Menus: main 2 × 2 (Atacar, Objeto, Cambiar, Huir — Huir greyed against NPCs); attack list with the
 *   accuracy beside it; team list with icons, names and HP (fainted greyed). B goes back to the main
 *   menu from every sub-menu; in the main menu B does nothing. The forced switch after a faint cannot
 *   be cancelled (the player must pick someone; there is always someone alive in that phase).
 *   Objeto shows "Pronto" until M9.
 * - End: the team (HP) and bag are written back to the game state, the screen fades out, the scene
 *   emits `battle:ended` and stops; the overworld wakes up on the same tile. After a loss the team is
 *   fully healed (placeholder until M8 runs the Losing rule).
 * - While the debug menu (`debug:menu`) is open, the battle ignores input.
 */
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { events } from '../core/events';
import { log } from '../core/log';
import { rng } from '../core/rng';
import { gameState, setGameState } from '../core/session';
import { getGameData } from '../data/game-data';
import { t } from '../i18n';
import {
  activeFlexymon,
  chooseAction,
  createBattle,
  introEvents,
  type BattleAction,
  type BattleKind,
  type BattleResult,
  type BattleState,
  type Side,
} from '../logic/battle';
import { attackMenu, mainMenu, teamMenu, viewSteps, type ViewStep } from '../logic/battle-view';
import { maxHp, type FlexymonInstance } from '../logic/instance';
import { healParty } from '../logic/team';
import { DIALOG_HEIGHT, DialogBox } from '../ui/dialog-box';
import { GridMenu, type GridMenuState } from '../ui/grid-menu';
import { HpBar } from '../ui/hp-bar';

/** Scene key of {@link BattleScene}. */
export const BATTLE_SCENE = 'Battle';

/** How to start a battle. */
export interface BattleSceneData {
  kind: BattleKind;
  /** The opponent's team in order (one flexymon for a wild battle). */
  opponent: FlexymonInstance[];
  /** Re-seed the shared RNG before the battle starts (tests, debug). */
  seed?: number;
}

/** What the battle screen is doing. */
export type BattleUi = 'anim' | 'main' | 'attack' | 'team' | 'end';

/** One side as shown (for the E2E hooks). `hp`/`maxHp` are the logic numbers, `shownHp` the bar's. */
export interface BattleSideView {
  uid: string;
  speciesId: string;
  name: string;
  hp: number;
  maxHp: number;
  shownHp: number;
  hpText: string | null;
}

/** The whole screen as plain data (for the E2E hooks). */
export interface BattleView {
  kind: BattleKind;
  phase: BattleState['phase'];
  result: BattleResult | null;
  round: number;
  ui: BattleUi;
  menu: GridMenuState | null;
  /** Full text of the open message box, or `null`. */
  message: string | null;
  player: BattleSideView;
  opponent: BattleSideView;
}

/** Sprite scale (64 × 64 art drawn at 128 × 128). */
const SPRITE_SCALE = 2;
const HOME: Record<Side, { x: number; y: number }> = {
  opponent: { x: 384, y: 74 },
  player: { x: 120, y: 144 },
};
const MENU_TOP = GAME_HEIGHT - DIALOG_HEIGHT;
const COLOR_BG = 0xe8f0d8;
const COLOR_PLATFORM = 0xb8c890;
const COLOR_PANEL = 0xf8f8f0;
const COLOR_BORDER = 0x202028;
const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'monospace',
  fontSize: '14px',
  color: '#202028',
};
const SHOW_MS = 250;
const HIT_MS = 60;
const FAINT_MS = 300;
const END_FADE_MS = 300;

/** One side's display objects. */
interface SideDisplay {
  sprite: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
  bar: HpBar;
}

/** The battle screen. */
export class BattleScene extends Phaser.Scene {
  private battle!: BattleState;
  private kind: BattleKind = 'wild';
  private sides!: Record<Side, SideDisplay>;
  private dialog!: DialogBox;
  private menu!: GridMenu;
  private prompt!: Phaser.GameObjects.Container;
  private promptText!: Phaser.GameObjects.Text;
  private info!: Phaser.GameObjects.Container;
  private infoText!: Phaser.GameObjects.Text;
  private ui: BattleUi = 'anim';
  private debugMenuOpen = false;
  /** False once the scene shuts down, so pending animations stop. */
  private alive = false;

  constructor() {
    super(BATTLE_SCENE);
  }

  create(data: BattleSceneData): void {
    this.alive = true;
    this.debugMenuOpen = false;
    this.kind = data.kind;
    if (data.seed !== undefined) rng.seed(data.seed);
    const gs = gameState();
    this.battle = createBattle(gs.team, data.opponent, data.kind, gs.items);

    this.cameras.main.resetFX();
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLOR_BG).setOrigin(0);
    this.add.ellipse(HOME.opponent.x, HOME.opponent.y + 58, 168, 32, COLOR_PLATFORM);
    this.add.ellipse(HOME.player.x, HOME.player.y + 56, 184, 28, COLOR_PLATFORM);
    this.sides = {
      opponent: this.makeSide('opponent', 12, 12, 220, 46),
      player: this.makeSide('player', 272, 142, 228, 62),
    };

    this.promptText = this.add.text(12, 10, '', { ...TEXT_STYLE, wordWrap: { width: 244 } });
    this.prompt = this.panel(0, MENU_TOP, 272, DIALOG_HEIGHT, [this.promptText]).setVisible(false);
    this.infoText = this.add.text(12, 10, '', TEXT_STYLE);
    this.info = this.panel(334, MENU_TOP, GAME_WIDTH - 334, DIALOG_HEIGHT, [this.infoText]).setVisible(false);
    this.dialog = new DialogBox(this);
    this.menu = new GridMenu(this);

    const offs = [
      events.on('debug:menu', ({ open }) => {
        this.debugMenuOpen = open;
      }),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.alive = false;
      offs.forEach((off) => off());
    });

    log(`Battle: ${data.kind} vs ${data.opponent.map((o) => o.speciesId).join(', ')}`);
    void this.play(introEvents(this.battle), this.battle);
  }

  override update(_time: number, delta: number): void {
    if (this.debugMenuOpen) return;
    if (this.dialog.isOpen) this.dialog.update(delta);
    else if (this.menu.isOpen) this.menu.update();
  }

  /** A framed panel at (`x`, `y`) holding `children`. */
  private panel(x: number, y: number, w: number, h: number, children: Phaser.GameObjects.GameObject[]) {
    const bg = this.add.rectangle(0, 0, w, h, COLOR_PANEL).setOrigin(0).setStrokeStyle(2, COLOR_BORDER);
    return this.add.container(x, y, [bg, ...children]).setDepth(90);
  }

  /** Sprite, name and HP bar of one side; the info panel is at (`x`, `y`). */
  private makeSide(who: Side, x: number, y: number, w: number, h: number): SideDisplay {
    const sprite = this.add
      .image(HOME[who].x, HOME[who].y, '__DEFAULT')
      .setScale(SPRITE_SCALE)
      .setVisible(false);
    const name = this.add.text(8, 6, '', TEXT_STYLE);
    const bar = new HpBar(this, 8, 28, w - 16, who === 'player');
    this.panel(x, y, w, h, [name, ...bar.parts]).setDepth(10);
    return { sprite, name, bar };
  }

  /** Turn `evs` (produced from `before`) into view steps and play them, then show what comes next. */
  private async play(evs: Parameters<typeof viewSteps>[0], before: BattleState): Promise<void> {
    this.ui = 'anim';
    this.prompt.setVisible(false);
    this.info.setVisible(false);
    const steps = viewSteps(evs, { data: getGameData(), kind: this.kind, state: before, t });
    for (const step of steps) {
      if (!this.alive) return;
      await this.runStep(step);
    }
    if (!this.alive) return;
    if (this.battle.phase === 'ended') this.finish(this.battle.result ?? 'fled');
    else if (this.battle.phase === 'must_switch') this.openTeam(true);
    else this.openMain();
  }

  /** Play the player's `action` (one round, or the free switch after a faint). */
  private act(action: BattleAction): void {
    const before = this.battle;
    const step = chooseAction(before, action, { data: getGameData(), rng });
    this.battle = step.state;
    void this.play(step.events, before);
  }

  private runStep(step: ViewStep): Promise<void> {
    switch (step.type) {
      case 'message':
        return new Promise((resolve) => this.dialog.open([step.text], { onClose: resolve }));
      case 'sound':
        if (this.cache.audio.exists(step.key)) this.sound.play(step.key);
        return Promise.resolve();
      case 'show': {
        const side = this.sides[step.who];
        const species = getGameData().flexymon.get(step.speciesId);
        const key = species
          ? step.who === 'player'
            ? species.sprite.back
            : species.sprite.front
          : '__MISSING';
        side.name.setText(step.name);
        side.bar.set(step.hp, step.maxHp);
        const home = HOME[step.who];
        const from = step.who === 'player' ? -80 : GAME_WIDTH + 80;
        side.sprite.setTexture(key).setPosition(from, home.y).setAlpha(1).setVisible(true);
        return this.tweenTo(side.sprite, { x: home.x }, SHOW_MS);
      }
      case 'hit': {
        const sprite = this.sides[step.who].sprite;
        const x = HOME[step.who].x;
        return this.tweenTo(sprite, { x: x + 6, alpha: 0.3 }, HIT_MS, 2, true).then(() => {
          sprite.setPosition(x, HOME[step.who].y).setAlpha(1);
        });
      }
      case 'hp':
        return this.sides[step.who].bar.animateTo(step.hp, step.maxHp);
      case 'faint': {
        const sprite = this.sides[step.who].sprite;
        return this.tweenTo(sprite, { y: HOME[step.who].y + 60, alpha: 0 }, FAINT_MS).then(() => {
          sprite.setVisible(false);
        });
      }
      case 'withdraw': {
        const sprite = this.sides[step.who].sprite;
        return this.tweenTo(sprite, { alpha: 0 }, SHOW_MS).then(() => {
          sprite.setVisible(false);
        });
      }
      case 'need_switch':
      case 'end':
        return Promise.resolve();
    }
  }

  private tweenTo(
    target: Phaser.GameObjects.Image,
    props: Record<string, number>,
    duration: number,
    repeat = 0,
    yoyo = false,
  ): Promise<void> {
    return new Promise((resolve) => {
      this.tweens.add({ targets: target, ...props, duration, repeat, yoyo, onComplete: () => resolve() });
    });
  }

  /** The 2 × 2 main menu with "¿Qué hará {name}?" beside it. */
  private openMain(initial = 0): void {
    this.ui = 'main';
    const data = getGameData();
    const active = activeFlexymon(this.battle, 'player');
    const name = data.flexymon.get(active.speciesId)?.name ?? active.speciesId;
    this.promptText.setText(t('battle.prompt', { name }));
    this.prompt.setVisible(true);
    this.info.setVisible(false);
    const options = mainMenu(this.battle, data, t);
    this.menu.open(
      options,
      { x: 272, y: MENU_TOP, width: GAME_WIDTH - 272, height: DIALOG_HEIGHT, cols: 2, rowH: 30 },
      {
        initial,
        cancelable: false,
        onChoose: (i) => {
          switch (options[i ?? -1]?.id) {
            case 'attack':
              return this.openAttacks();
            case 'item':
              return this.itemsSoon();
            case 'switch':
              return this.openTeam(false);
            case 'flee':
              return this.act({ type: 'flee' });
          }
        },
      },
    );
  }

  /** The attack list (up to 3) with the accuracy of the one under the cursor. B goes back. */
  private openAttacks(): void {
    this.ui = 'attack';
    this.prompt.setVisible(false);
    const options = attackMenu(this.battle, getGameData(), t);
    this.info.setVisible(true);
    this.menu.open(
      options,
      { x: 0, y: MENU_TOP, width: 334, height: DIALOG_HEIGHT, cols: 1 },
      {
        onMove: (i) => this.infoText.setText(options[i]?.accuracy ?? ''),
        onChoose: (i) => {
          const opt = i === null ? undefined : options[i];
          if (!opt) return this.openMain(0);
          this.act({ type: 'attack', attackId: opt.id });
        },
      },
    );
  }

  /** The team list. `forced` after a faint: B does nothing and a replacement must be picked. */
  private openTeam(forced: boolean): void {
    this.ui = 'team';
    this.prompt.setVisible(false);
    this.info.setVisible(false);
    const options = teamMenu(this.battle, getGameData(), t);
    const rows = options.map((o) => ({
      // A fainted member says so even while it is still the active one (the forced switch).
      label: o.fainted
        ? `${o.label} (${t('battle.tag_fainted')})`
        : o.active
          ? `${o.label} (${t('battle.tag_active')})`
          : o.label,
      enabled: o.enabled,
      icon: o.icon,
      right: o.hpText,
    }));
    const initial = Math.max(
      0,
      options.findIndex((o) => o.enabled),
    );
    this.menu.open(
      rows,
      {
        // Full screen, so the info panels underneath do not show around it.
        x: 0,
        y: 0,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        cols: 1,
        rowH: 26,
        title: t(forced ? 'battle.team_must' : 'battle.team_title'),
      },
      {
        initial,
        cancelable: !forced,
        onChoose: (i) => {
          const opt = i === null ? undefined : options[i];
          if (!opt) return this.openMain(2);
          this.act({ type: 'switch', uid: opt.id });
        },
      },
    );
  }

  /** Objeto before M9: a "Pronto" message, then back to the main menu. */
  private itemsSoon(): void {
    this.ui = 'anim';
    this.prompt.setVisible(false);
    this.dialog.open([t('battle.item_soon')], { onClose: () => this.openMain(1) });
  }

  /** Write the team and bag back, fade out, announce the end and stop. */
  private finish(result: BattleResult): void {
    this.ui = 'end';
    const gs = gameState();
    const data = getGameData();
    let party = { team: this.battle.player.team, storage: gs.storage, teamSlots: gs.teamSlots };
    // Placeholder until M8's Losing rule: a lost battle leaves the team fully healed.
    if (result === 'lose') party = healParty(party, data.flexymon);
    setGameState({ ...gs, team: party.team, storage: party.storage, items: { ...this.battle.items } });
    log(`Battle: ended (${result})`);
    const cam = this.cameras.main;
    cam.fadeOut(END_FADE_MS, 0, 0, 0);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      events.emit('battle:ended', { result });
      this.scene.stop();
    });
  }

  /** The screen as plain data (for the E2E hooks). */
  view(): BattleView {
    const data = getGameData();
    const side = (who: Side): BattleSideView => {
      const inst = activeFlexymon(this.battle, who);
      const species = data.flexymon.get(inst.speciesId);
      const display = this.sides[who];
      return {
        uid: inst.uid,
        speciesId: inst.speciesId,
        name: display.name.text,
        hp: inst.currentHp,
        maxHp: species ? maxHp(species, inst) : 0,
        shownHp: display.bar.shown.hp,
        hpText: display.bar.text,
      };
    };
    return {
      kind: this.battle.kind,
      phase: this.battle.phase,
      result: this.battle.result,
      round: this.battle.round,
      ui: this.ui,
      menu: this.menu.state(),
      message: this.dialog.state()?.full ?? null,
      player: side('player'),
      opponent: side('opponent'),
    };
  }
}
