/**
 * World tile art (see `docs/ART.md`): every tile is drawn at 16 × 16 design pixels and scaled ×2 into
 * the 32 px tileset by `make-world.ts`.
 *
 * {@link BASE_TILES} are the 32 tiles whose local ids (`WT` in `make-world.ts`, 0–31) the maps have always used.
 * {@link VARIANT_TILES} are extra looks of the same tiles (building corners, path borders, shore foam, roof colours…)
 * that `make-world.ts` picks from each tile's neighbours. A variant copies its base tile's `solid` / `encounter`
 * properties, so collision, encounters and the minimap never change.
 */
import { CLEAR, hash, hex, mix, Pix, type Rgba } from './pixels';

/** Design size of one tile. */
export const D = 16;

const P = {
  out: hex('#283828'),
  grass: hex('#78d080'),
  grassL: hex('#a8e8a0'),
  grassD: hex('#58b068'),
  grassDD: hex('#3a8a58'),
  tall: hex('#48a050'),
  tallL: hex('#88d878'),
  tallD: hex('#2e7c40'),
  tallO: hex('#1e5a30'),
  path: hex('#f0d8a0'),
  pathL: hex('#f8ecc4'),
  pathD: hex('#d4b47a'),
  pathO: hex('#b89458'),
  sand: hex('#f8e4b0'),
  sandL: hex('#fff4d4'),
  sandD: hex('#e2c486'),
  desert: hex('#e8c088'),
  desertD: hex('#c89860'),
  desertL: hex('#f4d8a8'),
  water: hex('#58b8e8'),
  waterL: hex('#a8e0f8'),
  waterD: hex('#3890c8'),
  waterO: hex('#286890'),
  foam: hex('#f0fbff'),
  stone: hex('#cdc8b8'),
  stoneL: hex('#e8e4d8'),
  stoneD: hex('#9c9888'),
  plaza: hex('#f4ecd0'),
  plazaL: hex('#fffae8'),
  plazaD: hex('#d8cca4'),
  wood: hex('#d8a060'),
  woodL: hex('#f0c080'),
  woodD: hex('#a87038'),
  woodO: hex('#604020'),
  trunk: hex('#8a6038'),
  trunkD: hex('#5a3c20'),
  pine: hex('#50a850'),
  pineL: hex('#88d878'),
  pineD: hex('#2e7840'),
  pineO: hex('#183820'),
  rock: hex('#b8b4b0'),
  rockL: hex('#e0dcd8'),
  rockD: hex('#84807c'),
  rockO: hex('#3c3a40'),
  cliff: hex('#c8a070'),
  cliffL: hex('#e8c898'),
  cliffD: hex('#987048'),
  cliffO: hex('#584028'),
  plaster: hex('#f4ecd4'),
  plasterD: hex('#d8ccac'),
  timber: hex('#a87848'),
  timberD: hex('#704828'),
  timberO: hex('#402818'),
  white: hex('#fbfbf8'),
  whiteD: hex('#d4d8e4'),
  whiteO: hex('#404860'),
  azul: hex('#4878c8'),
  azulL: hex('#88b0e8'),
  glass: hex('#a8d8f0'),
  glassL: hex('#e0f4ff'),
  glassD: hex('#5890b8'),
  red: hex('#e84848'),
  redD: hex('#a82838'),
  yellow: hex('#f8d848'),
  pink: hex('#f890b0'),
  shadow: [24, 40, 32, 72] as Rgba,
  floor: hex('#e0b070'),
  floorL: hex('#f0c888'),
  floorD: hex('#b88048'),
  paper: hex('#f4e4bc'),
  paperD: hex('#e2cc98'),
  wallTop: hex('#585068'),
  wallTopL: hex('#787088'),
  blocker: [255, 0, 0, 110] as Rgba,
} as const;

/** Roof colours, cycled per building so a street is not one colour. */
export const ROOF_COLOURS = {
  terracotta: { b: hex('#e07850'), l: hex('#f8a878'), d: hex('#b85038'), o: hex('#6c2820') },
  blue: { b: hex('#5888d8'), l: hex('#90bcf0'), d: hex('#3860a8'), o: hex('#202c60') },
  teal: { b: hex('#40a8a0'), l: hex('#78d4c4'), d: hex('#2c7870'), o: hex('#183c40') },
  ochre: { b: hex('#d8a840'), l: hex('#f4d478'), d: hex('#a87828'), o: hex('#584010') },
} as const;
/** Roof colour names in cycling order. */
export type RoofColour = keyof typeof ROOF_COLOURS;
export const ROOF_ORDER: RoofColour[] = ['terracotta', 'blue', 'teal', 'ochre'];

