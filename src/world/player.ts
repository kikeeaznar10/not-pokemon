/**
 * The player in the overworld: a sprite driven by the pure grid-movement rules in
 * `src/logic/movement.ts`. This class only draws: it never decides whether a move is allowed.
 *
 * Sprite sheet `assets/sprites/player.png` (made by `npm run test-map` until real art exists):
 * 32 × 32 frames, 2 columns (stand, stride) × 4 rows (down, left, right, up).
 */
import Phaser from 'phaser';
import { TILE_SIZE } from '../config/game';
import type { Facing } from '../data/schemas';
import type { Direction } from '../core/input';
import {
  createMoveState,
  haltAt,
  renderPosition,
  updateMovement,
  walkFrame,
  type BlockedFn,
  type MoveEvent,
  type MoveState,
} from '../logic/movement';

/** Texture key and path of the player sheet (relative to `public/`). */
export const PLAYER_SPRITE = 'assets/sprites/player.png';

/** Sheet row for each facing. */
const ROW: Record<Facing, number> = { down: 0, left: 1, right: 2, up: 3 };

/** Frame index in the sheet for a facing and walk frame (0 stand, 1 stride). */
export function playerFrame(facing: Facing, frame: 0 | 1): number {
  return ROW[facing] * 2 + frame;
}

/** The player sprite plus its movement state. */
export class Player {
  readonly sprite: Phaser.GameObjects.Sprite;
  private move: MoveState;

  constructor(scene: Phaser.Scene, x: number, y: number, facing: Facing) {
    this.move = createMoveState(x, y, facing);
    this.sprite = scene.add.sprite(0, 0, PLAYER_SPRITE, playerFrame(facing, 0)).setOrigin(0).setDepth(2);
    this.sprite.setName('player');
    this.draw();
  }

  /** Current movement state (tile, facing, step in progress). */
  get state(): Readonly<MoveState> {
    return this.move;
  }

  /** Advance by `dtMs` with `dir` held (`fresh` = pressed this frame); returns what happened. */
  update(dir: Direction | null, dtMs: number, blocked: BlockedFn, fresh = false): MoveEvent[] {
    const result = updateMovement(this.move, dir, dtMs, blocked, fresh);
    this.move = result.state;
    this.draw();
    return result.events;
  }

  /** Stand still on tile (x, y), dropping a step that just started (see `haltAt`). */
  halt(x: number, y: number): void {
    this.move = haltAt(this.move, x, y);
    this.draw();
  }

  /** Turn to `facing` (M8: face an enemy that walked up). Ignored while a step is in progress. */
  face(facing: Facing): void {
    if (this.move.step) return;
    this.move = createMoveState(this.move.x, this.move.y, facing);
    this.draw();
  }

  private draw(): void {
    const pos = renderPosition(this.move);
    this.sprite.setPosition(Math.round(pos.x * TILE_SIZE), Math.round(pos.y * TILE_SIZE));
    this.sprite.setFrame(playerFrame(this.move.facing, walkFrame(this.move)));
  }
}
