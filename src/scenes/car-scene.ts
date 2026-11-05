/**
 * CarScene — the white Audi A3 speeding along a road between the office and Murcia.
 *
 * - Started by the OverworldScene (which sleeps underneath) with {@link CarSceneData}: `to = murcia` drives
 *   to the right, `to = valencia` is the same scene in reverse (the car faces left, the world scrolls the
 *   other way).
 * - Side-scrolling: a sky, far mountains, near bushes and the road scroll at different speeds (parallax),
 *   white speed lines streak past, the car bobs on its suspension and the camera shakes now and then. The
 *   engine (`car.json › sound`) loops at the effects volume; the car is `car.json › sprite` (side view, nose
 *   to the right).
 * - It lasts `CAR_TRIP_MS`; once `CAR_SKIP_AFTER_MS` have passed, any button (A, B, Start, Mapa or a
 *   direction) skips the rest (`src/logic/car.ts`). Then it fades out, emits `car:ended { to }` and stops;
 *   the overworld moves the player to `car.json › toMurcia` / `toValencia`.
 * The scenery is drawn from shapes in code (presentation only); no text is shown.
 */
import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { events } from '../core/events';
import { input, type Action } from '../core/input';
import { log } from '../core/log';
import { sfxVolume } from '../core/options';
import { rng } from '../core/rng';
import { getGameData } from '../data/game-data';
import { canSkipTrip, tripOver, type CarDestination } from '../logic/car';
import { WARP_FADE_MS } from '../logic/constants';

/** Scene key of {@link CarScene}. */
export const CAR_SCENE = 'Car';

/** What the overworld passes in: where the car is going. */
export interface CarSceneData {
  to: CarDestination;
}

/** The trip as the E2E hooks see it. */
export interface CarTripView {
  to: CarDestination;
  elapsedMs: number;
  /** True once a button would skip the rest. */
  skippable: boolean;
  /** True from the moment the trip ends (played out or skipped) until the scene stops. */
  finished: boolean;
  skipped: boolean;
  /** True if the car sprite faces left (the trip back to Valencia). */
  flipped: boolean;
}

/** The last trip that ended (played out or skipped), kept after the scene stops; for the E2E hooks. */
let lastTrip: CarTripView | null = null;

/** The last Audi trip that ended this page load, or `null` (read by the `lastCarTrip()` E2E hook). */
export function lastCarTrip(): CarTripView | null {
  return lastTrip;
}

/** Scroll speeds of the layers (base pixels per second); the road moves fastest. */
const SPEED = { far: 40, mid: 260, road: 900, lines: 1400 } as const;
/** Horizon and road positions (base pixels). */
const HORIZON_Y = 140;
const ROAD_Y = 196;
const ROAD_H = 64;
/** The camera shakes every this many ms (a little "dangerous speed"). */
const SHAKE_EVERY_MS = 900;
const SPEED_LINES = 9;
/** Buttons that skip the trip. */
const SKIP_ACTIONS: readonly Action[] = ['a', 'b', 'start', 'map', 'up', 'down', 'left', 'right'];

/** The Audi trip. */
export class CarScene extends Phaser.Scene {
  private to: CarDestination = 'murcia';
  private elapsed = 0;
  private finished = false;
  private skipped = false;
  private shakeIn = 0;
  private layers: { sprite: Phaser.GameObjects.TileSprite; speed: number }[] = [];
  private lines: Phaser.GameObjects.Rectangle[] = [];
  private car: Phaser.GameObjects.Image | null = null;
  private carBaseY = 0;
  private engine: Phaser.Sound.BaseSound | null = null;

  constructor() {
    super(CAR_SCENE);
  }

  init(data: CarSceneData): void {
    this.to = data.to;
    this.elapsed = 0;
    this.finished = false;
    this.skipped = false;
    this.shakeIn = SHAKE_EVERY_MS;
    this.layers = [];
    this.lines = [];
    this.car = null;
    this.engine = null;
  }