const tile = (fill?: Rgba) => {
  const p = new Pix(D, D);
  if (fill) p.rect(0, 0, D, D, fill);
  return p;
};

/** Scatter `n` texture pixels of colour `c` (deterministic per `seed`). */
function speckle(p: Pix, seed: number, n: number, c: Rgba, c2?: Rgba): Pix {
  for (let k = 0; k < n; k += 1) {
    const x = Math.floor(hash(k, 1, seed) * D);
    const y = Math.floor(hash(k, 2, seed) * D);
    p.set(x, y, c);
    if (c2) p.set(x, y + 1, c2);
  }
  return p;
}

function grass(): Pix {
  const p = tile(P.grass);
  // Little dash pairs: light on top, dark below (the dotted grass of the references).
  for (const [x, y] of [
    [2, 2],
    [9, 1],
    [13, 6],
    [5, 8],
    [11, 11],
    [1, 13],
    [7, 14],
  ] as const) {
    p.set(x, y, P.grassL).set(x, y + 1, P.grassD);
  }
  return p;
}

function tallGrass(): Pix {
  const p = tile(P.tall);
  const clump = [
    '........',
    '.L....L.',
    'LGL..LGL',
    'GDGLLGDG',
    'DGDGGDGD',
    'GDDGGDDG',
    'DDODDODD',
    'OOOOOOOO',
  ];
  const pal = { L: P.tallL, G: P.tall, D: P.tallD, O: P.tallO };
  for (const [x, y] of [
    [0, 0],
    [8, 0],
    [4, 8],
    [-4, 8],
    [12, 8],
  ] as const)
    p.ascii(x, y, clump, pal);
  return p;
}

function path(): Pix {
  const p = tile(P.path);
  speckle(p, 11, 6, P.pathD);
  speckle(p, 12, 4, P.pathL);
  p.set(4, 5, P.pathO).set(5, 5, P.pathD).set(11, 12, P.pathO).set(12, 12, P.pathD);
  return p;
}

function sand(): Pix {
  const p = tile(P.sand);
  speckle(p, 21, 7, P.sandD);
  speckle(p, 22, 5, P.sandL);
  return p;
}

function dune(): Pix {
  const p = sand();
  const blades = ['.y...y..', '.y..yG..', 'Gy.yG..y', '.GyG..yG', '.GGG.yG.', 'DGGDGGD.', '.DDDDD..'];
  const pal = { y: hex('#c8d870'), G: hex('#90b848'), D: hex('#5c7c30') };
  p.ascii(0, 1, blades, pal).ascii(8, 9, blades, pal).ascii(-4, 9, blades, pal).ascii(12, 1, blades, pal);
  return p;
}

function desert(): Pix {
  const p = tile(P.desert);
  speckle(p, 31, 6, P.desertD);
  speckle(p, 32, 4, P.desertL);
  // A thin crack.
  p.set(3, 10, P.desertD).set(4, 11, P.desertD).set(5, 11, P.desertD).set(6, 12, P.desertD);
  return p;
}

function vineyard(): Pix {
  const p = tile(hex('#c49a64'));
  p.rect(0, 15, D, 1, hex('#a07848'));
  speckle(p, 41, 4, hex('#a07848'));
  const vine = [
    '..GLG...',
    '.GLGGG..',
    'GLGGPGG.',
    'GGPpGGDG',
    '.GPPGDG.',
    '..DGDD..',
    '...TT...',
    '...TT...',
    '..sTTs..',
  ];
  const pal = {
    G: hex('#58a848'),
    L: hex('#90d870'),
    D: hex('#2e6c30'),
    P: hex('#7c3888'),
    p: hex('#b468c0'),
    T: P.trunkD,
    s: hex('#a07848'),
  };
  p.ascii(0, 2, vine, pal).ascii(8, 2, vine, pal);
  // Trellis wire.
  p.rect(0, 9, D, 1, hex('#8c8c90'));
  return p;
}

