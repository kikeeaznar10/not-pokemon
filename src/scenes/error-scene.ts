/**
 * ErrorScene — red screen listing content errors, one per line (`file › path › message`; long
 * lines wrap). Scroll with the up/down arrows, the mouse wheel or a touch drag. The game stops here.
 *
 * Note: it reads the arrow keys through Phaser directly because the shared Input service
 * (`src/core/input.ts`) only arrives in M3; M3 should switch this scene to it.
 */
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { t } from '../i18n';

/** Scene key of {@link ErrorScene}. */
export const ERROR_SCENE = 'Error';

/** Data passed when starting the ErrorScene. */
export interface ErrorSceneData {
  /** Already formatted error lines. */
  lines: string[];
}

const MARGIN = 8;
const HEADER_H = 40;
const BG = 0xb00020;
const SCROLL_STEP = 12;
const FONT = { fontFamily: 'monospace', fontSize: '10px', color: '#ffffff' } as const;

/** Shows the content errors and blocks the game. */
export class ErrorScene extends Phaser.Scene {
  private body!: Phaser.GameObjects.Text;
  private scrollY = 0;
  private maxScroll = 0;
  private keys?: Phaser.Types.Input.Keyboard.CursorKeys;
  /** The lines being shown (read by the E2E hooks). */
  lines: string[] = [];

  constructor() {
    super(ERROR_SCENE);
  }

  init(data: ErrorSceneData): void {
    this.lines = data.lines ?? [];
    this.scrollY = 0;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BG);
    // Opaque header strip drawn over the scrolling list (Phaser 4 has no simple geometry mask).
    this.add
      .rectangle(0, 0, GAME_WIDTH, HEADER_H - 4, BG)
      .setOrigin(0)
      .setDepth(1);
    this.add
      .text(MARGIN, MARGIN, t('error.data_title', { count: this.lines.length }), {
        ...FONT,
        fontSize: '12px',
        fontStyle: 'bold',
      })
      .setDepth(2);
    this.add.text(MARGIN, MARGIN + 16, t('error.data_hint'), FONT).setDepth(2);

    const width = GAME_WIDTH - MARGIN * 2;
    this.body = this.add.text(MARGIN, HEADER_H, this.lines.map((l) => `• ${l}`).join('\n'), {
      ...FONT,
      wordWrap: { width, useAdvancedWrap: true },
      lineSpacing: 2,
    });
    this.body.setName('error-list');
    const viewH = GAME_HEIGHT - HEADER_H - MARGIN;
    this.maxScroll = Math.max(0, this.body.height - viewH);

    this.keys = this.input.keyboard?.createCursorKeys();
    this.keys?.up.on('down', () => this.scrollBy(-SCROLL_STEP));
    this.keys?.down.on('down', () => this.scrollBy(SCROLL_STEP));
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) =>
      this.scrollBy(Math.sign(dy) * SCROLL_STEP),
    );
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown) this.scrollBy(p.prevPosition.y - p.y);
    });
  }

  override update(): void {
    const keys = this.keys;
    if (!keys) return;
    // Hold to keep scrolling.
    if (keys.up.isDown && keys.up.getDuration() > 300) this.scrollBy(-2);
    if (keys.down.isDown && keys.down.getDuration() > 300) this.scrollBy(2);
  }

  /** Scroll the error list by `dy` pixels, clamped to the content. */
  scrollBy(dy: number): void {
    this.scrollY = Phaser.Math.Clamp(this.scrollY + dy, 0, this.maxScroll);
    this.body.setY(HEADER_H - this.scrollY);
  }
}
