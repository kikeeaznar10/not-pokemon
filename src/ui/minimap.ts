/**
 * Minimap — the current zone's pre-drawn map image (`assets/ui/minimap_<zone>.png`) in the top-left corner
 * of the screen, with a blinking dot on the player's tile. Owned by the OverworldScene, which calls
 * {@link Minimap.update} every frame with the player's tile.
 *
 * - Shown only when {@link minimapPrefs}`.shown` is on (M or the touch *Mapa* button toggles it; the Start
 *   menu's *Mapa* too), the zone is outdoors and its image loaded. Indoors it is always hidden.
 * - Size and dot position follow `src/logic/minimap.ts`: the image is drawn at its own size or scaled down to
 *   fit `MINIMAP_MAX_W × MINIMAP_MAX_H`; the dot sits at the centre of the player's tile.
 * - The dot blinks every `MINIMAP_BLINK_MS`. Fixed to the camera (scroll factor 0), drawn under the dialogue
 *   and choice boxes.
 */
import Phaser from 'phaser';
import { log } from '../core/log';
import type { Zone } from '../data/schemas';
import type { MapInfo } from '../data/tiled';
import { MINIMAP_BLINK_MS, MINIMAP_MARGIN, MINIMAP_MAX_H, MINIMAP_MAX_W } from '../logic/constants';
import { minimapDot, minimapLayout, minimapPath, type MinimapLayout } from '../logic/minimap';

/**
 * Whether the player wants the minimap (toggled with M / *Mapa*). Shared by every OverworldScene restart, so
 * it survives warps; not saved (a new page starts with it on).
 */
export const minimapPrefs = { shown: true };

/** Live minimaps, told at once when the choice changes (the overworld is paused under the Start menu). */
const live = new Set<Minimap>();

/** Flip {@link minimapPrefs}`.shown`, show or hide every live minimap at once, and return the new value. */
export function toggleMinimap(): boolean {
  minimapPrefs.shown = !minimapPrefs.shown;
  for (const m of live) m.applyShown();
  return minimapPrefs.shown;
}

/** The minimap as data (for the E2E hooks). Positions in base pixels. */
export interface MinimapView {
  zone: string;
  /** The player's choice ({@link minimapPrefs}). */
  shown: boolean;
  /** True while it is actually drawn (shown, outdoors, image loaded). */
  visible: boolean;
  /** True if this zone has a minimap at all (outdoors with its image loaded). */
  available: boolean;
  /** Where the image is drawn, or `null` without one. */
  frame: MinimapLayout | null;
  /** The map size in tiles. */
  mapSize: { width: number; height: number };
  /** The tile the dot marks. */
  tile: { x: number; y: number };
  /** The dot's centre, or `null` without a minimap. */
  dot: { x: number; y: number } | null;
  /** True while the dot is in the "on" half of its blink. */
  dotOn: boolean;
}

/** Depth of the minimap: over the map and its `above` layer, under the dialogue box (100). */
const DEPTH = 50;
/** Dot size in base pixels (odd so it has a centre pixel). */
const DOT = 5;
const COLOR_FRAME = 0x202028;
const COLOR_DOT = 0xe83828;
const COLOR_DOT_EDGE = 0xffffff;

/** The minimap of one zone. */
export class Minimap {
  private readonly root: Phaser.GameObjects.Container | null;
  private readonly dot: Phaser.GameObjects.Rectangle | null;
  private readonly layout: MinimapLayout | null;
  private tile = { x: 0, y: 0 };
  private blinkMs = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly zone: Zone,
    private readonly info: Pick<MapInfo, 'width' | 'height'>,
  ) {
    const key = minimapPath(zone.id);
    if (zone.indoor || !scene.textures.exists(key)) {
      if (!zone.indoor) log(`Minimap: no image "${key}" for zone ${zone.id}`);
      this.root = null;
      this.dot = null;
      this.layout = null;
      return;
    }
    const frame = scene.textures.getFrame(key);
    this.layout = minimapLayout(
      frame.width,
      frame.height,
      MINIMAP_MAX_W,
      MINIMAP_MAX_H,
      MINIMAP_MARGIN,
      MINIMAP_MARGIN,
    );
    const l = this.layout;
    const border = scene.add.rectangle(l.x - 1, l.y - 1, l.width + 2, l.height + 2, COLOR_FRAME).setOrigin(0);
    const image = scene.add.image(l.x, l.y, key).setOrigin(0).setDisplaySize(l.width, l.height);
    this.dot = scene.add
      .rectangle(0, 0, DOT, DOT, COLOR_DOT)
      .setStrokeStyle(1, COLOR_DOT_EDGE)
      .setOrigin(0.5);
    this.root = scene.add.container(0, 0, [border, image, this.dot]).setScrollFactor(0).setDepth(DEPTH);
    this.root.setVisible(minimapPrefs.shown);
    live.add(this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => live.delete(this));
  }

  /** Show or hide according to {@link minimapPrefs} (called on every toggle, even while the scene is paused). */
  applyShown(): void {
    this.root?.setVisible(minimapPrefs.shown);
  }

  /** Follow the player's tile and blink the dot; `dt` in ms. */
  update(dt: number, tileX: number, tileY: number): void {
    this.tile = { x: tileX, y: tileY };
    if (!this.root || !this.dot || !this.layout) return;
    this.blinkMs = (this.blinkMs + dt) % (2 * MINIMAP_BLINK_MS);
    const p = minimapDot(this.layout, this.info.width, this.info.height, tileX, tileY);
    this.dot.setPosition(Math.round(p.x), Math.round(p.y));
    this.dot.setVisible(this.blinkMs < MINIMAP_BLINK_MS);
  }

  /** The minimap as data (for the E2E hooks). */
  view(): MinimapView {
    const l = this.layout;
    return {
      zone: this.zone.id,
      shown: minimapPrefs.shown,
      visible: this.root?.visible ?? false,
      available: l !== null,
      frame: l ? { ...l } : null,
      mapSize: { width: this.info.width, height: this.info.height },
      tile: { ...this.tile },
      dot: l && this.dot ? { x: this.dot.x, y: this.dot.y } : null,
      dotOn: this.dot?.visible ?? false,
    };
  }
}
