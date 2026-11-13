/**
 * Flexymon battle art: every species is a cute office object drawn at 32 × 32 design pixels (no outline), then
 * outlined and scaled ×2 into the 64 × 64 `*_front.png` / `*_back.png`, and shrunk to the 16 × 16 `*_icon.png`.
 * The front has a face; the back shows the object from behind. Unknown species ids get a generic blob creature
 * coloured from the id, so new content still gets styled art (see `tools/README.md › npm run art`).
 */
import { hex, mix, Pix, shade, type Rgba } from './pixels';

const EYE = hex('#202028');
const WHITE = hex('#ffffff');
const BLUSH = hex('#f898a8');
const MOUTH = hex('#802838');

/** Big cute eye (2 × 3) with a highlight. */
function eye(p: Pix, x: number, y: number): void {
  p.rect(x, y, 2, 3, EYE).set(x, y, WHITE);
}

/** A face: two eyes `gap` apart from (x, y), a small smile below, blush under the eyes. */
function face(p: Pix, x: number, y: number, gap = 7, blush = true): void {
  eye(p, x, y);
  eye(p, x + gap, y);
  const mx = x + Math.floor(gap / 2) - 1;
  p.set(mx, y + 4, MOUTH)
    .set(mx + 1, y + 5, MOUTH)
    .set(mx + 2, y + 5, MOUTH)
    .set(mx + 3, y + 4, MOUTH);
  if (blush)
    p.set(x - 2, y + 3, BLUSH)
      .set(x - 1, y + 3, BLUSH)
      .set(x + gap + 2, y + 3, BLUSH)
      .set(x + gap + 3, y + 3, BLUSH);
}

/** Two stubby feet. */
function feet(p: Pix, x1: number, x2: number, y: number, c: Rgba): void {
  p.rect(x1, y, 4, 2, c).rect(x2, y, 4, 2, c);
}

/** A rounded box with a light top-left edge and a dark bottom-right edge. */
function box(p: Pix, x: number, y: number, w: number, h: number, c: Rgba, r = 1): void {
  p.round(x, y, w, h, r, shade(c, -0.25));
  p.round(x, y, w - 1, h - 1, r, c);
  p.rect(x + r, y, w - 2 * r - 1, 1, shade(c, 0.35));
  p.rect(x, y + r, 1, h - 2 * r - 1, shade(c, 0.2));
}

type Draw = (p: Pix, front: boolean) => void;