function road(): Pix {
  // Grey-beige cobbles, staggered every row.
  const p = tile(P.stoneD);
  for (let row = 0; row < 4; row += 1) {
    const off = row % 2 === 0 ? 0 : 2;
    for (let col = -1; col < 4; col += 1) {
      const x = col * 4 + off;
      const y = row * 4;
      p.rect(x, y, 3, 3, P.stone);
      p.set(x, y, P.stoneL).set(x + 1, y, P.stoneL);
    }
  }
  return p;
}

function plaza(): Pix {
  // Basket-weave paving: 4 × 4 cells alternating horizontal and vertical bricks.
  const p = tile(P.plaza);
  for (let cy = 0; cy < 4; cy += 1)
    for (let cx = 0; cx < 4; cx += 1) {
      const x = cx * 4;
      const y = cy * 4;
      if ((cx + cy) % 2 === 0) {
        p.rect(x, y + 1, 4, 1, P.plazaD).rect(x, y + 3, 4, 1, P.plazaD);
        p.set(x, y, P.plazaL);
      } else {
        p.rect(x + 1, y, 1, 4, P.plazaD).rect(x + 3, y, 1, 4, P.plazaD);
        p.set(x, y, P.plazaL);
      }
    }
  return p;
}

function water(): Pix {
  const p = tile(P.water);
  for (const [x, y] of [
    [2, 3],
    [10, 7],
    [4, 12],
  ] as const)
    p.rect(x, y, 3, 1, P.waterL).set(x + 3, y + 1, P.waterL);
  p.set(13, 1, P.waterD).set(7, 10, P.waterD).set(14, 13, P.waterD);
  return p;
}

function bridge(): Pix {
  const p = tile(P.wood);
  for (let y = 0; y < D; y += 4) {
    p.rect(0, y + 3, D, 1, P.woodD);
    p.rect(0, y, D, 1, P.woodL);
  }
  p.rect(0, 0, 1, D, P.woodO).rect(15, 0, 1, D, P.woodO);
  p.set(3, 1, P.woodO).set(12, 5, P.woodO).set(6, 9, P.woodO).set(10, 13, P.woodO);
  return p;
}

function floor(): Pix {
  // Wide boards: a soft seam every 8 rows, one joint per board, a little grain.
  const p = tile(P.floor);
  const seam = mix(P.floor, P.floorD, 0.6);
  for (let y = 0; y < D; y += 8) {
    p.rect(0, y + 7, D, 1, seam);
    p.rect(y === 0 ? 4 : 12, y, 1, 7, seam);
    p.rect(y === 0 ? 9 : 2, y + 3, 3, 1, mix(P.floor, P.floorL, 0.7));
  }
  return p;
}

function doormat(): Pix {
  const p = floor();
  p.rect(2, 3, 12, 10, P.redD).rect(3, 4, 10, 8, P.red);
  for (let x = 3; x < 13; x += 2) p.set(x, 13, P.redD);
  p.rect(5, 6, 6, 1, hex('#f8b0a0')).rect(5, 9, 6, 1, hex('#f8b0a0'));
  return p;
}

/** The two halves (upper = `treetop`, lower = `trunk`) of a pine. */
function pine(): { top: Pix; bottom: Pix } {
  const art = [
    '      OO        ',
    '     OLGO       ',
    '    OLLGGO      ',
    '    OLGGGDO     ',
    '   OLLGGGDDO    ',
    '   OLGGGGGDO    ',
    '  OLLGGGGGDDO   ',
    '  OOLGGGGDDOO   ',
    '  OLLLGGGGDDDO  ',
    ' OLLGGGGGGGDDO  ',
    ' OLLGGGGGGGDDDO ',
    ' OOLGGGGGGDDDOO ',
    'OLLLGGGGGGGDDDDO',
    'OLLGGGGGGGGGDDDO',
    'OLGGGGGGGGGGDDDO',
    'OOLGGGGGGGGDDDOO',
    'OLLLGGGGGGGGDDDO',
    'OLLGGGGGGGGGGDDO',
    'OLGGGGGGGGGGGDDO',
    'OLGGGGGGGGGGDDDO',
    'ODGGGGGGGGGGDDDO',
    'ODDGGGGGGGGDDDDO',
    ' ODDDGGGGGDDDDO ',
    '  OODDDDDDDDOO  ',
    '    OOOOOOOO    ',
    '      OTtO      ',
    '      OTtO      ',
    '     OTTttO     ',
    '    ssOOOOss    ',
    '     ssssss     ',
    '                ',
    '                ',
  ];
  const full = new Pix(D, 2 * D).ascii(0, 0, art, {
    O: P.pineO,
    L: P.pineL,
    G: P.pine,
    D: P.pineD,
    T: P.trunk,
    t: P.trunkD,
    s: P.shadow,
  });
  // The crown is a little lopsided by design; centre it with a mirrored highlight-free copy for symmetry.
  return { top: full.crop(0, 0, D, D), bottom: full.crop(0, D, D, D) };
}

