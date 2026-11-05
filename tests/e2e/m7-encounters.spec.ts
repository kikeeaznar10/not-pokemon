// M7 "Done when": with rate 100 every step on grass starts a battle except the 3 safe steps after one;
// catching a second Ratón merges and shows which stat rose; with a full team a caught flexymon goes to
// storage with a message. Plus: an `all` (crowd) rectangle rolls on any tile, a `tiles` rectangle only
// on tall grass, a new species joins the team, and the debug option switches encounters off.
// Rates and the start position are changed by intercepting zones.json / start.json (no code change).
import { test, expect, type Page } from '@playwright/test';
import { neutralIntro } from './neutral-intro';

interface Tile {
  map: string;
  x: number;
  y: number;
  facing: string;
  moving: boolean;
}
interface BattleView {
  kind: string;
  phase: string;
  result: string | null;
  ui: string;
  menu: { options: { label: string; enabled: boolean }[]; cursor: number } | null;
  message: string | null;
  opponent: { speciesId: string };
}
interface Member {
  uid: string;
  speciesId: string;
  currentHp: number;
  bonus: Record<string, number>;
}
interface Party {
  team: Member[];
  storage: Member[];
  teamSlots: number;
}
type Hooks = Record<string, (...a: unknown[]) => unknown>;

const hook = <T>(page: Page, name: string, ...args: unknown[]): Promise<T> =>
  page.evaluate(
    ([n, a]) => (window as unknown as { __E2E__: Hooks }).__E2E__[n as string]!(...(a as unknown[])),
    [name, args] as const,
  ) as Promise<T>;
const tile = (page: Page) => hook<Tile | null>(page, 'playerTile');
const battle = (page: Page) => hook<BattleView | null>(page, 'battle');
const party = (page: Page) => hook<Party>(page, 'party');

const STAT_LABEL: Record<string, string> = {
  hp: 'PS',
  attack: 'Ataque',
  defense: 'Defensa',
  speed: 'Velocidad',
};
const DELTA: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};
const FACING: Record<string, string> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

async function standing(page: Page, expected: Partial<Tile> = {}): Promise<void> {
  await expect
    .poll(async () => ({ ...(await tile(page)), locked: await hook<boolean>(page, 'overworldLocked') }))
    .toMatchObject({ ...expected, moving: false, locked: false });
}

/** Serve zones.json with every encounter rate of `test` set to `rate`, and start the game at `spawn`. */
async function patchData(page: Page, rate: number | null, spawn?: object): Promise<void> {
  if (rate !== null) {
    await page.route('**/data/zones.json', async (route) => {
      const res = await route.fetch();
      const zones = (await res.json()) as { id: string; encounters: Record<string, { rate: number }> }[];
      for (const g of Object.values(zones.find((z) => z.id === 'test')!.encounters)) g.rate = rate;
      await route.fulfill({ response: res, body: JSON.stringify(zones) });
    });
  }
  if (spawn) {
    await page.route('**/data/start.json', async (route) => {
      const res = await route.fetch();
      const start = (await res.json()) as Record<string, unknown>;
      await route.fulfill({ response: res, body: JSON.stringify({ ...start, spawn }) });
    });
    // M11: the intro must fit the spawn's map at boot (see neutral-intro.ts).
    await neutralIntro(page, (spawn as { map: string }).map);
  }
}

async function enterOverworld(page: Page, expected: Partial<Tile>, url = '/'): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto(url);
  await page.waitForFunction(
    () =>
      (window as unknown as { __E2E__?: { preloadComplete(): boolean } }).__E2E__?.preloadComplete() === true,
  );
  // M11: the title replaced "Pulsa START"; quickStart() continues a save or starts at the spawn (no intro).
  await page.waitForFunction(() =>
    (window as unknown as { __E2E__: { quickStart(): boolean } }).__E2E__.quickStart(),
  );
  await standing(page, expected);
  return errors;
}

