/**
 * Item icons (16 × 16), the side-view car (96 × 40) and the title picture (512 × 288), in the style of
 * `docs/ART.md`. Items are drawn at their real size; the car and the title at half size and scaled ×2.
 * Unknown item ids get a generic parcel coloured from the id.
 */
import { hash, hex, Pix, shade, type Rgba } from './pixels';
import { D, tileArt } from './tiles';

const OUT = hex('#282030');

type ItemDraw = (p: Pix) => void;

const ITEMS: Record<string, ItemDraw> = {
  bocadillo: (p) => {
    p.ellipse(1, 4, 14, 8, hex('#d89048'));
    p.ellipse(2, 4, 12, 4, hex('#f0b868'));
    p.rect(2, 9, 12, 1, hex('#58b048'))
      .set(4, 9, hex('#e04040'))
      .set(8, 9, hex('#e04040'))
      .set(11, 9, hex('#e04040'));
    p.rect(2, 10, 12, 2, hex('#c07838'));
    p.set(5, 5, hex('#a86030')).set(8, 5, hex('#a86030')).set(11, 5, hex('#a86030'));
  },
  cafe: (p) => {
    p.rect(5, 1, 1, 2, hex('#e0e8f0')).rect(8, 0, 1, 3, hex('#e0e8f0'));
    p.rect(3, 5, 8, 7, hex('#f8f8f8')).rect(4, 5, 6, 1, hex('#784020'));
    p.rect(10, 6, 1, 4, shade(hex('#f8f8f8'), -0.2));
    p.rect(11, 6, 2, 1, hex('#e8e8ec')).rect(12, 7, 1, 2, hex('#e8e8ec')).rect(11, 9, 2, 1, hex('#e8e8ec'));
    p.rect(1, 12, 13, 2, hex('#d8dce4'));
  },
  cafe_doble: (p) => {
    for (const x of [1, 8]) {
      p.rect(x, 5, 6, 7, hex('#f8f8f8')).rect(x + 1, 5, 4, 1, hex('#784020'));
      p.rect(x + 5, 6, 1, 5, shade(hex('#f8f8f8'), -0.2));
      p.rect(x + 2, 1, 1, 3, hex('#e0e8f0'));
    }
    p.rect(0, 12, 15, 2, hex('#d8dce4'));
    p.rect(6, 7, 2, 2, hex('#e84848'));
  },
  carnet: (p) => {
    p.rect(1, 3, 14, 10, hex('#e8f0f8'));
    p.rect(1, 3, 14, 2, hex('#4878c8'));
    p.rect(2, 6, 4, 5, hex('#f0c8a0')).rect(2, 6, 4, 2, hex('#784828'));
    for (const y of [7, 9, 11]) p.rect(7, y, 7, 1, hex('#98a4b8'));
  },
  ibuprofeno: (p) => {
    p.rect(2, 2, 12, 12, hex('#c8ccd8'));
    p.rect(3, 3, 10, 1, hex('#e8ecf4'));
    for (let y = 4; y < 13; y += 4) for (let x = 3; x < 13; x += 5) p.ellipse(x, y, 4, 3, hex('#ffffff'));
    p.rect(2, 13, 12, 1, hex('#e84868'));
  },
  lata: (p) => {
    p.rect(4, 2, 8, 12, hex('#e03838'));
    p.rect(4, 1, 8, 2, hex('#c8ccd8')).rect(4, 13, 8, 2, hex('#a8acb8'));
    p.rect(4, 6, 8, 3, hex('#f8f8f8')).rect(5, 7, 6, 1, hex('#f0a020'));
    p.rect(5, 3, 1, 9, hex('#f87878')).rect(11, 3, 1, 10, hex('#a02028'));
  },
  llaves: (p) => {
    p.ellipse(1, 1, 7, 7, hex('#e0b838')).ellipse(3, 3, 3, 3, [0, 0, 0, 0]);
    p.rect(6, 6, 2, 8, hex('#c8ccd8')).rect(8, 10, 2, 1, hex('#c8ccd8')).rect(8, 12, 3, 1, hex('#c8ccd8'));
    p.rect(9, 4, 6, 2, hex('#e8c040')).rect(13, 6, 1, 3, hex('#e8c040')).rect(11, 6, 1, 2, hex('#e8c040'));
    p.rect(5, 5, 4, 2, hex('#30303c')).rect(5, 5, 4, 1, hex('#606070'));
  },
  regleta: (p) => {
    p.rect(1, 6, 14, 6, hex('#f4f4f0'));
    p.rect(1, 11, 14, 1, hex('#c8c8c8'));
    for (const x of [3, 7]) p.ellipse(x, 7, 3, 3, hex('#505058'));
    p.rect(11, 7, 3, 3, hex('#e84040')).set(11, 7, hex('#f89090'));
    p.rect(0, 9, 1, 1, hex('#404048')).rect(0, 10, 1, 4, hex('#404048'));
  },
};

/** True if `id` has hand-made item art. */
export function hasItemArt(id: string): boolean {
  return id in ITEMS;
}

