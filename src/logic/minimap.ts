/**
 * Minimap rules (docs/PLAN.md › M12), with no Phaser so they are unit-tested.
 *
 * - Each outdoor zone has a pre-drawn image at {@link minimapPath} (`assets/ui/minimap_<zone>.png`). The
 *   placeholder tool draws it from the map's collision data with {@link minimapCells}: one square of
 *   `MINIMAP_TILE_PX` pixels per tile. Real art can replace the file at any size: the dot is placed by the
 *   map's size in tiles, not by the image's pixels.
 * - On screen the image keeps its size, or is scaled down (never up) to fit `MINIMAP_MAX_W × MINIMAP_MAX_H`
 *   ({@link minimapLayout}).
 * - The player's dot sits at the centre of the player's tile, scaled the same way ({@link minimapDot}).
 * - Indoor zones (`zones.json › indoor: true`) have no minimap.
 */
import type { MapInfo } from '../data/tiled';

/** Path of a zone's minimap image (relative to `public/`). */
export function minimapPath(zoneId: string): string {
  return `assets/ui/minimap_${zoneId}.png`;
}

/** Where the minimap image is drawn, in base pixels. */
export interface MinimapLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Display scale of the image (1 = image pixels; below 1 = shrunk to fit). */
  scale: number;
}

/**
 * Lay out an `imageW × imageH` minimap at (`x`, `y`): unchanged if it fits in `maxW × maxH`, otherwise
 * scaled down uniformly until it does.
 */
export function minimapLayout(
  imageW: number,
  imageH: number,
  maxW: number,
  maxH: number,
  x = 0,
  y = 0,
): MinimapLayout {
  const scale = Math.min(1, maxW / imageW, maxH / imageH);
  return { x, y, width: imageW * scale, height: imageH * scale, scale };
}

/**
 * Screen position (base pixels) of the dot for tile (`tileX`, `tileY`) on a `mapW × mapH` map drawn with
 * `layout`: the centre of that tile's part of the image.
 */
export function minimapDot(
  layout: MinimapLayout,
  mapW: number,
  mapH: number,
  tileX: number,
  tileY: number,
): { x: number; y: number } {
  return {
    x: layout.x + ((tileX + 0.5) * layout.width) / mapW,
    y: layout.y + ((tileY + 0.5) * layout.height) / mapH,
  };
}

/** What one minimap cell shows. */
export type MinimapCell = 'solid' | 'encounter' | 'open';

/**
 * The cells of a map for its minimap, row-major like `MapInfo.solid`: `solid` (walls, water…), `encounter`
 * (walkable tiles with `encounter = true`: grass, sand, vineyards) or `open`.
 */
export function minimapCells(info: Pick<MapInfo, 'width' | 'height' | 'solid' | 'encounter'>): MinimapCell[] {
  const cells: MinimapCell[] = [];
  for (let i = 0; i < info.width * info.height; i++) {
    cells.push(info.solid[i] ? 'solid' : info.encounter[i] ? 'encounter' : 'open');
  }
  return cells;
}
