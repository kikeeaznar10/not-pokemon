// M15 "Audio, polish": audio unlocks on the first input; interface sounds (cursor, confirm, cancel, error, money)
// play at the effects volume; the debug menu gives euros and items and reloads every JSON without a page reload
// (a broken file shows its error and keeps the old data). Runs on the frozen test world (playwright.config.ts).
import { test, expect, type Page } from '@playwright/test';
import { neutralIntro } from './neutral-intro';

type Hooks = Record<string, (...a: unknown[]) => unknown>;
interface Tile {
  map: string;
  x: number;
  y: number;
  facing: string;
  moving: boolean;
}

const hook = <T>(page: Page, name: string, ...args: unknown[]): Promise<T> =>
  page.evaluate(
    ([n, a]) => (window as unknown as { __E2E__: Hooks }).__E2E__[n as string]!(...(a as unknown[])),
    [name, args] as const,
  ) as Promise<T>;
const tile = (page: Page) => hook<Tile | null>(page, 'playerTile');
const sounds = (page: Page) => hook<string[]>(page, 'uiSounds');
const debugLines = async (page: Page) => (await hook<string[] | null>(page, 'debugLines')) ?? [];

/** Press a key after two animation frames (a box or menu ignores input on the frame it opens). */
async function press(page: Page, key: string): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );
  await page.keyboard.press(key);
  await page.waitForTimeout(80);
}

/**
 * Run `action` and wait until exactly `expected` interface sounds followed it (polled: under load the game may
 * need a few frames to handle the key). The history only grows (it keeps the last 100).
 */
async function expectSounds(page: Page, action: () => Promise<void>, expected: string[]): Promise<void> {
  const before = (await sounds(page)).length;
  await action();
  await expect.poll(async () => (await sounds(page)).slice(before)).toEqual(expected);
}

async function boot(page: Page, url = '/'): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().includes('Reload:')) errors.push(msg.text());
  });
  await page.goto(url);
  await page.waitForFunction(
    () =>
      (window as unknown as { __E2E__?: { preloadComplete(): boolean } }).__E2E__?.preloadComplete() === true,
  );
  return errors;
}

async function standing(page: Page, expected: Partial<Tile> = {}): Promise<void> {
  await expect
    .poll(async () => ({ ...(await tile(page)), locked: await hook<boolean>(page, 'overworldLocked') }))
    .toMatchObject({ ...expected, moving: false, locked: false });
}

/** Into the overworld at the spawn without the intro (M11's `quickStart`). */
async function quickStart(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    (window as unknown as { __E2E__: { quickStart(): boolean } }).__E2E__.quickStart(),
  );
  await standing(page);
}

/** Open the F2 menu and move the cursor (with Up, which wraps) to the entry `label`. */
async function selectDebug(page: Page, label: string): Promise<void> {
  if ((await hook<string>(page, 'debugMode')) !== 'menu') {
    await press(page, 'F2');
    await press(page, 'F2');
  }
  await expect.poll(() => hook<string>(page, 'debugMode')).toBe('menu');
  for (let i = 0; i < 200; i += 1) {
    if ((await debugLines(page)).includes(`> ${label}`)) return;
    await press(page, 'ArrowUp');
  }
  throw new Error(`debug entry "${label}" not found`);
}

test('audio unlocks on the first key press; the title plays confirm', async ({ page }) => {
  const errors = await boot(page);
  await expect.poll(() => hook<string | null>(page, 'currentScene')).toBe('Title');
  expect((await hook<{ unlockRequested: boolean }>(page, 'audio')).unlockRequested).toBe(false);
  expect(await sounds(page)).toEqual([]);
  await press(page, 'Enter');
  await expect
    .poll(() => hook<{ unlockRequested: boolean; locked: boolean }>(page, 'audio'))
    .toMatchObject({ unlockRequested: true, locked: false });
  expect(await sounds(page)).toEqual(['confirm']);
  expect(errors).toEqual([]);
});

test('menus play cursor / confirm / cancel at the effects volume', async ({ page }) => {
  const errors = await boot(page);
  await quickStart(page);
  await hook(page, 'setOptions', { music: 10, sfx: 4, textSpeed: 'normal' });

  await press(page, 'Enter'); // Start menu
  await expect.poll(async () => (await hook<{ ui: string } | null>(page, 'menu'))?.ui).toBe('main');
  await expectSounds(page, () => press(page, 'ArrowDown'), ['cursor']);
  expect(await hook(page, 'lastUiSound')).toEqual({ kind: 'cursor', volume: 0.4 });
  await expectSounds(page, () => press(page, 'ArrowUp'), ['cursor']);
  await expectSounds(page, () => press(page, 'z'), ['confirm']); // Equipo
  await expect.poll(async () => (await hook<{ ui: string } | null>(page, 'menu'))?.ui).toBe('team');
  await expectSounds(page, () => press(page, 'x'), ['cancel']);
  await expect.poll(async () => (await hook<{ ui: string } | null>(page, 'menu'))?.ui).toBe('main');

  // Opciones: a changed effects volume is heard at once (the cursor sound plays after the change).
  for (let i = 0; i < 3; i += 1) await expectSounds(page, () => press(page, 'ArrowDown'), ['cursor']);
  await press(page, 'z');
  await expect.poll(async () => (await hook<{ ui: string } | null>(page, 'menu'))?.ui).toBe('options');
  await expectSounds(page, () => press(page, 'ArrowDown'), ['cursor']); // Efectos
  await expectSounds(page, () => press(page, 'ArrowRight'), ['cursor']);
  expect(await hook(page, 'lastUiSound')).toEqual({ kind: 'cursor', volume: 0.5 });
  expect(errors).toEqual([]);
});