/** The 16 × 16 icon of an item (unknown ids: a parcel coloured from the id). */
export function drawItem(id: string): Buffer {
  const p = new Pix(16, 16);
  const draw = ITEMS[id];
  if (draw) draw(p);
  else {
    const c = hex(
      ['#e8a048', '#68a8e8', '#78c868', '#d878a8'][Math.floor(hash(id.length, id.charCodeAt(0)) * 4)]!,
    );
    p.rect(2, 4, 12, 9, c).rect(2, 4, 12, 2, shade(c, 0.3)).rect(7, 4, 2, 9, shade(c, -0.3));
  }
  // Items fill 1..14, so the outline fits.
  return p.crop(0, 0, 16, 16).outline(OUT).png();
}

/** The white Audi seen from the side, nose to the right (96 × 40, `car.json › sprite`). */
export function drawCar(): Buffer {
  const p = new Pix(48, 20);
  const white = hex('#f8f8f4');
  const glass = hex('#385878');
  p.round(12, 2, 24, 9, 2, white);
  p.round(2, 8, 44, 8, 2, white);
  p.rect(3, 13, 42, 2, hex('#c8ccd8'));
  p.rect(14, 4, 9, 5, glass)
    .rect(25, 4, 9, 5, glass)
    .rect(14, 4, 3, 1, hex('#7898c0'))
    .rect(25, 4, 3, 1, hex('#7898c0'));
  p.rect(24, 9, 1, 5, hex('#c8ccd8')).rect(20, 10, 2, 1, hex('#98a0b0')).rect(31, 10, 2, 1, hex('#98a0b0'));
  p.rect(44, 9, 2, 2, hex('#f8e070')).rect(2, 9, 2, 2, hex('#e04040'));
  for (const x of [7, 33]) {
    p.ellipse(x, 11, 8, 8, hex('#202028'));
    p.ellipse(x + 2, 13, 4, 4, hex('#b8bcc8'));
    p.set(x + 3, 14, hex('#707480'));
  }
  p.outline(hex('#30303c'));
  return p.scale(2).png();
}

/**
 * The title picture: the office (white walls, teal roof) in the middle of a green street, pines on the sides, sky
 * with clouds and hills on top (where the logo text goes), a path at the bottom (where "Pulsa START" goes).
 * 256 × 144 design pixels = 16 × 9 tiles, scaled ×2 to 512 × 288.
 */
export function drawTitle(): Buffer {
  const p = new Pix(16 * D, 9 * D);
  const horizon = 88;
  const sky: Rgba[] = [hex('#78b8f0'), hex('#90c8f4'), hex('#a8d8f8'), hex('#c0e4fa')];
  sky.forEach((c, i) => p.rect(0, (i * horizon) / 4, p.w, horizon / 4 + 1, c));
  // Clouds.
  for (const [x, y, w] of [
    [20, 14, 34],
    [190, 22, 40],
    [120, 6, 26],
  ] as const) {
    p.ellipse(x, y + 3, w, 9, hex('#d8ecf8'));
    p.ellipse(x + 4, y, w - 10, 9, hex('#ffffff'));
  }
  // Hills on the horizon.
  for (let x = 0; x < p.w; x += 1) {
    const h = Math.round(10 + 6 * Math.sin(x / 23) + 4 * Math.sin(x / 9 + 1));
    p.rect(x, horizon - h, 1, h, hex('#58a878'));
    p.set(x, horizon - h, hex('#88c898'));
  }
  // Ground.
  for (let ty = 5; ty < 9; ty += 1)
    for (let tx = 0; tx < 16; tx += 1) p.blit(tileArt('grass'), tx * D, ty * D);
  p.rect(0, horizon - 8, p.w, 8, tileArt('grass').get(0, 0));
  // Path from the door to the bottom edge.
  const pathKey = (tx: number) => (tx === 7 ? 'path:8' : 'path:2');
  for (let ty = 7; ty < 9; ty += 1) for (const tx of [7, 8]) p.blit(tileArt(pathKey(tx)), tx * D, ty * D);
  // The office.
  const cols = [4, 5, 6, 7, 8, 9, 10, 11];
  const col = (tx: number) => (tx === 4 ? 'l' : tx === 11 ? 'r' : 'm');
  for (const tx of cols) {
    p.blit(tileArt(`roof:teal:t${col(tx)}`), tx * D, 3 * D);
    p.blit(tileArt(`roof:teal:b${col(tx)}`), tx * D, 4 * D);
    const win = col(tx) === 'm' && tx % 3 === 1;
    p.blit(tileArt(`whiteWall:u${col(tx)}${win ? 'w' : ''}`), tx * D, 5 * D);
    const door = tx === 7 || tx === 8;
    p.blit(
      tileArt(
        door
          ? 'door:white'
          : tx === 4 || tx === 11
            ? `whiteWall:l${col(tx)}`
            : win
              ? 'whiteWall:lmw'
              : 'whiteWall',
      ),
      tx * D,
      6 * D,
    );
  }
  // Pines and bushes on the sides, flowers in the grass.
  for (const tx of [0, 1, 2, 13, 14, 15]) {
    const ty = tx === 2 || tx === 13 ? 5 : 4;
    p.blit(tileArt('treetop'), tx * D, (ty - 1) * D);
    p.blit(tileArt('trunk'), tx * D, ty * D);
  }
  for (const [tx, ty] of [
    [3, 6],
    [12, 6],
  ] as const)
    p.blit(tileArt('bush'), tx * D, ty * D);
  for (const [tx, ty] of [
    [2, 7],
    [5, 8],
    [11, 7],
    [14, 8],
  ] as const)
    p.blit(tileArt('flowers'), tx * D, ty * D);
  return p.scale(2).png();
}
