// M10 "Done when": reloading the page at any time brings back the position, team, bonuses, items, euros and
// NPC states; garbage in `flexymon.save.v1` does not crash the game: it starts fresh and keeps the broken copy.
// Plus: Start opens the menu and pauses the game (NPCs freeze); Equipo shows base + bonus and reorders the
// team; Mochila uses a Café and a Regleta; Opciones change and survive a reload; every save point shows
// "Guardando…"; the debug command deletes the save.
import { test, expect, type Page } from '@playwright/test';

interface Tile {
  map: string;
  x: number;
  y: number;
  facing: string;
  moving: boolean;
}
interface Menu {
  options: { label: string; enabled: boolean }[];
  cursor: number;
}
interface MenuView {
  ui: string;
  menu: Menu | null;
  detail: {
    name: string;
    stats: { stat: string; value: number; base: number; bonus: number }[];
    attacks: { id: string }[];
  } | null;
  options: { music: number; sfx: number; textSpeed: string; cursor: number };
  description: string;
  message: string | null;
  messageTyped: boolean;
}
interface Inst {
  uid: string;
  speciesId: string;
  bonus: { hp: number; attack: number; defense: number; speed: number };
  currentHp: number;
}
interface Party {
  team: Inst[];
  storage: Inst[];
  teamSlots: number;
}
type Hooks = Record<string, (...a: unknown[]) => unknown>;

const SAVE_KEY = 'flexymon.save.v1';
const BROKEN_KEY = 'flexymon.save.broken';

const hook = <T>(page: Page, name: string, ...args: unknown[]): Promise<T> =>
  page.evaluate(
    ([n, a]) => (window as unknown as { __E2E__: Hooks }).__E2E__[n as string]!(...(a as unknown[])),
    [name, args] as const,
  ) as Promise<T>;
const tile = (page: Page) => hook<Tile | null>(page, 'playerTile');
const menu = (page: Page) => hook<MenuView | null>(page, 'menu');
const party = (page: Page) => hook<Party>(page, 'party');
const stored = (page: Page, key: string) => page.evaluate((k) => localStorage.getItem(k), key);

/** Serve npcs.json with the shipped enemies as talkers (so the wandering becario never challenges). */
async function talkersOnly(page: Page): Promise<void> {
  await page.route('**/data/npcs.json', async (route) => {
    const res = await route.fetch();
    const list = ((await res.json()) as Record<string, unknown>[]).map((n) => {
      if (n.type !== 'enemy') return n;
      const talker: Record<string, unknown> = { ...n, type: 'talker' };
      for (const k of ['sight', 'team', 'reward', 'defeatDialogue']) delete talker[k];
      return talker;
    });
    await route.fulfill({ response: res, body: JSON.stringify(list) });
  });
}

/** Serve start.json with the player starting at `spawn`. */
async function startAt(page: Page, spawn: object): Promise<void> {
  await page.route('**/data/start.json', async (route) => {
    const res = await route.fetch();
    const start = (await res.json()) as Record<string, unknown>;
    await route.fulfill({ response: res, body: JSON.stringify({ ...start, spawn }) });
  });
}

/** Collect page errors and console errors from now on. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return errors;
}

/** Wait for the title, quick-start (continue / new game, M11) and wait until the player stands free in the overworld. */
async function enterGame(page: Page, expected: Partial<Tile> = {}): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __E2E__?: { preloadComplete(): boolean } }).__E2E__?.preloadComplete() === true,
  );
  // M11: the title replaced "Pulsa START"; quickStart() continues a save or starts at the spawn (no intro).
  await page.waitForFunction(() =>
    (window as unknown as { __E2E__: { quickStart(): boolean } }).__E2E__.quickStart(),
  );
  await standing(page, expected);
}

async function standing(page: Page, expected: Partial<Tile> = {}): Promise<void> {
  await expect
    .poll(async () => ({ ...(await tile(page)), locked: await hook<boolean>(page, 'overworldLocked') }))
    .toMatchObject({ ...expected, moving: false, locked: false });
}

/** Press a key after two animation frames (a box or menu ignores input on the frame it opens). */
async function press(page: Page, key: string): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );
  await page.keyboard.press(key);
  await page.waitForTimeout(80);
}

const FACING: Record<string, string> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

/** Walk one tile and wait until the step has finished (a tap in a new direction only turns: turn first). */
async function walk(page: Page, key: string, to: Partial<Tile>): Promise<void> {
  if ((await tile(page))?.facing !== FACING[key]) {
    await press(page, key);
    await standing(page, { facing: FACING[key] });
  }
  await press(page, key);
  await standing(page, to);
}