  create(): void {
    const car = getGameData().car;
    this.makeTextures();
    // Sky in bands, then the parallax layers from far to near.
    const sky = [0x5c98e8, 0x78acf0, 0x94c0f4, 0xb0d4f8];
    const band = HORIZON_Y / sky.length;
    sky.forEach((c, i) => this.add.rectangle(0, i * band, GAME_WIDTH, band + 1, c).setOrigin(0));
    this.add.rectangle(0, HORIZON_Y, GAME_WIDTH, GAME_HEIGHT - HORIZON_Y, 0xd8c088).setOrigin(0);
    const layer = (key: string, y: number, h: number, speed: number) =>
      this.layers.push({ sprite: this.add.tileSprite(0, y, GAME_WIDTH, h, key).setOrigin(0), speed });
    layer('car-far', HORIZON_Y - 60, 60, SPEED.far);
    layer('car-mid', ROAD_Y - 36, 36, SPEED.mid);
    layer('car-road', ROAD_Y, ROAD_H, SPEED.road);
    for (let i = 0; i < SPEED_LINES; i += 1) {
      const line = this.add.rectangle(0, 0, rng.int(30, 80), 2, 0xffffff, 0.8).setOrigin(0);
      this.placeLine(line, true);
      this.lines.push(line);
    }

    const flipped = this.to === 'valencia';
    this.carBaseY = ROAD_Y + 26;
    this.car = this.add
      .image(GAME_WIDTH / 2, this.carBaseY, car.sprite)
      .setOrigin(0.5, 1)
      .setFlipX(flipped);

    if (this.cache.audio.exists(car.sound)) {
      this.engine = this.sound.add(car.sound, { loop: true, volume: sfxVolume() });
      this.engine.play();
    }
    const cam = this.cameras.main;
    cam.fadeIn(WARP_FADE_MS, 0, 0, 0);
    cam.shake(300, 0.006);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.engine?.stop());
    log(`Car: driving to ${this.to}`);
  }

  override update(_time: number, delta: number): void {
    if (this.finished) return;
    const dt = Math.min(delta, 100);
    this.elapsed += dt;
    // Scenery moves against the direction of travel.
    const dir = this.to === 'murcia' ? 1 : -1;
    for (const l of this.layers) l.sprite.tilePositionX += (dir * l.speed * dt) / 1000;
    for (const line of this.lines) {
      line.x -= (dir * SPEED.lines * dt) / 1000;
      if (line.x + line.width < 0 || line.x > GAME_WIDTH) this.placeLine(line, false);
    }
    if (this.car) this.car.y = this.carBaseY + Math.round(Math.sin(this.elapsed / 60));
    this.shakeIn -= dt;
    if (this.shakeIn <= 0) {
      this.shakeIn = SHAKE_EVERY_MS;
      this.cameras.main.shake(160, 0.004);
    }

    const skip = canSkipTrip(this.elapsed) && SKIP_ACTIONS.some((a) => input.justPressed(a));
    if (skip || tripOver(this.elapsed)) this.finish(skip);
  }

  /** The trip as plain data (for the E2E hooks). */
  view(): CarTripView {
    return {
      to: this.to,
      elapsedMs: Math.round(this.elapsed),
      skippable: canSkipTrip(this.elapsed),
      finished: this.finished,
      skipped: this.skipped,
      flipped: this.car?.flipX ?? false,
    };
  }

  /** End the trip once: fade out, stop the engine, announce `car:ended`, stop this scene. */
  private finish(skipped: boolean): void {
    this.finished = true;
    this.skipped = skipped;
    lastTrip = this.view();
    log(`Car: arrived (${skipped ? 'skipped' : 'played out'} after ${Math.round(this.elapsed)} ms)`);
    const cam = this.cameras.main;
    cam.fadeOut(WARP_FADE_MS, 0, 0, 0);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.engine?.stop();
      events.emit('car:ended', { to: this.to });
      this.scene.stop();
    });
  }

  /** Put a speed line at a random height, entering from the side the scenery comes from. */
  private placeLine(line: Phaser.GameObjects.Rectangle, anywhere: boolean): void {
    const fromRight = this.to === 'murcia';
    line.y = rng.int(20, GAME_HEIGHT - 20);
    if (anywhere) line.x = rng.int(0, GAME_WIDTH);
    else line.x = fromRight ? GAME_WIDTH + rng.int(0, 200) : -line.width - rng.int(0, 200);
  }

  /** Draw the repeating scenery textures once (mountains, bushes, road). */
  private makeTextures(): void {
    const make = (key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void) => {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      draw(g);
      g.generateTexture(key, w, h);
      g.destroy();
    };
    make('car-far', 256, 60, (g) => {
      g.fillStyle(0x8a7a9a);
      g.fillTriangle(0, 60, 60, 8, 120, 60);
      g.fillTriangle(90, 60, 170, 0, 250, 60);
      g.fillStyle(0x9c8cac);
      g.fillTriangle(200, 60, 236, 24, 272, 60);
      g.fillTriangle(-56, 60, -20, 24, 16, 60);
    });
    make('car-mid', 128, 36, (g) => {
      g.fillStyle(0x4c8c3c);
      g.fillCircle(16, 26, 14);
      g.fillCircle(34, 22, 16);
      g.fillCircle(90, 28, 12);
      g.fillStyle(0x6a4a2a);
      g.fillRect(70, 14, 4, 22);
      g.fillStyle(0x3c7c34);
      g.fillCircle(72, 12, 12);
    });
    make('car-road', 64, ROAD_H, (g) => {
      g.fillStyle(0x50505a);
      g.fillRect(0, 0, 64, ROAD_H);
      g.fillStyle(0xe8e8e8);
      g.fillRect(0, 2, 64, 2);
      g.fillRect(0, ROAD_H - 4, 64, 2);
      g.fillStyle(0xf0d040);
      g.fillRect(8, ROAD_H / 2 - 2, 28, 4);
    });
  }
}
