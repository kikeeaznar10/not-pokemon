/**
 * World tileset, part 2 (world redesign): the tiles from id 32 on, drawn as 16 × 16 pixel grids scaled 2× to 32 px
 * (one character per pixel, a palette per tile; `.` is transparent). `make-world.ts` draws ids 0–31 and then
 * calls {@link drawExtraTiles}. Placeholder art in the same flat style as the rest: real art can replace
 * `assets/tilesets/world.png` tile by tile at the same ids.
 *
 * Colours of the office (the ahora façade and the open-plan interior) follow the ahora logo: deep navy, light
 * blue (the check mark) and white; the flexygo accent is orange (see the open question in `docs/PROGRESS.md`).
 */
import type { PNG } from 'pngjs';

/** RGBA colour. */
type RGBA = readonly [number, number, number, number];

/** Shared palette; tiles may add their own letters. */
const C: Record<string, RGBA> = {
  g: [88, 168, 72, 255], // grass
  G: [64, 136, 56, 255], // dark grass
  d: [40, 96, 40, 255], // deep leaf
  l: [120, 200, 96, 255], // light leaf
  o: [244, 140, 32, 255], // orange
  y: [250, 210, 80, 255], // yellow
  b: [120, 80, 50, 255], // brown
  B: [86, 56, 34, 255], // dark brown
  s: [160, 110, 70, 255], // soil
  S: [130, 88, 54, 255], // soil furrow
  w: [250, 250, 248, 255], // white
  W: [214, 218, 226, 255], // off-white shadow
  k: [40, 40, 50, 255], // near black
  K: [90, 90, 100, 255], // dark grey
  m: [150, 150, 160, 255], // mid grey
  M: [190, 192, 198, 255], // light grey
  n: [43, 42, 110, 255], // ahora navy
  N: [30, 30, 80, 255], // navy shadow
  a: [70, 165, 225, 255], // ahora light blue
  A: [150, 205, 240, 255], // pale blue
  f: [240, 136, 40, 255], // flexygo orange accent
  r: [200, 60, 50, 255], // red
  R: [150, 40, 35, 255], // dark red
  t: [214, 120, 70, 255], // terracotta
  c: [244, 226, 170, 255], // cream
  C: [220, 196, 140, 255], // cream shadow
  p: [128, 70, 170, 255], // purple
  P: [90, 46, 130, 255], // dark purple
  e: [60, 120, 210, 255], // sea blue
  E: [40, 90, 180, 255], // deep sea
  u: [236, 214, 160, 255], // sand
  U: [214, 188, 130, 255], // sand shadow
  v: [110, 40, 110, 255], // eggplant / plum
  i: [196, 150, 100, 255], // light wood
};

/** One tile: a 16-row pixel grid (16 chars a row) and optional extra palette entries. */
interface PixelTile {
  rows: string[];
  pal?: Record<string, RGBA>;
}

/** Local tile ids from 32 on (ids 0–31: `WT` in make-world.ts). */
export const XT = {
  soil: 32,
  onion: 33,
  lettuce: 34,
  eggplant: 35,
  sea: 36,
  shore: 37,
  sidewalk: 38,
  crosswalk: 39,
  paseo: 40,
  officeFloor: 41,
  carpet: 42,
  platform: 43,
  rails: 44,
  stationFloor: 45,
  orangeTree: 46,
  palm: 47,
  whiteHouse: 48,
  creamHouse: 49,
  industrial: 50,
  industrialWindows: 51,
  ahoraFacade: 52,
  logoA: 53,
  logoB: 54,
  logoC: 55,
  shutter: 56,
  brick: 57,
  metroSign: 58,
  train: 59,
  trainDoor: 60,
  glass: 61,
  sofa: 62,
  plant: 63,
  meetingTable: 64,
  modernDesk: 65,
  coffeeBar: 66,
  screen: 67,
  umbrella: 68,
  towel: 69,
  bench: 70,
  bankWall: 71,
  stairs: 72,
  agora: 73,
  cac: 74,
  oldStone: 75,
  plumTree: 76,
  stationFacade: 77,
  boat: 78,
  stoneBridge: 79,
  officeWall: 80,
  flatRoof: 81,
  greyRoof: 82,
  assut: 83,
  bullring: 84,
  lamp: 85,
  dryGrass: 86,
  wave: 87,
} as const;

/** Rows of a tileset with the extra tiles (8 columns). */
export const EXTRA_ROWS = 7;