/**
 * Press a key and give the game a few frames to see it. First wait two animation frames, so at least one
 * game update ran since the last state read: a menu ignores input on the frame it opens, and a press
 * landing in that frame would be lost (this made the M6 tests flaky under load).
 */
async function press(page: Page, key: string): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );
  await page.keyboard.press(key);
  await page.waitForTimeout(80);
}

/**
 * Take one step with `key` (turning first if needed). Resolves `'walk'` once the player stands on the
 * next tile with input unlocked, or `'battle'` as soon as a battle starts instead.
 */
async function step(page: Page, key: string): Promise<'walk' | 'battle'> {
  const before = (await tile(page))!;
  if (before.facing !== FACING[key]) {
    await page.keyboard.press(key);
    await standing(page, { facing: FACING[key] });
  }
  const [dx, dy] = DELTA[key]!;
  const target = { x: before.x + dx, y: before.y + dy };
  await page.keyboard.press(key);
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const t = await tile(page);
    const locked = await hook<boolean>(page, 'overworldLocked');
    if (t && t.x === target.x && t.y === target.y && !t.moving) {
      if (locked) {
        await expect.poll(() => battle(page), { timeout: 5000 }).not.toBeNull();
        return 'battle';
      }
      return 'walk';
    }
    if (await battle(page)) return 'battle';
    await page.waitForTimeout(20);
  }
  throw new Error(`step ${key}: never reached ${JSON.stringify(target)}`);
}

/**
 * Press A through messages until the battle shows one of `uis` with a menu (or the overworld is back
 * when `uis` contains `'over'`). Returns the messages seen and the last battle view.
 */
async function advance(page: Page, uis: string[]): Promise<{ messages: string[]; last: BattleView | null }> {
  const messages: string[] = [];
  let last: BattleView | null = null;
  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    const v = await battle(page);
    if (v) last = v;
    if (!v) {
      if (uis.includes('over') && (await tile(page)) && !(await hook<boolean>(page, 'overworldLocked'))) {
        return { messages, last };
      }
    } else if (uis.includes(v.ui) && v.menu) {
      return { messages, last };
    } else if (v.message) {
      if (messages.at(-1) !== v.message) messages.push(v.message);
      await press(page, 'z');
      continue;
    }
    await page.waitForTimeout(50);
  }
  throw new Error(`advance: never reached ${uis.join('/')} (last ${JSON.stringify(last)})`);
}

/** In a battle that just started: play the intro, choose Huir, and wait for the overworld. */
async function flee(page: Page): Promise<void> {
  await advance(page, ['main']);
  await press(page, 'ArrowRight');
  await press(page, 'ArrowDown');
  await expect.poll(async () => (await battle(page))?.menu?.cursor).toBe(3);
  await press(page, 'z');
  await advance(page, ['over']);
  await standing(page);
}

/**
 * Win a wild battle against `speciesId` with the team `members` (first is Portátil), retrying other
 * seeds after a loss. Resolves when the catch choice is showing.
 */
async function winUntilCatch(page: Page, members: object[], speciesId: string): Promise<void> {
  for (let seed = 1; seed <= 15; seed++) {
    await hook(page, 'setTeam', members);
    expect(await hook<boolean>(page, 'startBattle', seed, speciesId)).toBe(true);
    let r = await advance(page, ['main']);
    for (let round = 0; round < 15; round++) {
      const v = (await battle(page))!;
      if (v.ui === 'team')
        await press(page, 'z'); // forced switch: first one still standing
      else {
        await expect.poll(async () => (await battle(page))?.menu?.cursor).toBe(0);
        await press(page, 'z');
        await expect.poll(async () => (await battle(page))?.ui).toBe('attack');
        await press(page, 'z');
      }
      r = await advance(page, ['main', 'team', 'catch', 'over']);
      const now = await battle(page);
      if (now?.ui === 'catch') return;
      if (!now) break; // lost: try another seed
    }
    expect(r.last?.result).not.toBe('win');
    await standing(page);
  }
  throw new Error('winUntilCatch: never won');
}