function flowers(): Pix {
  const p = tile();
  const f = ['.P.', 'PcP', '.P.'];
  const leaf = P.grassDD;
  const put = (x: number, y: number, petal: Rgba) => {
    p.ascii(x, y, f, { P: petal, c: P.yellow });
    p.set(x - 1, y + 2, leaf).set(x + 3, y + 2, leaf);
  };
  put(2, 2, P.red);
  put(10, 4, P.white);
  put(5, 10, P.white);
  put(12, 11, P.red);
  return p;
}

function bush(): Pix {
  const p = tile();
  p.ellipse(1, 2, 14, 13, P.pine);
  p.ellipse(2, 3, 7, 6, P.pineL);
  p.ellipse(3, 4, 5, 4, P.pine);
  p.ellipse(9, 9, 6, 5, P.pineD);
  p.set(4, 4, P.pineL).set(8, 6, P.pineL).set(11, 4, P.pineL).set(6, 10, P.pineD).set(10, 12, P.pineD);
  p.outline(P.pineO);
  p.rect(3, 15, 10, 1, P.shadow);
  return p;
}

function rock(): Pix {
  const p = tile();
  p.ellipse(1, 3, 14, 12, P.rock);
  p.ellipse(3, 4, 7, 5, P.rockL);
  p.ellipse(8, 9, 7, 5, P.rockD);
  p.set(6, 9, P.rockD).set(7, 10, P.rockD).set(8, 8, P.rockD);
  p.outline(P.rockO);
  return p;
}

function cactus(): Pix {
  const art = [
    '      OO        ',
    '     OGLO       ',
    '     OGLO       ',
    '     OGLO  OO   ',
    ' OO  OGLO OGLO  ',
    'OGLO OGLO OGLO  ',
    'OGLO OGLOOGLO   ',
    'OGLOOGGLOGLO    ',
    ' OGGGGGLGLO     ',
    '  OOOGGLOO      ',
    '     OGLO       ',
    '     OGLO       ',
    '     OGLO       ',
    '     OGDO       ',
    '    sOOOOs      ',
    '     ssss       ',
  ];
  return tile().ascii(0, 0, art, {
    O: hex('#1c4428'),
    G: hex('#48a050'),
    L: hex('#88d070'),
    D: hex('#2e7438'),
    s: P.shadow,
  });
}

function fence(): Pix {
  const art = [
    '                ',
    '                ',
    ' OO      OO     ',
    'OLWO    OLWO    ',
    'OWWOOOOOOWWOOOOO',
    'OWWLLLLLLWWLLLLL',
    'OWWWWWWWWWWWWWWW',
    'OWWDDDDDDWWDDDDD',
    'OWWOOOOOOWWOOOOO',
    'OWWLLLLLLWWLLLLL',
    'OWWWWWWWWWWWWWWW',
    'OWWDDDDDDWWDDDDD',
    'OWDOOOOOOWDOOOOO',
    'OWDO    OWDO    ',
    ' OO      OO     ',
    ' ss      ss     ',
  ];
  return tile().ascii(0, 0, art, { O: P.woodO, L: P.woodL, W: P.wood, D: P.woodD, s: P.shadow });
}

function fountain(): Pix {
  const p = plaza();
  p.ellipse(0, 2, 16, 13, P.rockO);
  p.ellipse(1, 3, 14, 11, P.rock);
  p.ellipse(2, 4, 12, 8, P.waterO);
  p.ellipse(3, 5, 10, 6, P.water);
  p.rect(4, 6, 3, 1, P.waterL).rect(9, 9, 3, 1, P.waterL);
  p.rect(7, 1, 2, 7, P.rockD).rect(6, 0, 4, 2, P.glassL).set(7, 2, P.foam).set(8, 3, P.foam);
  p.rect(1, 12, 14, 1, P.rockD);
  return p;
}

