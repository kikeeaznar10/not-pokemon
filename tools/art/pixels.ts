/**
 * Tiny pixel-art painter shared by the art tools (`make-world.ts`, `make-art.ts`, `make-test-map.ts`).
 *
 * Art is drawn at **design resolution** (16 × 16 per tile, 16 × 16 per character frame, 32 × 32 per flexymon) and
 * scaled ×2 when written, so one design pixel is 2 × 2 game pixels: the chunky handheld look described in
 * `docs/ART.md`. Every colour is a solid RGBA; there is no anti-aliasing.
 */
import { PNG } from 'pngjs';

/** An RGBA colour (0–255 each). Alpha 0 = transparent. */
export type Rgba = readonly [number, number, number, number];

/** Parse `#rrggbb` into an opaque colour. */
export function hex(h: string): Rgba {
  const n = Number.parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

/** Fully transparent. */
export const CLEAR: Rgba = [0, 0, 0, 0];

/** Small deterministic hash (for texture noise that is the same on every run). */
export function hash(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A mutable RGBA pixel grid. */
export class Pix {
  readonly data: Uint8ClampedArray;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  /** Copy of this grid. */
  clone(): Pix {
    const p = new Pix(this.w, this.h);
    p.data.set(this.data);
    return p;
  }

  /** Colour at (x, y); transparent outside. */
  get(x: number, y: number): Rgba {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return CLEAR;
    const k = (y * this.w + x) * 4;
    return [this.data[k]!, this.data[k + 1]!, this.data[k + 2]!, this.data[k + 3]!];
  }

  /** True if (x, y) is inside and not transparent. */
  solid(x: number, y: number): boolean {
    return this.get(x, y)[3] > 0;
  }

  /** Set one pixel (ignored outside). */
  set(x: number, y: number, c: Rgba): this {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    const k = (y * this.w + x) * 4;
    this.data[k] = c[0];
    this.data[k + 1] = c[1];
    this.data[k + 2] = c[2];
    this.data[k + 3] = c[3];
    return this;
  }

  /** Fill a rectangle. */
  rect(x: number, y: number, w: number, h: number, c: Rgba): this {
    for (let j = y; j < y + h; j += 1) for (let i = x; i < x + w; i += 1) this.set(i, j, c);
    return this;
  }

  /** Fill an axis-aligned ellipse inside the box (x, y, w, h). */
  ellipse(x: number, y: number, w: number, h: number, c: Rgba): this {
    const cx = x + w / 2;
    const cy = y + h / 2;
    for (let j = y; j < y + h; j += 1)
      for (let i = x; i < x + w; i += 1) {
        const dx = (i + 0.5 - cx) / (w / 2);
        const dy = (j + 0.5 - cy) / (h / 2);
        if (dx * dx + dy * dy <= 1.0) this.set(i, j, c);
      }
    return this;
  }

  /** Fill a rectangle with its corners cut by `r` pixels (a pixel-art rounded box). */
  round(x: number, y: number, w: number, h: number, r: number, c: Rgba): this {
    for (let j = 0; j < h; j += 1)
      for (let i = 0; i < w; i += 1) {
        const ex = Math.min(i, w - 1 - i);
        const ey = Math.min(j, h - 1 - j);
        if (ex + ey < r) continue;
        this.set(x + i, y + j, c);
      }
    return this;
  }

  /**
   * Draw ASCII art at (x, y): one string per row, one character per pixel; `pal` maps characters to colours and
   * any character not in it (e.g. `.` or space) is left untouched.
   */
  ascii(x: number, y: number, rows: readonly string[], pal: Readonly<Record<string, Rgba>>): this {
    rows.forEach((row, j) =>
      [...row].forEach((ch, i) => {
        const c = pal[ch];
        if (c) this.set(x + i, y + j, c);
      }),
    );
    return this;
  }

  /** Draw `src` over this grid at (x, y) (alpha 0 pixels of `src` are skipped). */
  blit(src: Pix, x = 0, y = 0): this {
    for (let j = 0; j < src.h; j += 1)
      for (let i = 0; i < src.w; i += 1) {
        const c = src.get(i, j);
        if (c[3] > 0) this.set(x + i, y + j, c);
      }
    return this;
  }

  /** Copy of the region (x, y, w, h). */
  crop(x: number, y: number, w: number, h: number): Pix {
    const p = new Pix(w, h);
    for (let j = 0; j < h; j += 1) for (let i = 0; i < w; i += 1) p.set(i, j, this.get(x + i, y + j));
    return p;
  }

  /** Mirrored copy (left ↔ right). */
  flipX(): Pix {
    const p = new Pix(this.w, this.h);
    for (let j = 0; j < this.h; j += 1)
      for (let i = 0; i < this.w; i += 1) p.set(this.w - 1 - i, j, this.get(i, j));
    return p;
  }

  /** Replace every pixel of colour `from` with `to`. */
  recolor(from: Rgba, to: Rgba): this {
    for (let j = 0; j < this.h; j += 1)
      for (let i = 0; i < this.w; i += 1) {
        const c = this.get(i, j);
        if (c[0] === from[0] && c[1] === from[1] && c[2] === from[2] && c[3] === from[3]) this.set(i, j, to);
      }
    return this;
  }

  /**
   * Add a 1-pixel outline of colour `c` around every non-transparent shape (on the transparent pixels that touch
   * it horizontally or vertically). This is what gives sprites the dark contour of the reference style.
   */
  outline(c: Rgba): this {
    const src = this.clone();
    for (let j = 0; j < this.h; j += 1)
      for (let i = 0; i < this.w; i += 1) {
        if (src.solid(i, j)) continue;
        if (src.solid(i - 1, j) || src.solid(i + 1, j) || src.solid(i, j - 1) || src.solid(i, j + 1))
          this.set(i, j, c);
      }
    return this;
  }

  /** Nearest-neighbour upscale by an integer factor. */
  scale(n: number): Pix {
    const p = new Pix(this.w * n, this.h * n);
    for (let j = 0; j < p.h; j += 1)
      for (let i = 0; i < p.w; i += 1) p.set(i, j, this.get(Math.floor(i / n), Math.floor(j / n)));
    return p;
  }

  /** Nearest-neighbour downscale by an integer factor (keeps the top-left pixel of each block that is opaque). */
  shrink(n: number): Pix {
    const p = new Pix(Math.floor(this.w / n), Math.floor(this.h / n));
    for (let j = 0; j < p.h; j += 1)
      for (let i = 0; i < p.w; i += 1) {
        let pick: Rgba = CLEAR;
        for (let b = 0; b < n && pick[3] === 0; b += 1)
          for (let a = 0; a < n && pick[3] === 0; a += 1) pick = this.get(i * n + a, j * n + b);
        p.set(i, j, pick);
      }
    return p;
  }

  /** Encode as PNG. */
  png(): Buffer {
    const png = new PNG({ width: this.w, height: this.h });
    png.data.set(this.data);
    return PNG.sync.write(png);
  }
}

/** Mix two colours (`t` = 0 → a, 1 → b). */
export function mix(a: Rgba, b: Rgba, t: number): Rgba {
  const m = (i: number) => Math.round(a[i]! + (b[i]! - a[i]!) * t);
  return [m(0), m(1), m(2), 255];
}

/** A lighter (t > 0) or darker (t < 0) shade of `c`. */
export function shade(c: Rgba, t: number): Rgba {
  return t >= 0 ? mix(c, [255, 255, 255, 255], t) : mix(c, [16, 16, 32, 255], -t);
}