/** Press Start in the overworld and wait for the main menu. */
async function openMenu(page: Page): Promise<void> {
  await press(page, 'Enter');
  await expect.poll(async () => (await menu(page))?.ui).toBe('main');
}

/** Move the cursor of the open list to `index` with Up/Down. */
async function cursorTo(page: Page, index: number): Promise<void> {
  for (;;) {
    const m = (await menu(page))?.menu;
    if (!m) throw new Error('no menu open');
    if (m.cursor === index) return;
    await press(page, m.cursor < index ? 'ArrowDown' : 'ArrowUp');
  }
}

/**
 * Press A through the menu's message box; returns every text seen. Each box is first allowed to type out, and
 * after each A the next box (or none) must show before pressing again, so no stray A reaches the menu behind it.
 */
async function readMessages(page: Page): Promise<string[]> {
  const seen: string[] = [];
  await expect.poll(async () => (await menu(page))?.message ?? null).not.toBeNull();
  for (;;) {
    const m = await menu(page);
    if (!m?.message) return seen;
    seen.push(m.message);
    await expect.poll(async () => (await menu(page))?.messageTyped).toBe(true);
    await press(page, 'z');
    await expect.poll(async () => (await menu(page))?.message ?? null).not.toBe(m.message);
  }
}

/** Reload the page and continue the saved game (quick start on the title). */
async function reloadAndContinue(page: Page, expected: Partial<Tile>): Promise<void> {
  await page.reload();
  await enterGame(page, expected);
}

test('reloading at any time keeps position, team, bonuses, items, euros and NPC states', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await talkersOnly(page);
  const errors = watchErrors(page);
  await page.goto('/');
  await enterGame(page, { map: 'test', x: 15, y: 10 });
  // Entering the first map is a save point.
  await expect.poll(() => stored(page, SAVE_KEY)).not.toBeNull();

  await hook(page, 'patchState', {
    euros: 777,
    teamSlots: 3,
    team: [
      {
        uid: 'u1',
        speciesId: 'portatil',
        bonus: { hp: 4, attack: 2, defense: 1, speed: 0 },
        currentHp: 17,
      },
      { uid: 'u2', speciesId: 'raton', bonus: { hp: 0, attack: 0, defense: 0, speed: 3 }, currentHp: 0 },
    ],
    storage: [
      { uid: 'u3', speciesId: 'teclado', bonus: { hp: 1, attack: 1, defense: 1, speed: 1 }, currentHp: 9 },
    ],
    items: { cafe: 5, regleta: 2, llaves_audi: 1 },
    npcs: { becario_rio: 'cooldown' },
  });
  // Walk away from the spawn and turn, with no save point in between: a reload must still come back here.
  await walk(page, 'ArrowLeft', { x: 14, y: 10 });
  await walk(page, 'ArrowLeft', { x: 13, y: 10 });
  await press(page, 'ArrowUp');
  await standing(page, { x: 13, y: 10, facing: 'up' });
  const before = { tile: await tile(page), party: await party(page) };

  await reloadAndContinue(page, { map: 'test', x: 13, y: 10, facing: 'up' });
  expect(await tile(page)).toEqual(before.tile);
  expect(await party(page)).toEqual(before.party);
  expect(await hook(page, 'euros')).toBe(777);
  expect(await hook(page, 'items')).toEqual({ cafe: 5, regleta: 2, llaves_audi: 1 });
  expect(await hook(page, 'npcStates')).toEqual({ becario_rio: 'cooldown' });

  // One more step and a change no save point saw, then reload again.
  await walk(page, 'ArrowDown', { x: 13, y: 11 });
  await hook(page, 'setEuros', 123);
  await reloadAndContinue(page, { map: 'test', x: 13, y: 11 });
  expect(await hook(page, 'euros')).toBe(123);
  await page.screenshot({ path: testInfo.outputPath('m10-after-reload.png') });
  expect(errors).toEqual([]);
});