const solidRow = (ch: string) => ch.repeat(16);

/** The pixel art, by id. */
const TILES: Record<number, PixelTile> = {
  [XT.soil]: {
    rows: Array.from({ length: 16 }, (_, y) => solidRow(y % 4 === 1 ? 'S' : 's')),
  },
  [XT.onion]: {
    rows: Array.from({ length: 16 }, (_, y) =>
      y % 8 === 0
        ? '.l...l...l...l..'
        : y % 8 === 1
          ? '.l...l...l...l..'
          : y % 8 === 2
            ? 'wWw.wWw.wWw.wWw.'
            : y % 8 === 3
              ? '.w...w...w...w..'
              : solidRow('s'),
    ).map((r) => r.replace(/\./g, 's')),
  },
  [XT.lettuce]: {
    rows: [
      'ssssssssssssssss',
      'slllsssslllsssss',
      'llLllsslllLlssss',
      'lLLLlsslLLLlssss',
      'llLllsslllLlssss',
      'sllssssslllsssss',
      'SSSSSSSSSSSSSSSS',
      'ssssssssssssssss',
      'sssslllssssslllss'.slice(0, 16),
      'sssllLllssslllLl',
      'sssLLLLlssslLLLl',
      'sssllLllssslllLl',
      'ssssllssssssllss',
      'SSSSSSSSSSSSSSSS',
      'ssssssssssssssss',
      'ssssssssssssssss',
    ],
    pal: { L: [70, 160, 60, 255] },
  },
  [XT.eggplant]: {
    rows: [
      'sssGssssssGsssss',
      'ssGGGsssssGGGsss',
      'ssdvvssssssdvvss',
      'ssvvvvsssssvvvvs',
      'ssvvvvsssssvvvvs',
      'sssvvsssssssvvss',
      'SSSSSSSSSSSSSSSS',
      'ssssssssssssssss',
      'GssssssGssssssss',
      'GGGssssGGGssssss',
      'dvvssssdvvssssss',
      'vvvvsssvvvvsssss',
      'vvvvsssvvvvsssss',
      'svvssssvvsssssss',
      'SSSSSSSSSSSSSSSS',
      'ssssssssssssssss',
    ],
  },
  [XT.sea]: {
    rows: Array.from({ length: 16 }, (_, y) =>
      y === 3 ? 'eeAAeeeeeeeeeeee' : y === 10 ? 'eeeeeeeeeAAeeeee' : solidRow(y > 12 ? 'E' : 'e'),
    ),
  },
  [XT.shore]: {
    rows: Array.from({ length: 16 }, (_, y) =>
      y < 3
        ? solidRow('u')
        : y === 3
          ? 'uuwwuuuwwwuuuwwu'
          : y < 7
            ? solidRow('A')
            : y === 7
              ? 'AwAAwwAAAwAAwwAA'
              : solidRow('e'),
    ),
  },
  [XT.sidewalk]: {
    rows: Array.from({ length: 16 }, (_, y) => (y % 8 === 7 ? solidRow('M') : 'WWWWWWWMWWWWWWWM')),
  },
  [XT.crosswalk]: {
    rows: Array.from({ length: 16 }, (_, y) => (y % 4 < 2 ? 'KwwwwwwwwwwwwwwK' : solidRow('K'))),
  },
  [XT.paseo]: {
    rows: Array.from({ length: 16 }, (_, y) =>
      Array.from({ length: 16 }, (_, x) => ((Math.floor(x / 4) + Math.floor(y / 4)) % 2 ? 'c' : 'r')).join(
        '',
      ),
    ),
    pal: { r: [226, 150, 120, 255] },
  },
  [XT.officeFloor]: {
    rows: Array.from({ length: 16 }, (_, y) => (y === 15 ? solidRow('M') : 'WWWWWWWWWWWWWWWM')),
  },
  [XT.carpet]: {
    rows: Array.from({ length: 16 }, (_, y) => (y % 4 === 0 ? 'AaAAAaAAAaAAAaAA' : solidRow('A'))),
  },
  [XT.platform]: {
    rows: Array.from({ length: 16 }, (_, y) =>
      y >= 13 ? solidRow(y === 13 ? 'y' : 'k') : y % 8 === 7 ? solidRow('m') : 'MMMMMMMmMMMMMMMm',
    ),
  },
  [XT.rails]: {
    rows: Array.from({ length: 16 }, (_, y) =>
      y === 3 || y === 12 ? solidRow('m') : y % 4 === 1 ? solidRow('b') : solidRow('K'),
    ),
  },
  [XT.stationFloor]: {
    rows: Array.from({ length: 16 }, (_, y) =>
      Array.from({ length: 16 }, (_, x) => ((x + y) % 8 === 0 || (x - y + 16) % 8 === 0 ? 't' : 'c')).join(
        '',
      ),
    ),
  },
  [XT.orangeTree]: {
    rows: [
      '................',
      '.....dddddd.....',
      '...ddGGGGGGdd...',
      '..dGGGoGGGGGGd..',
      '.dGGGGGGGoGGGGd.',
      '.dGoGGGGGGGGoGd.',
      'dGGGGGoGGGGGGGGd',
      'dGGGGGGGGGoGGGGd',
      'dGoGGGGGGGGGGoGd',
      '.dGGGGoGGGGGGGd.',
      '.dGGGGGGGoGGGGd.',
      '..ddGGGGGGGGdd..',
      '....dddbbddd....',
      '.......bb.......',
      '.......bb.......',
      '......BBBB......',
    ],
  },
  [XT.palm]: {
    rows: [
      '...l........l...',
      '..lGl..ll..lGl..',
      '.lG..lGGGGl..Gl.',
      'lG..lGGddGGl..Gl',
      '...lG..bb..Gl...',
      '..lG...bb...Gl..',
      '..G....bb....G..',
      '.......bb.......',
      '.......bb.......',
      '......bbB.......',
      '......bbB.......',
      '......bbB.......',
      '.......bbB......',
      '.......bbB......',
      '.......bbB......',
      '......BBBBB.....',
    ],
  },
  [XT.whiteHouse]: {
    rows: [
      'wwwwwwwwwwwwwwww',
      'wwwwwwwwwwwwwwww',
      'wwaaaaaaawwwwwww',
      'wwaAAkAAawwwwwww',
      'wwaAAkAAawwwwwww',
      'wwakkkkkawwwwwww',
      'wwaAAkAAawwwwwww',
      'wwaAAkAAawwwwwww',
      'wwaaaaaaawwwwwww',
      'wwwwwwwwwwwwwwww',
      'wwwwwwwwwwwwwwww',
      'wwwwwwwwwwwwwwww',
      'aaaaaaaaaaaaaaaa',
      'WWWWWWWWWWWWWWWW',
      'WWWWWWWWWWWWWWWW',
      'MMMMMMMMMMMMMMMM',
    ],
  },
  [XT.creamHouse]: {
    rows: [
      'cccccccccccccccc',
      'cccccccccccccccc',
      'cccbbbbbbbbccccc',
      'cccbAAkAAkbccccc',
      'cccbAAkAAkbccccc',
      'cccbkkkkkkbccccc',
      'cccbAAkAAkbccccc',
      'cccbAAkAAkbccccc',
      'cccbbbbbbbbccccc',
      'ccrrrrrrrrrrcccc',
      'cccccccccccccccc',
      'cccccccccccccccc',
      'CCCCCCCCCCCCCCCC',
      'CCCCCCCCCCCCCCCC',
      'CCCCCCCCCCCCCCCC',
      'tttttttttttttttt',
    ],
  },
  [XT.industrial]: {
    rows: Array.from({ length: 16 }, (_, y) => (y === 15 ? solidRow('K') : 'MmMMmMMmMMmMMmMM')),
  },
  [XT.industrialWindows]: {
    rows: Array.from({ length: 16 }, (_, y) =>
      y >= 4 && y <= 9
        ? y === 4 || y === 9
          ? 'MmkkkkkkkkkkkkmM'
          : 'MmkAAkAAkAAkAAmM'
        : y === 15
          ? solidRow('K')
          : 'MmMMmMMmMMmMMmMM',
    ),
  },
  [XT.ahoraFacade]: {
    rows: Array.from({ length: 16 }, (_, y) => (y === 15 ? solidRow('N') : 'nNnnNnnNnnNnnNnn')),
  },
  // The logo "ahora" in white with the light-blue check, over three façade tiles: "ah" | "o✓" | "ra".
  [XT.logoA]: {
    rows: [
      'nNnnNnnNnnNnnNnn',
      'nNnnNnnNnnNnnNnn',
      'nNnnNnnNwwNnnNnn',
      'nNnnNnnNwwNnnNnn',
      'nNwwwwnNwwNnnNnn',
      'nNnnnwwNwwwwwNnn',
      'nNnnnwwNwwnnwwnn',
      'nNwwwwwNwwnnwwnn',
      'nwwnnwwNwwnnwwnn',
      'nwwnnwwNwwnnwwnn',
      'nNwwwwwNwwnnwwnn',
      'nNnnNnnNnnNnnNnn',
      'nNnnNnnNnnNnnNnn',
      'nNnnNnnNnnNnnNnn',
      'nNnnNnnNnnNnnNnn',
      'NNNNNNNNNNNNNNNN',
    ],
  },
  [XT.logoB]: {
    rows: [
      'nNnnNnnNnnNnnNnn',
      'nNnnNnnNnnNnnNnn',
      'nNnnNnnNnnNnnNnn',
      'nNnnNnnNnnNnnNnn',
      'nNnnNwwwwwNnnNnn',
      'nNnnwwnnnwwnnNnn',
      'nNnwwnnNnnwwnNnn',
      'nNnwnanNnanwnNnn',
      'nNnwnnaNannwnNnn',
      'nNnwwnnaanwwnNnn',
      'nNnnwwnaNwwnnNnn',
      'nNnnNwwwwwNnnNnn',
      'nNnnNnnNnnNnnNnn',
      'nNnnNnnNnnNnnNnn',
      'nNnnNnnNnnNnnNnn',
      'NNNNNNNNNNNNNNNN',
    ],
  },
  [XT.logoC]: {
    rows: [
      'nNnnNnnNnnNnnNnn',
      'nNnnNnnNnnNnnNnn',
      'nNnnNnnNnnNnnNnn',
      'nNnnNnnNnnNnnNnn',
      'nNwwnwwwnNwwwwnn',
      'nNwwwnnNnnnnnwwn',
      'nNwwnnnNnnnnnwwn',
      'nNwwnnnNnNwwwwwn',
      'nNwwnnnNnwwnnwwn',
      'nNwwnnnNnwwnnwwn',
      'nNwwnnnNnNwwwwwn',
      'nNnnNnnNnnNnnNnn',
      'nNnnNnnNnnNnnNnn',
      'nNnnNnnNnnNnnNnn',
      'nNnnNnnNnnNnnNnn',
      'NNNNNNNNNNNNNNNN',
    ],
  },
  [XT.shutter]: {
    rows: Array.from({ length: 16 }, (_, y) =>
      y < 2 ? solidRow('M') : y === 15 ? solidRow('K') : y % 2 ? 'MNNNNNNNNNNNNNNM' : 'MnnnnnnnnnnnnnnM',
    ),
  },
  [XT.brick]: {
    rows: Array.from({ length: 16 }, (_, y) =>
      y % 4 === 3 ? solidRow('C') : y % 8 < 4 ? 'tttCtttttttCtttt' : 'tttttttCttttttttt'.slice(0, 16),
    ),
    pal: { t: [214, 160, 110, 255], C: [176, 128, 86, 255] },
  },
  [XT.metroSign]: {
    rows: [
      '................',
      '....rrrrrrrr....',
      '...rrrrrrrrrr...',
      '..rrwwrrrrwwrr..',
      '..rrwwwrrwwwrr..',
      '..rrwwrwwrwwrr..',
      '..rrwwrrrrwwrr..',
      '..rrwwrrrrwwrr..',
      '...rrrrrrrrrr...',
      '....rrrrrrrr....',
      '.......KK.......',
      '.......KK.......',
      '.......KK.......',
      '.......KK.......',
      '.......KK.......',
      '......KKKK......',
    ],
  },
  [XT.train]: {
    rows: [
      'KKKKKKKKKKKKKKKK',
      'wwwwwwwwwwwwwwww',
      'wwwwwwwwwwwwwwww',
      'wkkkkkwwwwkkkkkw',
      'wkAAAkwwwwkAAAkw',
      'wkAAAkwwwwkAAAkw',
      'wkkkkkwwwwkkkkkw',
      'wwwwwwwwwwwwwwww',
      'rrrrrrrrrrrrrrrr',
      'wwwwwwwwwwwwwwww',
      'wwwwwwwwwwwwwwww',
      'WWWWWWWWWWWWWWWW',
      'KKKKKKKKKKKKKKKK',
      'kKKkkkkkkkkkKKkk',
      'kKKkkkkkkkkkKKkk',
      'kkkkkkkkkkkkkkkk',
    ],
  },
  [XT.trainDoor]: {
    rows: [
      'KKKKKKKKKKKKKKKK',
      'wwwwwwwwwwwwwwww',
      'wwkkkkkkkkkkkkww',
      'wwkAAAAkkAAAAkww',
      'wwkAAAAkkAAAAkww',
      'wwkAAAAkkAAAAkww',
      'wwkmmmmkkmmmmkww',
      'wwkmmmmkkmmmmkww',
      'rrkmmmmkkmmmmkrr',
      'wwkmmmmkkmmmmkww',
      'wwkmmmmkkmmmmkww',
      'WWkmmmmkkmmmmkWW',
      'KKkkkkkkkkkkkkKK',
      'yyyyyyyyyyyyyyyy',
      'MMMMMMMMMMMMMMMM',
      'MMMMMMMMMMMMMMMM',
    ],
  },
  [XT.glass]: {
    rows: Array.from({ length: 16 }, (_, y) =>
      y === 0 || y === 15 ? solidRow('m') : y % 5 === 2 ? 'mAAwAAAAAAAAAAAm' : 'mAAAAAAAAAAAAAAm',
    ),
  },
  [XT.sofa]: {
    rows: [
      '................',
      '................',
      '.nnnnnnnnnnnnnn.',
      'nNNNNNNNNNNNNNNn',
      'nNnnnnnnnnnnnnNn',
      'nNnnnnnnnnnnnnNn',
      'nNaaaaaaaaaaaaNn',
      'nNaaaaaaaaaaaaNn',
      'nNaaaaaaaaaaaaNn',
      'nNNNNNNNNNNNNNNn',
      '.nnnnnnnnnnnnnn.',
      '.K............K.',
      '................',
      '................',
      '................',
      '................',
    ],
  },
  [XT.plant]: {
    rows: [
      '.....l...l......',
      '...l.ll.ll.l....',
      '..lGl.lGl.lGl...',
      '...GGlGGGlGG....',
      '..lGGGdGdGGGl...',
      '...GdGGGGGdG....',
      '....GGdGdGG.....',
      '.....GGGGG......',
      '....ffffffff....',
      '....fffffff.f...',
      '.....ffffff.....',
      '.....ffffff.....',
      '.....ffffff.....',
      '......ffff......',
      '................',
      '................',
    ],
  },
  [XT.meetingTable]: {
    rows: [
      '................',
      '..KKK..KKK..KK..',
      '..KaK..KaK..Kf..',
      '.wwwwwwwwwwwwww.',
      '.wWWWWWWWWWWWWw.',
      '.wWwwwwwwwwwwWw.',
      '.wWwwkkwwwwwwWw.',
      '.wWwwkAwwwwwwWw.',
      '.wWwwwwwwwwwwWw.',
      '.wWWWWWWWWWWWWw.',
      '.wwwwwwwwwwwwww.',
      '..KfK..KaK..Ka..',
      '..KKK..KKK..KK..',
      '................',
      '................',
      '................',
    ],
  },
  [XT.modernDesk]: {
    rows: [
      '................',
      '...kkkkkkkkkk...',
      '...kaaaaaaaak...',
      '...kaAAAAAAak...',
      '...kaAAAAAAak...',
      '...kkkkkkkkkk...',
      '.......kk.......',
      'wwwwwwwwwwwwwwww',
      'wWWWWWWWWWWWWWWw',
      'wWWKKKKKKKWWfWWw',
      'wWWWWWWWWWWWWWWw',
      'wwwwwwwwwwwwwwww',
      '.m............m.',
      '.m.....nn.....m.',
      '......nnnn......',
      '.......nn.......',
    ],
  },
  [XT.coffeeBar]: {
    rows: [
      'MMMMMMMMMMMMMMMM',
      'MkkkkMMMMMMwwwMM',
      'MkfrkMMMMMwnnnwM',
      'MkkkkMMMMMwnnnwM',
      'MkMMkMMMMMMwwwMM',
      'MkkkkMMMMMMMMMMM',
      'nnnnnnnnnnnnnnnn',
      'nNNNNNNNNNNNNNNn',
      'nNnnnnnnnnnnnnNn',
      'nNnnnnnnnnnnnnNn',
      'nNnnnnnnnnnnnnNn',
      'nNnnnnnnnnnnnnNn',
      'nNnnnnnnnnnnnnNn',
      'nNNNNNNNNNNNNNNn',
      'nnnnnnnnnnnnnnnn',
      'kkkkkkkkkkkkkkkk',
    ],
  },
  [XT.screen]: {
    rows: [
      'wwwwwwwwwwwwwwww',
      'wkkkkkkkkkkkkkkw',
      'wknnnnnnnnnnnnkw',
      'wknwnwwwnaaannkw',
      'wknnnnnnnnaannkw',
      'wknffnnnnnnannkw',
      'wknffnaannnnnnkw',
      'wknffnaanffnnnkw',
      'wknnnnnnnnnnnnkw',
      'wkkkkkkkkkkkkkkw',
      'wwwwwwwkkwwwwwww',
      'WWWWWWWkkWWWWWWW',
      'WWWWWWWWWWWWWWWW',
      'WWWWWWWWWWWWWWWW',
      'WWWWWWWWWWWWWWWW',
      'MMMMMMMMMMMMMMMM',
    ],
  },
  [XT.umbrella]: {
    rows: [
      '................',
      '.....rrwwrr.....',
      '...rrrwwwwrrr...',
      '..rrrrwwwwrrrr..',
      '.wwwwrrrrrrwwww.',
      'wwwwwrrrrrrwwwww',
      '.......bb.......',
      '.......bb.......',
      '.......bb.......',
      '.......bb.......',
      '.......bb.......',
      '.......bb.......',
      '.......bb.......',
      '......UbbU......',
      '.....UUUUUU.....',
      '................',
    ],
  },
  [XT.towel]: {
    rows: [
      '................',
      '................',
      '..aaaaaaaaaaaa..',
      '..wwwwwwwwwwww..',
      '..aaaaaaaaaaaa..',
      '..wwwwwwwwwwww..',
      '..aaaaaaaaaaaa..',
      '..wwwwwwwwwwww..',
      '..aaaaaaaaaaaa..',
      '..wwwwwwwwwwww..',
      '..aaaaaaaaaaaa..',
      '..wwwwwwwwwwww..',
      '..aaaaaaaaaaaa..',
      '................',
      '................',
      '................',
    ],
  },
  [XT.bench]: {
    rows: [
      '................',
      '................',
      '................',
      'iiiiiiiiiiiiiiii',
      'BBBBBBBBBBBBBBBB',
      'iiiiiiiiiiiiiiii',
      'BBBBBBBBBBBBBBBB',
      '................',
      'iiiiiiiiiiiiiiii',
      'iiiiiiiiiiiiiiii',
      'BBBBBBBBBBBBBBBB',
      '.kk..........kk.',
      '.kk..........kk.',
      '................',
      '................',
      '................',
    ],
  },
  // The Turia's retaining wall: pale stone with a dark shadow at the foot, so the park reads as sunken.
  [XT.bankWall]: {
    rows: [
      'MMMMMMMMMMMMMMMM',
      'WWWWWWWWWWWWWWWW',
      'cCcccCcccCcccCcc',
      'CCCCCCCCCCCCCCCC',
      'ccCcccCcccCcccCc',
      'CCCCCCCCCCCCCCCC',
      'cCcccCcccCcccCcc',
      'CCCCCCCCCCCCCCCC',
      'ccCcccCcccCcccCc',
      'CCCCCCCCCCCCCCCC',
      'cCcccCcccCcccCcc',
      'CCCCCCCCCCCCCCCC',
      'KKKKKKKKKKKKKKKK',
      'GGGGGGGGGGGGGGGG',
      'GGGGGGGGGGGGGGGG',
      'gggggggggggggggg',
    ],
  },
  [XT.stairs]: {
    rows: Array.from({ length: 16 }, (_, y) =>
      y % 4 === 3 ? solidRow('C') : y % 4 === 0 ? solidRow('w') : solidRow('c'),
    ),
  },
  [XT.agora]: {
    rows: Array.from({ length: 16 }, (_, y) =>
      y < 3 ? (y === 0 ? solidRow('w') : 'AeAAeAAeAAeAAeAA') : y === 15 ? solidRow('K') : 'pPwpppPwpppPwppp',
    ),
  },
  [XT.cac]: {
    rows: Array.from({ length: 16 }, (_, y) =>
      y < 4 ? 'wwWwwwWwwwWwwwWw' : y < 8 ? 'wWAAwWAAwWAAwWAA' : y === 15 ? solidRow('M') : 'wWkkwWkkwWkkwWkk',
    ),
  },
  [XT.oldStone]: {
    rows: Array.from({ length: 16 }, (_, y) =>
      y % 4 === 3 ? solidRow('U') : y % 8 < 4 ? 'CCCUCCCCCCCUCCCC' : 'CCCCCCCUCCCCCCCU',
    ),
    pal: { C: [196, 172, 130, 255], U: [150, 130, 96, 255] },
  },
  [XT.plumTree]: {
    rows: [
      '................',
      '.....dddddd.....',
      '...ddGGGGGGdd...',
      '..dGGGvGGGGGGd..',
      '.dGGGGGGGvGGGGd.',
      '.dGvGGGGGGGGvGd.',
      'dGGGGGvGGGGGGGGd',
      'dGGGGGGGGGvGGGGd',
      'dGvGGGGGGGGGGvGd',
      '.dGGGGvGGGGGGGd.',
      '.dGGGGGGGvGGGGd.',
      '..ddGGGGGGGGdd..',
      '....dddbbddd....',
      '.......bb.......',
      '.......bb.......',
      '......BBBB......',
    ],
  },
  // Estació del Nord: orange modernist façade with a band of glazed tiles and an orange.
  [XT.stationFacade]: {
    rows: [
      'oooooooooooooooo',
      'oRoooooooooooRoo',
      'oooooggoooooooo'.padEnd(16, 'o'),
      'oooogooggoooooooo'.slice(0, 16),
      'ooooooggoooooooo',
      'yyyyyyyyyyyyyyyy',
      'awawawawawawawaw',
      'yyyyyyyyyyyyyyyy',
      'ooRRRRooooRRRRoo',
      'ooRAARooooRAARoo',
      'ooRAARooooRAARoo',
      'ooRAARooooRAARoo',
      'ooRRRRooooRRRRoo',
      'oooooooooooooooo',
      'oooooooooooooooo',
      'RRRRRRRRRRRRRRRR',
    ],
    pal: { o: [232, 120, 52, 255], g: [60, 140, 60, 255] },
  },
  [XT.boat]: {
    rows: [
      'eeeeeeeweeeeeeee',
      'eeeeeeewweeeeeee',
      'eeeeeeewwweeeeee',
      'eeeeeeewwwweeeee',
      'eeeeeeewwwwweeee',
      'eeeeeeeKeeeeeeee',
      'eeewwwwwwwwwweee',
      'eeewrrrrrrrrweee',
      'eeeewwwwwwwweeee',
      'eeeeewwwwwweeeee',
      'eeeeeeeeeeeeeeee',
      'eeeeeeeeeeeeeeee',
      'eeAAeeeeeeeeeeee',
      'eeeeeeeeeeeAAeee',
      'EEEEEEEEEEEEEEEE',
      'EEEEEEEEEEEEEEEE',
    ],
  },
  [XT.stoneBridge]: {
    rows: Array.from({ length: 16 }, (_, x) => x).map((y) =>
      y < 2 || y > 13
        ? solidRow('U')
        : y === 2 || y === 13
          ? solidRow('K')
          : y % 4 === 0
            ? 'cCccccCcccccCccc'
            : solidRow('c'),
    ),
    pal: { c: [206, 190, 160, 255], C: [176, 160, 130, 255], U: [150, 130, 96, 255] },
  },
  [XT.officeWall]: {
    rows: Array.from({ length: 16 }, (_, y) =>
      y >= 12 ? solidRow(y === 12 ? 'f' : y < 15 ? 'n' : 'N') : solidRow('w'),
    ),
  },
  [XT.flatRoof]: {
    rows: Array.from({ length: 16 }, (_, y) =>
      y === 0
        ? solidRow('C')
        : y === 6
          ? '..KK........mm..'.replace(/\./g, 'c')
          : y === 7
            ? '..KK........mm..'.replace(/\./g, 'c')
            : solidRow('c'),
    ),
    pal: { c: [216, 200, 176, 255], C: [180, 164, 140, 255] },
  },
  [XT.greyRoof]: {
    rows: Array.from({ length: 16 }, (_, y) => (y % 4 === 0 ? solidRow('K') : 'mmmMmmmmmmmMmmmm')),
  },
  // L'Assut de l'Or: the white harp bridge's mast and cables (from the reference photo).
  [XT.assut]: {
    rows: [
      'wwW.............',
      '.wwW..........k.',
      '..wwW.......kk..',
      '...wwW....kk....',
      '....wwW.kk......',
      '.....wwWk.......',
      '......wwW.......',
      '.....k.wwW......',
      '....k...wwW.....',
      '...k.....wwW....',
      '..k.......wwW...',
      '.k.........wwW..',
      'cccccccccccccccc',
      'WWWWWWWWWWWWWWWW',
      'MMMMMMMMMMMMMMMM',
      'MMMMMMMMMMMMMMMM',
    ].map((r) => r.replace(/\./g, 'e')),
    pal: { e: [200, 225, 245, 255], c: [206, 190, 160, 255] },
  },
  [XT.bullring]: {
    rows: Array.from({ length: 16 }, (_, y) =>
      y < 2 ? solidRow('t') : y === 15 ? solidRow('R') : y % 7 < 4 ? 'tRRtttRRtttRRttt' : solidRow('t'),
    ),
    pal: { t: [214, 150, 100, 255] },
  },
  [XT.lamp]: {
    rows: [
      '................',
      '......kkkk......',
      '.....kyyyyk.....',
      '.....kyyyyk.....',
      '......kkkk......',
      '.......kk.......',
      '.......kk.......',
      '.......kk.......',
      '.......kk.......',
      '.......kk.......',
      '.......kk.......',
      '.......kk.......',
      '.......kk.......',
      '......kkkk......',
      '.....kkkkkk.....',
      '................',
    ],
  },
  [XT.dryGrass]: {
    rows: Array.from({ length: 16 }, (_, y) =>
      y % 5 === 0
        ? 'dddhdddddhdddhdd'
        : y % 5 === 1
          ? 'ddhhdddhdhhddhdd'
          : y % 5 === 2
            ? 'dhdhdddhdhdhdhdd'
            : solidRow('d'),
    ),
    pal: { d: [212, 180, 120, 255], h: [170, 150, 70, 255] },
  },
  [XT.wave]: {
    rows: Array.from({ length: 16 }, (_, y) =>
      y === 4
        ? 'eewwweeeeeewwwee'
        : y === 5
          ? 'ewweewweewweewwe'
          : y === 11
            ? 'eeeeeewwweeeeeee'
            : solidRow('e'),
    ),
  },
};