test('rate 100: every step on grass starts a battle except the 3 safe steps after one', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await patchData(page, 100, { map: 'test', x: 20, y: 2, facing: 'right' });
  const errors = await enterOverworld(page, { map: 'test', x: 20, y: 2 });
  expect(await hook<number>(page, 'safeSteps')).toBe(3);
  await page.screenshot({ path: testInfo.outputPath(`grass-${testInfo.project.name}.png`) });

  // Map entry: 3 safe steps on grass, then the 4th grass step starts a battle.
  expect(await step(page, 'ArrowRight')).toBe('walk'); // (21, 2)
  expect(await step(page, 'ArrowRight')).toBe('walk'); // (22, 2)
  expect(await step(page, 'ArrowRight')).toBe('walk'); // (23, 2)
  expect(await hook<number>(page, 'safeSteps')).toBe(0);
  expect(await step(page, 'ArrowDown')).toBe('battle'); // (23, 3)
  expect((await battle(page))!.kind).toBe('wild');
  await flee(page);
  expect(await tile(page)).toMatchObject({ x: 23, y: 3 });
  expect(await hook<number>(page, 'safeSteps')).toBe(3);

  // After a battle: 3 safe steps; plain grass inside a `tiles` rectangle never rolls.
  expect(await step(page, 'ArrowLeft')).toBe('walk'); // (22, 3)
  expect(await step(page, 'ArrowLeft')).toBe('walk'); // (21, 3)
  expect(await step(page, 'ArrowLeft')).toBe('walk'); // (20, 3)
  expect(await step(page, 'ArrowLeft')).toBe('walk'); // (19, 3): no tall grass
  expect(await step(page, 'ArrowUp')).toBe('walk'); // (19, 2): no tall grass
  expect(await step(page, 'ArrowRight')).toBe('battle'); // (20, 2): grass again
  await flee(page);

  // Holding a direction: the player still stops on the grass tile where the battle starts.
  expect(await step(page, 'ArrowDown')).toBe('walk'); // (20, 3)
  expect(await step(page, 'ArrowDown')).toBe('walk'); // (20, 4)
  expect(await step(page, 'ArrowDown')).toBe('walk'); // (20, 5)
  await page.keyboard.down('ArrowRight');
  await expect.poll(() => battle(page), { timeout: 5000 }).not.toBeNull();
  await page.keyboard.up('ArrowRight');
  await flee(page);
  expect(await tile(page)).toMatchObject({ x: 21, y: 5, moving: false });
  expect(errors).toEqual([]);
});

test('an `all` (crowd) rectangle starts battles on any tile', async ({ page }) => {
  test.setTimeout(60_000);
  await patchData(page, 100, { map: 'test', x: 4, y: 14, facing: 'left' });
  const errors = await enterOverworld(page, { map: 'test', x: 4, y: 14 });
  expect(await step(page, 'ArrowLeft')).toBe('walk'); // (3, 14) safe
  expect(await step(page, 'ArrowLeft')).toBe('walk'); // (2, 14) safe
  expect(await step(page, 'ArrowLeft')).toBe('walk'); // (1, 14) safe
  expect(await step(page, 'ArrowUp')).toBe('battle'); // (1, 13): plain grass, crowd rectangle
  expect((await battle(page))!.opponent.speciesId).toBe('raton'); // the only flexymon of that group
  await flee(page);
  expect(errors).toEqual([]);
});