function mountain(face: boolean): Pix {
  // Rounded rock lumps (light top-left, dark bottom-right, dark outline) packed so the tile repeats seamlessly.
  const p = tile(P.cliffO);
  const lumps: [number, number, number, number][] = [
    [-3, -4, 10, 9],
    [6, -3, 11, 8],
    [-5, 4, 9, 8],
    [3, 3, 10, 9],
    [12, 4, 9, 8],
    [-2, 11, 10, 9],
    [7, 11, 11, 8],
  ];
  for (const [x, y, w, h] of lumps) {
    p.ellipse(x, y, w, h, P.cliffD);
    p.ellipse(x, y, w - 1, h - 1, P.cliff);
    p.ellipse(x + 1, y + 1, Math.floor(w / 2), Math.floor(h / 2), P.cliffL);
    p.ellipse(x + 1, y + 1, Math.floor(w / 2) - 1, Math.floor(h / 2) - 1, P.cliff);
  }
  if (face) {
    // Cliff foot: vertical rock face with a dark base line and a soft shadow.
    p.rect(0, 11, D, 4, P.cliffD);
    for (let x = 1; x < D; x += 4) p.rect(x, 11, 1, 4, P.cliffO).set(x + 1, 11, P.cliff);
    p.rect(0, 10, D, 1, P.cliffO);
    p.rect(0, 15, D, 1, P.shadow);
  }
  return p;
}

function counter(): Pix {
  const p = floor();
  p.rect(0, 2, D, 13, P.woodO);
  p.rect(0, 3, D, 4, P.woodL);
  p.rect(0, 7, D, 1, P.woodD);
  p.rect(0, 8, D, 6, P.wood);
  for (let x = 1; x < D; x += 5) p.rect(x, 9, 3, 4, P.woodD);
  p.rect(0, 15, D, 1, P.shadow);
  return p;
}

function desk(): Pix {
  const p = floor();
  p.rect(0, 6, D, 8, P.timberO);
  p.rect(0, 7, D, 3, hex('#e8e4dc'));
  p.rect(0, 10, D, 3, hex('#b8b4ac'));
  p.rect(1, 13, 2, 3, P.timberO).rect(13, 13, 2, 3, P.timberO);
  // Monitor.
  p.rect(4, 0, 9, 7, hex('#28283a'));
  p.rect(5, 1, 7, 4, hex('#58a8e8'));
  p.set(5, 1, hex('#a8e0ff')).set(6, 1, hex('#a8e0ff'));
  p.rect(7, 6, 3, 2, hex('#28283a'));
  p.rect(9, 8, 3, 1, hex('#3c3c4c'));
  return p;
}

function shelf(): Pix {
  const p = floor();
  p.rect(0, 0, D, D - 1, P.woodO);
  p.rect(1, 1, D - 2, D - 3, P.woodD);
  const books = [P.red, P.azul, P.yellow, hex('#58b058'), P.pink, P.azulL];
  for (const y of [1, 6]) {
    p.rect(1, y + 4, D - 2, 1, P.wood);
    for (let x = 2; x < D - 2; x += 2) p.rect(x, y + 1, 2, 3, books[(x + y) % books.length]!);
  }
  p.rect(2, 12, 3, 2, P.glassL).rect(10, 11, 4, 3, hex('#e8e4dc'));
  p.rect(0, 15, D, 1, P.shadow);
  return p;
}

function car(half: 'left' | 'right'): Pix {
  // Top view of the white Audi, nose to the right, over two tiles.
  const art = [
    '                                ',
    '                                ',
    '     OOOO              OOOO     ',
    '    OOkkOOOOOOOOOOOOOOOOkkOO    ',
    '   OWWWWWWWWWWWWWWWWWWWWWWWWOO  ',
    '  OrWWWWWWWWWWWWWWWWWWWWWWWWWWO ',
    '  OrWWWWggggWWWWWWWggggggWWWyO ',
    '  OWWWWWgGGgWWWWWWWgGGGGgWWWWWO ',
    '  OWWWWWgGGgWWWWWWWgGGGGgWWWWWO ',
    '  OrWWWWggggWWWWWWWggggggWWWyO ',
    '  OrWWWWWWWWWWWWWWWWWWWWWWWWWWO ',
    '   OddddddddddddddddddddddddOO  ',
    '    OOkkOOOOOOOOOOOOOOOOkkOO    ',
    '     OOOO              OOOO     ',
    '      ssssssssssssssssssss      ',
    '                                ',
  ];
  const full = new Pix(2 * D, D).ascii(0, 0, art, {
    O: hex('#30303c'),
    W: hex('#f8f8f4'),
    d: hex('#c8ccd8'),
    g: hex('#304868'),
    G: hex('#6890c0'),
    k: hex('#1c1c22'),
    r: P.red,
    y: P.yellow,
    s: P.shadow,
  });
  return half === 'left' ? full.crop(0, 0, D, D) : full.crop(D, 0, D, D);
}