test('garbage in the save does not crash: a fresh game starts and the broken copy is kept', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  // Let the first load finish (WebKit reports assets cut off by a reload as page errors).
  await page.waitForFunction(
    () =>
      (window as unknown as { __E2E__?: { preloadComplete(): boolean } }).__E2E__?.preloadComplete() === true,
  );
  await page.evaluate((k) => localStorage.setItem(k, '{"version":1,"player":garbage'), SAVE_KEY);
  await page.reload();
  await enterGame(page, { map: 'test', x: 15, y: 10 });
  expect(await hook(page, 'currentScene')).toBe('Overworld');
  expect(await hook(page, 'euros')).toBe(200);
  expect((await party(page)).team.map((m) => m.speciesId)).toEqual(['portatil']);
  expect(await stored(page, BROKEN_KEY)).toBe('{"version":1,"player":garbage');
  // The first save point replaced the slot with a valid save.
  await expect.poll(async () => JSON.parse((await stored(page, SAVE_KEY)) ?? 'null')?.version).toBe(1);

  // Valid JSON that fails the schema is broken too.
  await page.evaluate((k) => localStorage.setItem(k, '{"version":1,"team":"nope"}'), SAVE_KEY);
  await page.reload();
  await enterGame(page, { map: 'test', x: 15, y: 10 });
  expect(await stored(page, BROKEN_KEY)).toBe('{"version":1,"team":"nope"}');
  expect(await hook(page, 'euros')).toBe(200);
  expect(errors).toEqual([]);
});

test('Start menu: pauses the game; Equipo shows base + bonus and reorders; closing saves', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await talkersOnly(page);
  await startAt(page, { map: 'test_east', x: 3, y: 3, facing: 'down' });
  const errors = watchErrors(page);
  await page.goto('/');
  await enterGame(page, { map: 'test_east', x: 3, y: 3 });
  await hook(page, 'patchState', {
    team: [
      { uid: 'u1', speciesId: 'portatil', bonus: { hp: 4, attack: 2, defense: 0, speed: 1 }, currentHp: 30 },
      { uid: 'u2', speciesId: 'raton', bonus: { hp: 0, attack: 0, defense: 0, speed: 0 }, currentHp: 30 },
    ],
  });

  await openMenu(page);
  expect((await menu(page))!.menu!.options.map((o) => o.label)).toEqual([
    'Equipo',
    'Mochila',
    'Mapa',
    'Opciones',
    'Cerrar',
  ]);
  expect(await hook(page, 'overworldLocked')).toBe(true);
  expect(
    await page.evaluate(() =>
      (
        window as unknown as { __GAME__: { scene: { isPaused(k: string): boolean } } }
      ).__GAME__.scene.isPaused('Overworld'),
    ),
  ).toBe(true);
  // Game time stops: the wandering becario does not move while the menu is open.
  const npcsBefore = await hook(page, 'npcs');
  await page.waitForTimeout(3500);
  expect(await hook(page, 'npcs')).toEqual(npcsBefore);
  await page.screenshot({ path: testInfo.outputPath('m10-menu.png') });

  // Equipo → Portátil's detail page: every stat as base + bonus, and its attacks.
  await press(page, 'z');
  await expect.poll(async () => (await menu(page))?.ui).toBe('team');
  expect((await menu(page))!.menu!.options.map((o) => o.label)).toEqual(['Portátil', 'Ratón']);
  await press(page, 'z');
  await expect.poll(async () => (await menu(page))?.ui).toBe('detail');
  const detail = (await menu(page))!.detail!;
  expect(detail.name).toBe('Portátil');
  expect(detail.stats).toEqual([
    { stat: 'hp', base: 40, bonus: 4, value: 44 },
    { stat: 'attack', base: 12, bonus: 2, value: 14 },
    { stat: 'defense', base: 10, bonus: 0, value: 10 },
    { stat: 'speed', base: 11, bonus: 1, value: 12 },
  ]);
  expect(detail.attacks.map((a) => a.id)).toEqual(['compilar', 'pantallazo_azul', 'actualizacion']);
  await page.screenshot({ path: testInfo.outputPath('m10-detail.png') });

  // Mover → second place: Ratón is now sent into battle first.
  await press(page, 'z');
  await expect.poll(async () => (await menu(page))?.ui).toBe('move');
  await cursorTo(page, 1);
  await press(page, 'z');
  await expect.poll(async () => (await party(page)).team.map((m) => m.uid)).toEqual(['u2', 'u1']);
  expect((await menu(page))?.ui).toBe('team');

  // B back to the main menu, Start closes: a save point with the "Guardando…" icon.
  await press(page, 'x');
  await expect.poll(async () => (await menu(page))?.ui).toBe('main');
  const savesBefore = (await hook<string[]>(page, 'savesWritten')).length;
  await press(page, 'Enter');
  await expect.poll(() => menu(page)).toBeNull();
  await expect.poll(() => hook<boolean>(page, 'saveIcon')).toBe(true);
  expect((await hook<string[]>(page, 'savesWritten')).slice(savesBefore)).toEqual(['menu']);
  await page.screenshot({ path: testInfo.outputPath('m10-saving.png') });
  await expect.poll(() => hook<boolean>(page, 'saveIcon'), { timeout: 3000 }).toBe(false);
  expect(JSON.parse((await stored(page, SAVE_KEY))!).team.map((m: Inst) => m.uid)).toEqual(['u2', 'u1']);
  await standing(page, { x: 3, y: 3 });
  // The game runs again: the player can walk.
  await walk(page, 'ArrowDown', { x: 3, y: 4 });
  expect(errors).toEqual([]);
});