test('the debug menu switches encounters off', async ({ page }) => {
  test.setTimeout(60_000);
  await patchData(page, 100, { map: 'test', x: 20, y: 2, facing: 'right' });
  const errors = await enterOverworld(page, { map: 'test', x: 20, y: 2 }, '/?debug=1');
  await press(page, 'F2');
  await press(page, 'F2');
  await expect.poll(() => hook<string>(page, 'debugMode')).toBe('menu');
  await press(page, 'ArrowUp'); // wraps to the last entry (M8's "NPC: todos listos")…
  await press(page, 'ArrowUp'); // …the one above it is the encounters option (M10's "Borrar partida" is first)
  await expect
    .poll(async () => (await hook<string[]>(page, 'debugLines'))!.slice(-4))
    .toEqual(['Opciones', '  Borrar partida', '> Encuentros: sí', '  NPC: todos listos']);
  await press(page, 'z');
  await expect.poll(() => hook<boolean>(page, 'encountersEnabled')).toBe(false);
  expect((await hook<string[]>(page, 'debugLines'))!.at(-2)).toBe('> Encuentros: no');
  await press(page, 'F2'); // close
  await expect.poll(() => hook<string>(page, 'debugMode')).toBe('hidden');
  for (const key of ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'ArrowLeft']) {
    expect(await step(page, key)).toBe('walk');
  }
  await hook(page, 'setEncounters', true);
  expect(await step(page, 'ArrowLeft')).toBe('battle');
  await flee(page);
  expect(errors).toEqual([]);
});

test('catching a second Ratón merges it and shows which stat rose', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors = await enterOverworld(page, { map: 'test', x: 15, y: 10 });
  await winUntilCatch(page, [{ speciesId: 'portatil' }, { speciesId: 'raton' }], 'raton');
  const v = (await battle(page))!;
  expect(v.menu!.options.map((o) => o.label)).toEqual(['Llevármelo', 'Dejarlo']);
  await page.screenshot({ path: testInfo.outputPath(`catch-${testInfo.project.name}.png`) });
  const before = (await party(page)).team.find((m) => m.speciesId === 'raton')!;
  await press(page, 'z');
  const { messages } = await advance(page, ['over']);
  expect(messages).toHaveLength(1);
  const m = /^¡Ratón se ha fusionado! (PS|Ataque|Defensa|Velocidad) \+(\d+)$/.exec(messages[0]!);
  expect(m, messages[0]).not.toBeNull();
  const after = await party(page);
  expect(after.team).toHaveLength(2);
  expect(after.storage).toEqual([]);
  const raton = after.team.find((x) => x.uid === before.uid)!;
  const stat = Object.keys(STAT_LABEL).find((k) => STAT_LABEL[k] === m![1])!;
  expect(raton.bonus[stat]).toBe(before.bonus[stat]! + Number(m![2]));
  for (const k of Object.keys(STAT_LABEL)) if (k !== stat) expect(raton.bonus[k]).toBe(before.bonus[k]);
  expect(errors).toEqual([]);
});

test('a new flexymon joins the team; with a full team it goes to storage with a message', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors = await enterOverworld(page, { map: 'test', x: 15, y: 10 });

  // One free slot (teamSlots 2): Ratón joins the team.
  await winUntilCatch(page, [{ speciesId: 'portatil' }], 'raton');
  await press(page, 'z');
  expect((await advance(page, ['over'])).messages).toEqual(['¡Ratón se une a tu equipo!']);
  let p = await party(page);
  expect(p.team.map((m) => m.speciesId)).toEqual(['portatil', 'raton']);

  // Full team (2 of 2): Ratón goes to the storage box.
  await winUntilCatch(page, [{ speciesId: 'portatil' }, { speciesId: 'teclado' }], 'raton');
  await press(page, 'z');
  expect((await advance(page, ['over'])).messages).toEqual([
    'Tu equipo está lleno. Ratón se ha enviado a la caja.',
  ]);
  p = await party(page);
  expect(p.team.map((m) => m.speciesId)).toEqual(['portatil', 'teclado']);
  expect(p.storage.map((m) => m.speciesId)).toEqual(['raton']);
  expect(p.storage[0]!.bonus).toEqual({ hp: 0, attack: 0, defense: 0, speed: 0 });

  // Dejarlo leaves everything as it was.
  await winUntilCatch(page, [{ speciesId: 'portatil' }], 'teclado');
  await press(page, 'ArrowDown');
  await press(page, 'z');
  expect((await advance(page, ['over'])).messages).toEqual([]);
  expect((await party(page)).team.map((m) => m.speciesId)).toEqual(['portatil']);
  expect(errors).toEqual([]);
});