/** Wall kinds a building facade can have. */
type WallKind = 'plaster' | 'white';

/** A facade tile; `row` = `u` top wall row (under the eave), `c` a middle row, `l` the bottom row (plinth). */
function wall(kind: WallKind, opts: { row: 'u' | 'c' | 'l'; col: 'l' | 'm' | 'r'; window: boolean }): Pix {
  const upper = opts.row === 'u';
  const bottom = opts.row === 'l';
  const plaster = kind === 'plaster';
  const base = plaster ? P.plaster : P.white;
  const dark = plaster ? P.plasterD : P.whiteD;
  const out = plaster ? P.timberO : P.whiteO;
  const p = tile(base);
  speckle(p, plaster ? 51 : 52, 4, dark);
  if (plaster) {
    // Timber beam at the top, a stone plinth at the bottom.
    if (upper) p.rect(0, 0, D, 2, P.timberD).rect(0, 2, D, 1, dark);
    else if (bottom)
      p.rect(0, 12, D, 1, P.timberD).rect(0, 13, D, 3, hex('#c8b898')).rect(0, 15, D, 1, hex('#a09070'));
  } else {
    if (upper) p.rect(0, 0, D, 2, dark);
    // Valencian tile band (azulejos) along the bottom of the lower row.
    else if (bottom) {
      p.rect(0, 11, D, 4, P.azul);
      for (let x = 0; x < D; x += 4)
        p.set(x + 1, 12, P.azulL)
          .set(x + 2, 13, P.azulL)
          .set(x, 14, hex('#305898'));
      p.rect(0, 15, D, 1, P.whiteO);
    }
  }
  if (opts.window) {
    const y = upper ? 4 : 2;
    p.rect(3, y, 10, 8, out);
    p.rect(4, y + 1, 8, 6, P.glass);
    p.rect(4, y + 1, 3, 1, P.glassL).set(4, y + 2, P.glassL);
    p.rect(4, y + 5, 8, 1, P.glassD);
    p.rect(8, y + 1, 1, 6, out);
    if (plaster) p.rect(2, y + 8, 12, 1, P.timberD);
    else {
      // Blue shutters.
      p.rect(1, y, 2, 8, P.azul).rect(13, y, 2, 8, P.azul);
    }
  }
  if (opts.col === 'l') p.rect(0, 0, 1, D, out).rect(1, 0, 1, D, plaster ? P.timber : dark);
  if (opts.col === 'r') p.rect(15, 0, 1, D, out).rect(14, 0, 1, D, plaster ? P.timber : dark);
  return p;
}

function door(kind: WallKind): Pix {
  const p = wall(kind, { row: 'l', col: 'm', window: false });
  const frame = kind === 'plaster' ? P.timberO : P.whiteO;
  p.rect(2, 0, 12, 16, frame);
  p.rect(3, 1, 10, 15, P.woodD);
  p.rect(3, 1, 4, 15, P.wood).rect(9, 1, 4, 15, P.wood);
  p.rect(8, 1, 1, 15, P.woodO);
  p.rect(3, 1, 10, 1, P.woodL);
  p.set(7, 8, P.yellow).set(9, 8, P.yellow);
  p.rect(1, 15, 14, 1, P.stoneD);
  return p;
}