test('the shop plays error for an unaffordable item and money for a purchase', async ({ page }) => {
  test.setTimeout(60_000);
  const spawn = { map: 'test_house', x: 7, y: 6, facing: 'right' };
  await page.route('**/data/start.json', async (route) => {
    const res = await route.fetch();
    const start = (await res.json()) as Record<string, unknown>;
    await route.fulfill({ response: res, body: JSON.stringify({ ...start, spawn }) });
  });
  await neutralIntro(page, spawn.map);
  const errors = await boot(page);
  await quickStart(page);

  await press(page, 'z');
  await expect.poll(() => hook<object | null>(page, 'dialogue')).not.toBeNull();
  while (await hook<object | null>(page, 'dialogue')) await press(page, 'z'); // the shopkeeper's line
  await expect.poll(async () => (await hook<{ ui: string } | null>(page, 'shop'))?.ui).toBe('main');
  await press(page, 'z'); // Comprar
  await expect.poll(async () => (await hook<{ ui: string }>(page, 'shop')).ui).toBe('list');
  await press(page, 'ArrowDown');
  await press(page, 'ArrowDown'); // Regleta, 1000 €
  await expect.poll(async () => (await hook<{ itemId: string }>(page, 'shop')).itemId).toBe('regleta');
  await expectSounds(page, () => press(page, 'z'), ['confirm', 'error']);
  while ((await hook<{ message: string | null }>(page, 'shop')).message) await press(page, 'z');
  await press(page, 'ArrowUp');
  await press(page, 'ArrowUp'); // Café
  await expect.poll(async () => (await hook<{ itemId: string }>(page, 'shop')).itemId).toBe('cafe');
  await press(page, 'z'); // picker
  await expect.poll(async () => (await hook<{ ui: string }>(page, 'shop')).ui).toBe('quantity');
  await expectSounds(page, () => press(page, 'ArrowUp'), ['cursor']);
  await press(page, 'z'); // ¿Compras 2 × Café?
  await expect.poll(async () => (await hook<{ ui: string }>(page, 'shop')).ui).toBe('confirm');
  await expectSounds(page, () => press(page, 'z'), ['confirm', 'money']); // Sí
  expect(await hook<number>(page, 'euros')).toBe(100);
  expect(errors).toEqual([]);
});

test('debug menu: give euros and items, reload the JSON, keep the old data on a broken file', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  let itemsOverride: string | null = null;
  await page.route('**/data/items.json', async (route) => {
    const res = await route.fetch();
    await route.fulfill({ response: res, body: itemsOverride ?? (await res.text()) });
  });
  const errors = await boot(page, '/?debug=1');
  await quickStart(page);
  const start = (await tile(page))!;

  await selectDebug(page, 'Dar 1000 €');
  await press(page, 'z');
  await expect.poll(() => hook<number>(page, 'euros')).toBe(1200);
  await selectDebug(page, 'Dar: Llaves del Audi');
  await press(page, 'z');
  await press(page, 'z');
  await expect.poll(() => hook(page, 'items')).toEqual({ cafe: 3, llaves_audi: 2 });
  expect(await hook<string>(page, 'debugMode')).toBe('menu'); // give entries keep the menu open
  await page.screenshot({ path: testInfo.outputPath(`debug-give-${testInfo.project.name}.png`) });

  // A valid change: Café renamed. Reload → new data, the map rebuilt where the player stands, the bag kept.
  const items = (await (await page.request.get('/test-world/data/items.json')).json()) as { name: string }[];
  items[0]!.name = 'Café recargado';
  itemsOverride = JSON.stringify(items);
  await selectDebug(page, 'Recargar datos');
  await press(page, 'z');
  await expect.poll(() => hook(page, 'debugReload')).toEqual({ state: 'ok', errors: [] });
  expect(await debugLines(page)).toContain('Datos recargados.');
  expect(await debugLines(page)).toContain('  Dar: Café recargado');
  expect(await hook(page, 'items')).toEqual({ cafe: 3, llaves_audi: 2 });
  await press(page, 'F2'); // close the menu (the overworld ignores movement while it is open)
  await standing(page, { map: start.map, x: start.x, y: start.y });

  // A broken file: the error shows, the data from the last good load stays.
  itemsOverride = '{ not json';
  await selectDebug(page, 'Recargar datos');
  await press(page, 'z');
  await expect.poll(async () => (await hook<{ state: string }>(page, 'debugReload')).state).toBe('error');
  const status = await hook<{ errors: string[] }>(page, 'debugReload');
  expect(status.errors[0]).toMatch(/^items\.json › \(root\) › invalid JSON/);
  const lines = await debugLines(page);
  expect(lines).toContain('Error al recargar (1); se mantienen los datos anteriores.');
  expect(lines).toContain('  Dar: Café recargado');
  expect(await hook<string>(page, 'currentScene')).toBe('Overworld');
  await page.screenshot({ path: testInfo.outputPath(`debug-reload-error-${testInfo.project.name}.png`) });
  expect(errors).toEqual([]);
});