test('Mochila: a Café heals a team member, a Regleta adds a slot, others are greyed; Mapa is a placeholder', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const errors = watchErrors(page);
  await page.goto('/');
  await enterGame(page, { map: 'test', x: 15, y: 10 });
  await hook(page, 'patchState', {
    team: [
      { uid: 'u1', speciesId: 'portatil', bonus: { hp: 0, attack: 0, defense: 0, speed: 0 }, currentHp: 10 },
    ],
    items: { cafe: 2, redbull: 1, regleta: 1 },
  });

  await openMenu(page);
  await cursorTo(page, 1);
  await press(page, 'z');
  await expect.poll(async () => (await menu(page))?.ui).toBe('bag');
  const bag = (await menu(page))!;
  expect(bag.menu!.options).toEqual([
    { label: 'Café', enabled: true },
    { label: 'Lata energética', enabled: false },
    { label: 'Regleta', enabled: true },
  ]);
  expect(bag.description).toBe('Recupera 20 PS.');
  await page.screenshot({ path: testInfo.outputPath('m10-bag.png') });

  // Café → Portátil: +20 HP, one Café used.
  await press(page, 'z');
  await expect.poll(async () => (await menu(page))?.ui).toBe('bag_target');
  await press(page, 'z');
  expect(await readMessages(page)).toEqual(['Usas Café con Portátil.', 'Portátil recupera 20 PS.']);
  await expect.poll(async () => (await menu(page))?.ui).toBe('bag');
  expect((await party(page)).team[0]!.currentHp).toBe(30);
  expect(await hook(page, 'items')).toEqual({ cafe: 1, redbull: 1, regleta: 1 });

  // The greyed Lata energética cannot be chosen; its description still shows.
  await cursorTo(page, 1);
  expect((await menu(page))!.description).toBe('Sube el ataque 3 turnos.');
  await press(page, 'z');
  expect((await menu(page))?.ui).toBe('bag');

  // Regleta: used at once, 3 slots.
  await cursorTo(page, 2);
  await press(page, 'z');
  expect(await readMessages(page)).toEqual(['Usas Regleta.', 'Tu equipo tiene ahora 3 plazas.']);
  expect((await party(page)).teamSlots).toBe(3);
  expect(await hook(page, 'items')).toEqual({ cafe: 1, redbull: 1 });

  // B back, then Mapa shows its placeholder.
  await expect.poll(async () => (await menu(page))?.ui).toBe('bag');
  await press(page, 'x');
  await expect.poll(async () => (await menu(page))?.ui).toBe('main');
  await cursorTo(page, 2);
  await press(page, 'z');
  expect(await readMessages(page)).toEqual(['El mapa todavía no está listo.']);
  await expect.poll(async () => (await menu(page))?.ui).toBe('main');
  await press(page, 'x');
  await expect.poll(() => menu(page)).toBeNull();
  expect(errors).toEqual([]);
});

test('Opciones: volumes and text speed change, apply and survive a reload', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const errors = watchErrors(page);
  await page.goto('/');
  await enterGame(page, { map: 'test', x: 15, y: 10 });
  expect(await hook(page, 'options')).toEqual({ music: 10, sfx: 10, textSpeed: 'normal' });

  await openMenu(page);
  await cursorTo(page, 3);
  await press(page, 'z');
  await expect.poll(async () => (await menu(page))?.ui).toBe('options');
  // Música 10 → 8, Efectos 10 → 9, Texto normal → rápida (and it stops there).
  await press(page, 'ArrowLeft');
  await press(page, 'ArrowLeft');
  await press(page, 'ArrowDown');
  await press(page, 'ArrowLeft');
  await press(page, 'ArrowDown');
  await press(page, 'ArrowRight');
  await press(page, 'ArrowRight');
  await expect
    .poll(async () => (await menu(page))?.options)
    .toEqual({ music: 8, sfx: 9, textSpeed: 'fast', cursor: 2 });
  expect(await hook(page, 'musicGain')).toBeCloseTo(0.8);
  expect(JSON.parse((await stored(page, 'flexymon.options'))!)).toEqual({
    music: 8,
    sfx: 9,
    textSpeed: 'fast',
  });
  await page.screenshot({ path: testInfo.outputPath('m10-options.png') });

  // Volver (A) returns to the main menu; B closes.
  await press(page, 'ArrowDown');
  await press(page, 'z');
  await expect.poll(async () => (await menu(page))?.ui).toBe('main');
  await press(page, 'x');
  await expect.poll(() => menu(page)).toBeNull();

  await page.reload();
  await enterGame(page, { map: 'test', x: 15, y: 10 });
  expect(await hook(page, 'options')).toEqual({ music: 8, sfx: 9, textSpeed: 'fast' });
  expect(await hook(page, 'musicGain')).toBeCloseTo(0.8);
  expect(errors).toEqual([]);
});