const SPECIES: Record<string, { outline: Rgba; draw: Draw }> = {
  portatil: {
    outline: hex('#283040'),
    draw: (p, front) => {
      const grey = hex('#b4bccc');
      box(p, 6, 2, 20, 16, grey, 2);
      if (front) {
        p.rect(8, 4, 16, 12, hex('#3c78c8'));
        p.rect(8, 4, 16, 6, hex('#58a8e8'));
        p.set(9, 5, hex('#c0e8ff')).set(10, 5, hex('#c0e8ff')).set(9, 6, hex('#c0e8ff'));
        face(p, 12, 8, 7, false);
      } else {
        p.ellipse(13, 7, 6, 6, hex('#f08830'));
        p.ellipse(14, 8, 4, 4, hex('#f8b060'));
      }
      p.rect(5, 18, 22, 1, hex('#606878'));
      box(p, 4, 19, 24, 6, hex('#d0d8e0'));
      if (front)
        for (let x = 6; x < 26; x += 3)
          p.rect(x, 21, 2, 1, hex('#8890a0')).rect(x + 1, 23, 2, 1, hex('#8890a0'));
      feet(p, 7, 21, 25, hex('#505868'));
    },
  },
  raton: {
    outline: hex('#384050'),
    draw: (p, front) => {
      // Cable tail curling up.
      for (const [x, y] of [
        [16, 7],
        [16, 6],
        [17, 5],
        [18, 4],
        [19, 4],
        [20, 4],
        [21, 5],
        [22, 6],
        [22, 7],
        [23, 8],
      ] as const)
        p.set(x, y, hex('#606878'));
      p.ellipse(5, 8, 22, 21, hex('#b8c0d0'));
      p.ellipse(5, 8, 20, 19, hex('#e4e8f0'));
      p.ellipse(8, 10, 6, 5, WHITE);
      if (front) {
        p.rect(16, 8, 1, 8, hex('#a0a8b8'));
        p.rect(8, 15, 17, 1, hex('#a0a8b8'));
        p.rect(15, 10, 3, 4, hex('#505868'));
        face(p, 11, 18, 8);
      } else {
        p.rect(14, 24, 5, 2, hex('#c8ccd8'));
      }
      feet(p, 9, 19, 28, hex('#9098a8'));
    },
  },
  teclado: {
    outline: hex('#202430'),
    draw: (p, front) => {
      const body = hex('#4c5464');
      box(p, 1, 11, 30, 14, body, 2);
      if (front) {
        const key = hex('#dce0ea');
        for (let row = 0; row < 3; row += 1)
          for (let x = 3 + (row % 2); x < 28; x += 3)
            p.rect(x, 13 + row * 3, 2, 2, key).set(x, 14 + row * 3, hex('#a8b0c0'));
        // Two keys are eyes, the space bar is a smile.
        p.rect(8, 12, 5, 6, WHITE).rect(19, 12, 5, 6, WHITE);
        p.rect(10, 14, 2, 3, EYE).rect(21, 14, 2, 3, EYE).set(10, 14, WHITE).set(21, 14, WHITE);
        p.rect(10, 22, 12, 2, hex('#c84860')).rect(11, 22, 10, 1, hex('#f07888'));
        p.set(5, 18, BLUSH).set(6, 18, BLUSH).set(26, 18, BLUSH).set(25, 18, BLUSH);
      } else {
        p.rect(4, 14, 24, 8, hex('#3c4250'));
        p.rect(6, 16, 4, 2, hex('#2c303c')).rect(22, 16, 4, 2, hex('#2c303c'));
      }
      feet(p, 4, 24, 25, hex('#30343e'));
      feet(p, 11, 17, 25, hex('#30343e'));
    },
  },
  cafetera: {
    outline: hex('#30303a'),
    draw: (p, front) => {
      const steel = hex('#c4c8d4');
      // Steam.
      if (front) p.ellipse(5, 0, 5, 4, hex('#f0f4f8')).ellipse(8, 1, 4, 3, WHITE);
      p.rect(14, 1, 4, 2, hex('#303038'));
      // Upper chamber (narrows to the waist), spout on the left.
      for (let y = 3; y < 14; y += 1) {
        const half = 6 + Math.floor((y - 3) / 4);
        p.rect(16 - half, y, half * 2, 1, steel);
      }
      p.rect(6, 4, 5, 3, steel).rect(5, 4, 2, 1, steel);
      p.rect(9, 14, 14, 2, hex('#888c98'));
      // Lower chamber.
      for (let y = 16; y < 28; y += 1) {
        const half = y < 18 ? 8 + (y - 16) : y > 25 ? 10 - (y - 25) : 10;
        p.rect(16 - half, y, half * 2, 1, steel);
      }
      // Facets.
      for (const x of [11, 21])
        p.rect(x, 4, 1, 10, shade(steel, -0.2)).rect(x, 17, 1, 10, shade(steel, -0.2));
      p.rect(13, 4, 1, 10, shade(steel, 0.5)).rect(13, 17, 1, 10, shade(steel, 0.5));
      // Handle.
      p.rect(24, 5, 4, 2, hex('#303038'))
        .rect(26, 5, 2, 9, hex('#303038'))
        .rect(23, 12, 4, 2, hex('#303038'));
      if (front) face(p, 12, 19, 7);
      feet(p, 9, 19, 28, hex('#707480'));
    },
  },
  grapadora: {
    outline: hex('#401820'),
    draw: (p, front) => {
      const red = hex('#e04848');
      box(p, 2, 22, 28, 5, hex('#40404c'));
      // Top arm, open like a mouth at the front (left).
      box(p, 3, 11, 26, 9, red, 3);
      p.rect(26, 18, 4, 5, hex('#40404c'));
      p.rect(3, 19, 9, 3, hex('#802030'));
      for (let x = 4; x < 11; x += 2) p.set(x, 19, WHITE).set(x + 1, 21, hex('#d8dce4'));
      p.rect(8, 12, 18, 2, shade(red, 0.35));
      if (front) {
        eye(p, 9, 14);
        eye(p, 15, 14);
        p.set(7, 17, BLUSH).set(18, 17, BLUSH);
      } else p.rect(14, 14, 10, 2, shade(red, -0.25));
      feet(p, 5, 22, 27, hex('#2c2c34'));
    },
  },
  impresora: {
    outline: hex('#38342c'),
    draw: (p, front) => {
      // Paper in the tray.
      p.rect(9, 2, 14, 10, WHITE);
      for (let y = 4; y < 11; y += 2) p.rect(11, y, 9, 1, hex('#c8d0e0'));
      box(p, 3, 10, 26, 16, hex('#e8e2d0'), 2);
      p.rect(4, 11, 24, 2, hex('#cfc8b2'));
      if (front) {
        p.rect(6, 20, 20, 2, hex('#38342c'));
        // Paper tongue.
        p.rect(10, 21, 12, 6, WHITE).rect(11, 26, 10, 1, WHITE);
        p.rect(12, 23, 8, 1, hex('#f07888'));
        face(p, 10, 14, 10, true);
        p.set(25, 13, hex('#48c858')).set(25, 15, hex('#f0a030'));
      } else {
        p.rect(7, 15, 18, 6, hex('#d4cdb8'));
        p.rect(9, 17, 3, 2, hex('#38342c'));
      }
      feet(p, 6, 22, 26, hex('#88806c'));
    },
  },
  monitor: {
    outline: hex('#181820'),
    draw: (p, front) => {
      box(p, 3, 2, 26, 19, hex('#383844'), 2);
      if (front) {
        p.rect(5, 4, 22, 14, hex('#38a888'));
        p.rect(5, 4, 22, 7, hex('#60d0a8'));
        p.set(6, 5, hex('#c8fff0')).set(7, 5, hex('#c8fff0')).set(6, 6, hex('#c8fff0'));
        face(p, 11, 8, 8, true);
        p.set(15, 19, hex('#48c858'));
      } else {
        p.ellipse(9, 6, 14, 10, hex('#2c2c36'));
        for (let x = 11; x < 21; x += 2) p.rect(x, 8, 1, 5, hex('#48485a'));
      }
      p.rect(14, 21, 4, 4, hex('#888c9c'));
      box(p, 8, 25, 16, 4, hex('#a0a4b4'));
    },
  },
  movil: {
    outline: hex('#141822'),
    draw: (p, front) => {
      box(p, 9, 2, 14, 27, hex('#303848'), 3);
      p.rect(6, 15, 3, 2, hex('#303848')).rect(23, 15, 3, 2, hex('#303848'));
      if (front) {
        p.rect(11, 5, 10, 20, hex('#88c8f8'));
        p.rect(11, 5, 10, 3, hex('#f0a8c8'));
        p.rect(14, 3, 4, 1, hex('#606878'));
        face(p, 12, 11, 6, false);
        p.set(20, 5, hex('#e83848'));
        p.rect(15, 26, 2, 1, hex('#808898'));
      } else {
        p.rect(12, 4, 4, 5, hex('#202630')).ellipse(13, 5, 2, 2, hex('#5878a8'));
        p.ellipse(13, 15, 6, 6, hex('#3c4658'));
      }
      feet(p, 9, 19, 29, hex('#202630'));
    },
  },
  proyector: {
    outline: hex('#30303c'),
    draw: (p, front) => {
      box(p, 3, 11, 26, 14, hex('#e8e8f0'), 2);
      for (let x = 18; x < 27; x += 2) p.rect(x, 12, 1, 3, hex('#b8b8c8'));
      if (front) {
        p.ellipse(4, 12, 12, 12, hex('#404050'));
        p.ellipse(5, 13, 10, 10, hex('#5878c0'));
        p.ellipse(7, 15, 6, 6, hex('#88b8f0'));
        p.set(7, 15, WHITE).set(8, 15, WHITE).set(7, 16, WHITE);
        eye(p, 19, 17);
        eye(p, 24, 17);
        p.set(21, 21, MOUTH).set(22, 22, MOUTH).set(23, 22, MOUTH).set(24, 21, MOUTH);
      } else {
        p.rect(6, 15, 20, 7, hex('#d0d0dc'));
        p.ellipse(8, 16, 5, 5, hex('#404050'));
      }
      feet(p, 6, 22, 25, hex('#808090'));
    },
  },
  router: {
    outline: hex('#181822'),
    draw: (p, front) => {
      const ant = hex('#404050');
      p.rect(7, 4, 2, 13, ant).rect(23, 4, 2, 13, ant).rect(15, 7, 2, 10, ant);
      p.ellipse(6, 1, 4, 4, hex('#58d878'))
        .ellipse(22, 1, 4, 4, hex('#58d878'))
        .ellipse(14, 4, 4, 4, hex('#f0c040'));
      box(p, 3, 16, 26, 10, hex('#3c3c50'), 2);
      p.rect(4, 17, 24, 2, hex('#5c5c74'));
      if (front) {
        face(p, 11, 19, 8, true);
        for (let x = 6; x < 27; x += 3) p.set(x, 24, x % 2 ? hex('#58d878') : hex('#f0a030'));
      } else {
        for (let x = 6; x < 26; x += 4) p.rect(x, 21, 2, 2, hex('#202030'));
      }
      feet(p, 6, 22, 26, hex('#202030'));
    },
  },
  servidor: {
    outline: hex('#0c0c14'),
    draw: (p, front) => {
      box(p, 8, 2, 16, 27, hex('#343444'), 1);
      for (let y = 5; y < 27; y += 4) p.rect(9, y, 14, 1, hex('#4a4a60'));
      if (front) {
        p.rect(11, 8, 3, 2, hex('#68f0f0')).rect(18, 8, 3, 2, hex('#68f0f0'));
        p.set(11, 8, WHITE).set(18, 8, WHITE);
        p.rect(14, 12, 4, 1, hex('#68f0f0'));
        for (let y = 15; y < 27; y += 4)
          p.set(11, y, hex('#58d878')).set(13, y, hex('#3888f0')).set(20, y, hex('#f0a030'));
      } else {
        for (let y = 6; y < 26; y += 3) p.rect(11, y, 10, 1, hex('#22222e'));
      }
      feet(p, 9, 19, 29, hex('#1c1c28'));
    },
  },
  silla: {
    outline: hex('#182040'),
    draw: (p, front) => {
      const blue = hex('#4878c8');
      box(p, 8, 2, 16, 14, blue, 3);
      if (front) {
        p.rect(10, 4, 12, 10, shade(blue, 0.15));
        face(p, 12, 6, 6, true);
      } else p.rect(14, 5, 4, 8, shade(blue, -0.2));
      box(p, 5, 16, 22, 5, shade(blue, -0.1), 2);
      p.rect(4, 14, 2, 5, hex('#383848')).rect(26, 14, 2, 5, hex('#383848'));
      p.rect(15, 21, 2, 4, hex('#888898'));
      p.rect(7, 25, 18, 2, hex('#888898'));
      for (const x of [6, 15, 23]) p.rect(x, 27, 3, 2, hex('#202028'));
    },
  },
};