/** Roof tile; `row` = top (ridge) / mid / bottom (eave), `col` = left / mid / right edge. */
function roof(colour: RoofColour, row: 't' | 'm' | 'b', col: 'l' | 'm' | 'r'): Pix {
  const c = ROOF_COLOURS[colour];
  const p = tile(c.b);
  for (let r = 0; r < 4; r += 1) {
    const off = r % 2 === 0 ? 0 : 2;
    for (let k = -1; k < 5; k += 1) {
      const x = k * 4 + off;
      const y = r * 4;
      p.set(x, y, c.l).set(x + 1, y, c.l);
      p.set(x, y + 2, c.d).set(x + 3, y + 2, c.d);
      p.rect(x, y + 3, 4, 1, c.d);
      p.set(x + 3, y + 3, c.o);
    }
  }
  if (row === 't') {
    p.rect(0, 0, D, 1, c.o).rect(0, 1, D, 2, c.l).rect(0, 3, D, 1, c.d);
  }
  if (row === 'b') {
    p.rect(0, 12, D, 1, c.d).rect(0, 13, D, 1, c.l).rect(0, 14, D, 1, c.d).rect(0, 15, D, 1, c.o);
  }
  if (col === 'l') p.rect(0, 0, 1, D, c.o).rect(1, row === 't' ? 1 : 0, 1, D - 1, c.l);
  if (col === 'r') p.rect(15, 0, 1, D, c.o).rect(14, row === 't' ? 1 : 0, 1, D - 1, c.d);
  return p;
}

function indoorWall(face: boolean): Pix {
  if (!face) {
    const p = tile(P.wallTop);
    p.rect(0, 0, D, 1, P.wallTopL).rect(0, 8, D, 1, P.wallTopL);
    return p;
  }
  const p = tile(P.paper);
  for (let x = 1; x < D; x += 4) p.rect(x, 2, 1, 10, P.paperD);
  p.rect(0, 0, D, 2, P.wallTop);
  p.rect(0, 12, D, 1, P.timberD).rect(0, 13, D, 2, P.timber).rect(0, 15, D, 1, P.timberO);
  return p;
}

function blocker(): Pix {
  return tile(P.blocker);
}

/** Sides of a tile (bit mask): north 1, east 2, south 4, west 8. */
export const SIDE = { n: 1, e: 2, s: 4, w: 8 } as const;

/** Draw the grass that overlaps a path/road/plaza on the sides in `mask` (a soft, irregular border). */
function grassBorder(p: Pix, mask: number, seed: number, line: Rgba): Pix {
  for (let k = 0; k < D; k += 1) {
    // Depth changes in runs of four pixels (1, 2, 2, 1, …) so the edge looks like a soft wavy line, not noise.
    const depth = [1, 2, 2, 1][(Math.floor(k / 4) + seed) % 4]!;
    const put = (x: number, y: number, d: number) => {
      if (d < depth) p.set(x, y, P.grass);
      else if (d === depth) p.set(x, y, line);
    };
    for (let d = 0; d <= depth; d += 1) {
      if (mask & SIDE.n) put(k, d, d);
      if (mask & SIDE.s) put(k, D - 1 - d, d);
      if (mask & SIDE.w) put(d, k, d);
      if (mask & SIDE.e) put(D - 1 - d, k, d);
    }
  }
  return p;
}

/** Shore: dark bank line and white foam on the water sides that touch land. */
function shore(p: Pix, mask: number): Pix {
  for (let k = 0; k < D; k += 1) {
    const foam = hash(k, 3, 9) > 0.35;
    if (mask & SIDE.n) p.set(k, 0, P.waterO).set(k, 1, foam ? P.foam : P.waterL);
    if (mask & SIDE.s) p.set(k, D - 1, P.waterO).set(k, D - 2, foam ? P.foam : P.waterL);
    if (mask & SIDE.w) p.set(0, k, P.waterO).set(1, k, foam ? P.foam : P.waterL);
    if (mask & SIDE.e) p.set(D - 1, k, P.waterO).set(D - 2, k, foam ? P.foam : P.waterL);
  }
  return p;
}

/** One tileset entry: its art and the Tiled properties of its base tile. */
export interface TileArt {
  /** Unique name, e.g. `grass` or `roof:blue:tl`. */
  key: string;
  draw: () => Pix;
}