test('text speed: rápida types faster than lenta', async ({ page }) => {
  test.setTimeout(60_000);
  await startAt(page, { map: 'test_house', x: 6, y: 5, facing: 'up' });
  await page.goto('/');
  await enterGame(page, { map: 'test_house', x: 6, y: 5 });
  const typedAfter = async (speed: string): Promise<number> => {
    await hook(page, 'setOptions', { music: 10, sfx: 10, textSpeed: speed });
    await press(page, 'z'); // talk to the camarero
    await expect.poll(() => hook<{ text: string } | null>(page, 'dialogue')).not.toBeNull();
    await page.waitForTimeout(300);
    const n = (await hook<{ text: string }>(page, 'dialogue')).text.length;
    while (await hook(page, 'dialogue')) await press(page, 'z');
    await standing(page);
    return n;
  };
  const slow = await typedAfter('slow');
  const fast = await typedAfter('fast');
  expect(fast).toBeGreaterThan(slow);
});

test('map entry and the end of a battle are save points (the menu one is checked above)', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto('/');
  await enterGame(page, { map: 'test', x: 15, y: 10 });
  await expect.poll(() => hook<string[]>(page, 'savesWritten')).toEqual(['map']);
  expect(await hook(page, 'startBattle', 1, 'raton')).toBe(true);
  await expect.poll(() => hook<string | null>(page, 'currentScene')).toBe('Battle');
  // Flee (Huir), then the battle end is a save point.
  while ((await hook<{ ui: string }>(page, 'battle'))?.ui !== 'main') await press(page, 'z');
  await press(page, 'ArrowDown');
  await press(page, 'ArrowRight');
  await press(page, 'z');
  while ((await hook<string | null>(page, 'currentScene')) === 'Battle') await press(page, 'z');
  await standing(page, { x: 15, y: 10 });
  await expect.poll(() => hook<string[]>(page, 'savesWritten')).toEqual(['map', 'battle']);
  expect(await hook(page, 'saveRequests')).toContain('battle');
});

test('debug "Borrar partida" deletes the save and the next start is a new game', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/?debug=1');
  await enterGame(page, { map: 'test', x: 15, y: 10 });
  await hook(page, 'setEuros', 555);
  await openMenu(page);
  await press(page, 'x'); // close: save point
  await expect.poll(async () => JSON.parse((await stored(page, SAVE_KEY)) ?? 'null')?.euros).toBe(555);

  await press(page, 'F2');
  await press(page, 'F2');
  await expect.poll(() => hook<string>(page, 'debugMode')).toBe('menu');
  for (let i = 0; i < 3; i += 1) await press(page, 'ArrowUp'); // wraps: last three are the options
  await expect
    .poll(async () => (await hook<string[]>(page, 'debugLines'))!.find((l) => l.startsWith('>')))
    .toBe('> Borrar partida');
  await Promise.all([page.waitForEvent('load'), page.keyboard.press('z')]);
  await page.waitForFunction(
    () =>
      (window as unknown as { __E2E__?: { preloadComplete(): boolean } }).__E2E__?.preloadComplete() === true,
  );
  expect(await stored(page, SAVE_KEY)).toBeNull();
  // M11: the title replaced "Pulsa START"; quickStart() continues a save or starts at the spawn (no intro).
  await page.waitForFunction(() =>
    (window as unknown as { __E2E__: { quickStart(): boolean } }).__E2E__.quickStart(),
  );
  await standing(page, { map: 'test', x: 15, y: 10 });
  expect(await hook(page, 'euros')).toBe(200);
});