/** Generic creature for species without hand-made art: a round blob coloured from the id. */
function blob(id: string): { outline: Rgba; draw: Draw } {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const c = hex(['#e86868', '#68a8e8', '#68c878', '#e8b848', '#a878d8', '#48c0c0'][h % 6]!);
  return {
    outline: mix(c, [20, 20, 30, 255], 0.75),
    draw: (p, front) => {
      p.ellipse(4, 6, 24, 22, shade(c, -0.25));
      p.ellipse(4, 6, 23, 21, c);
      p.ellipse(8, 9, 8, 6, shade(c, 0.4));
      if (front) face(p, 11, 15, 8);
      feet(p, 8, 20, 27, shade(c, -0.35));
    },
  };
}

function body(id: string, front: boolean): { pix: Pix; outline: Rgba } {
  const s = SPECIES[id] ?? blob(id);
  const pix = new Pix(32, 32);
  s.draw(pix, front);
  return { pix, outline: s.outline };
}

/**
 * Species whose PNGs were drawn outside the code (dropped in `public/assets/sprites/flexymon/`). The generator never
 * overwrites their files, not even with `--force`.
 */
export const SUPPLIED_SPECIES: ReadonlySet<string> = new Set(['ferri']);

/** True if `id` has hand-made art, in {@link SPECIES} or supplied as PNGs (otherwise the generic blob is used). */
export function hasFlexymonArt(id: string): boolean {
  return id in SPECIES || SUPPLIED_SPECIES.has(id);
}

/** The 64 × 64 front or back sprite of a species. */
export function drawFlexymon(id: string, side: 'front' | 'back'): Buffer {
  const { pix, outline } = body(id, side === 'front');
  return pix.outline(outline).scale(2).png();
}

/** The 16 × 16 menu icon of a species (the front shrunk ×2, then outlined). */
export function drawFlexymonIcon(id: string): Buffer {
  const { pix, outline } = body(id, true);
  const small = pix.crop(1, 1, 30, 30).shrink(2);
  const icon = new Pix(16, 16).blit(small, 1, 1);
  return icon.outline(outline).png();
}