/** The 32 base tiles in local-id order (must match `WT` in `make-world.ts`). */
export const BASE_TILES: TileArt[] = [
  { key: 'grass', draw: grass },
  { key: 'path', draw: path },
  { key: 'wall', draw: () => wall('plaster', { row: 'l', col: 'm', window: false }) },
  { key: 'water', draw: water },
  { key: 'trunk', draw: () => pine().bottom },
  { key: 'treetop', draw: () => pine().top },
  { key: 'flowers', draw: flowers },
  { key: 'tallgrass', draw: tallGrass },
  { key: 'blocker', draw: blocker },
  { key: 'door', draw: () => door('plaster') },
  { key: 'floor', draw: floor },
  { key: 'doormat', draw: doormat },
  { key: 'carLeft', draw: () => car('left') },
  { key: 'carRight', draw: () => car('right') },
  { key: 'sand', draw: sand },
  { key: 'dune', draw: dune },
  { key: 'mountain', draw: () => mountain(false) },
  { key: 'vineyard', draw: vineyard },
  { key: 'road', draw: road },
  { key: 'plaza', draw: plaza },
  { key: 'roof', draw: () => roof('terracotta', 'm', 'm') },
  { key: 'counter', draw: counter },
  { key: 'desk', draw: desk },
  { key: 'cactus', draw: cactus },
  { key: 'fence', draw: fence },
  { key: 'bridge', draw: bridge },
  { key: 'desert', draw: desert },
  { key: 'shelf', draw: shelf },
  { key: 'rock', draw: rock },
  { key: 'bush', draw: bush },
  { key: 'fountain', draw: fountain },
  { key: 'whiteWall', draw: () => wall('white', { row: 'l', col: 'm', window: false }) },
];

/** A variant tile: its art and the base tile key whose properties it copies. */
export interface VariantArt extends TileArt {
  base: string;
}

const ROWS3 = ['t', 'm', 'b'] as const;
const COLS3 = ['l', 'm', 'r'] as const;

function buildVariants(): VariantArt[] {
  const out: VariantArt[] = [];
  for (const colour of ROOF_ORDER)
    for (const r of ROWS3)
      for (const c of COLS3) {
        if (colour === 'terracotta' && r === 'm' && c === 'm') continue; // = base `roof`
        out.push({ key: `roof:${colour}:${r}${c}`, base: 'roof', draw: () => roof(colour, r, c) });
      }
  for (const [kind, base] of [
    ['plaster', 'wall'],
    ['white', 'whiteWall'],
  ] as const)
    for (const row of ['u', 'c', 'l'] as const)
      for (const c of COLS3)
        for (const win of [false, true]) {
          if (row === 'l' && c === 'm' && !win) continue; // = base tile
          if (win && c !== 'm') continue; // windows only on middle tiles
          const key = `${base}:${row}${c}${win ? 'w' : ''}`;
          out.push({ key, base, draw: () => wall(kind, { row, col: c, window: win }) });
        }
  out.push({ key: 'door:white', base: 'door', draw: () => door('white') });
  out.push({ key: 'wall:indoorFace', base: 'wall', draw: () => indoorWall(true) });
  out.push({ key: 'wall:indoorTop', base: 'wall', draw: () => indoorWall(false) });
  out.push({ key: 'mountain:face', base: 'mountain', draw: () => mountain(true) });
  for (let mask = 1; mask < 16; mask += 1) {
    out.push({ key: `path:${mask}`, base: 'path', draw: () => grassBorder(path(), mask, 1, P.grassD) });
    out.push({ key: `road:${mask}`, base: 'road', draw: () => grassBorder(road(), mask, 2, P.rockO) });
    out.push({ key: `plaza:${mask}`, base: 'plaza', draw: () => grassBorder(plaza(), mask, 3, P.grassD) });
    out.push({ key: `sand:${mask}`, base: 'sand', draw: () => grassBorder(sand(), mask, 4, P.grassD) });
    out.push({ key: `water:${mask}`, base: 'water', draw: () => shore(water(), mask) });
  }
  return out;
}

/** Every variant tile, in tileset order after the base tiles (local ids 32, 33, …). */
export const VARIANT_TILES: VariantArt[] = buildVariants();

/** Clear tile (kept for callers that need an empty 16 × 16). */
export function emptyTile(): Pix {
  return tile(CLEAR);
}

/** The 16 × 16 art of a tile by key (`grass`, `roof:teal:bl`, `whiteWall:umw`, …). */
export function tileArt(key: string): Pix {
  const t = [...BASE_TILES, ...VARIANT_TILES].find((a) => a.key === key);
  if (!t) throw new Error(`tiles: no tile "${key}"`);
  return t.draw();
}