/** Ids of the extra tiles that block (`solid = true`). */
export const EXTRA_SOLID: number[] = [
  XT.sea,
  XT.rails,
  XT.orangeTree,
  XT.palm,
  XT.whiteHouse,
  XT.creamHouse,
  XT.industrial,
  XT.industrialWindows,
  XT.ahoraFacade,
  XT.logoA,
  XT.logoB,
  XT.logoC,
  XT.shutter,
  XT.brick,
  XT.metroSign,
  XT.train,
  XT.glass,
  XT.sofa,
  XT.plant,
  XT.meetingTable,
  XT.modernDesk,
  XT.coffeeBar,
  XT.screen,
  XT.umbrella,
  XT.bench,
  XT.bankWall,
  XT.agora,
  XT.cac,
  XT.oldStone,
  XT.plumTree,
  XT.stationFacade,
  XT.boat,
  XT.officeWall,
  XT.flatRoof,
  XT.greyRoof,
  XT.assut,
  XT.bullring,
  XT.lamp,
  XT.wave,
];

/** Ids of the extra tiles that start encounters (`encounter = true`): the huerta's crops and the dry scrub. */
export const EXTRA_ENCOUNTER: number[] = [XT.onion, XT.lettuce, XT.eggplant, XT.dryGrass];

/** Draw every extra tile into `png` (an 8-column tileset of 32 px tiles). */
export function drawExtraTiles(png: PNG): void {
  for (const [idText, tile] of Object.entries(TILES)) {
    const id = Number(idText);
    const ox = (id % 8) * 32;
    const oy = Math.floor(id / 8) * 32;
    if (tile.rows.length !== 16) throw new Error(`world tile ${id}: ${tile.rows.length} rows, expected 16`);
    tile.rows.forEach((row, y) => {
      if (row.length !== 16)
        throw new Error(`world tile ${id}: row ${y} has ${row.length} pixels, expected 16`);
      [...row].forEach((ch, x) => {
        if (ch === '.') return;
        const c = tile.pal?.[ch] ?? C[ch];
        if (!c) throw new Error(`world tile ${id}: unknown colour "${ch}"`);
        for (let j = 0; j < 2; j += 1)
          for (let i = 0; i < 2; i += 1) {
            const k = ((oy + y * 2 + j) * png.width + ox + x * 2 + i) * 4;
            png.data[k] = c[0];
            png.data[k + 1] = c[1];
            png.data[k + 2] = c[2];
            png.data[k + 3] = c[3];
          }
      });
    });
  }
}
