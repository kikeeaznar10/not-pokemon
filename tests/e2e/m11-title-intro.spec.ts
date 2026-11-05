// M11 "Done when": a first-time player reaches free movement in under 60 s; the name "PACO" receives the
// bonus items and "Pacoo" does not; Continuar is hidden with no save and restores the game when present.
// Also: the name screen (keyboard typing, grid by click, Borrar, the 10-character limit, empty name), the
// new-game confirmation over a save, and the intro script (walks, dialogue, handover, jingle).
import { test, expect, type Page } from '@playwright/test';

interface Tile {
  map: string;
  x: number;
  y: number;
  facing: string;
  moving: boolean;
}
interface TitleView {
  ui: string;
  options: string[];
  cursor: number;
  confirm: { options: string[]; cursor: number } | null;
  hasSave: boolean;
  brokenSave: boolean;
  logo: string;
  hint: string;
}
interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
interface NameView {
  name: string;
  cursor: number;
  cell: string;
  cells: string[];
  message: string;
  rects: Rect[];
}
interface IntroView {
  step: number;
  type: string;
  name: string;
  player: { x: number; y: number; facing: string };
  coworker: { x: number; y: number; facing: string };
  dialogue: { full: string; typed: boolean } | null;
  handedOver: boolean;
  secretMessage: string | null;
  jinglePlays: number;
}
type Hooks = Record<string, (...a: unknown[]) => unknown>;

const SAVE_KEY = 'flexymon.save.v1';

const hook = <T>(page: Page, name: string, ...args: unknown[]): Promise<T> =>
  page.evaluate(
    ([n, a]) => (window as unknown as { __E2E__: Hooks }).__E2E__[n as string]!(...(a as unknown[])),
    [name, args] as const,
  ) as Promise<T>;
const title = (page: Page) => hook<TitleView | null>(page, 'title');
const nameEntry = (page: Page) => hook<NameView | null>(page, 'nameEntry');
const intro = (page: Page) => hook<IntroView | null>(page, 'intro');
const tile = (page: Page) => hook<Tile | null>(page, 'playerTile');
const scene = (page: Page) => hook<string | null>(page, 'currentScene');

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return errors;
}

/** Press a key after two animation frames (a menu or box ignores input on the frame it opens). */
async function press(page: Page, key: string): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );
  await page.keyboard.press(key);
}

async function waitForTitle(page: Page): Promise<TitleView> {
  await expect.poll(() => scene(page), { timeout: 20_000 }).toBe('Title');
  return (await title(page))!;
}

/** On the title: open the menu and choose Nueva partida (the last option). */
async function chooseNewGame(page: Page): Promise<void> {
  await press(page, 'Enter');
  await expect.poll(async () => (await title(page))?.ui).toBe('menu');
  const t = (await title(page))!;
  for (let i = t.cursor; i < t.options.length - 1; i += 1) await press(page, 'ArrowDown');
  await expect.poll(async () => (await title(page))?.cursor).toBe(t.options.length - 1);
  await press(page, 'Enter');
}

/** On the name screen: type `name` with the physical keyboard and confirm with Enter. */
async function typeName(page: Page, name: string): Promise<void> {
  await expect.poll(() => scene(page)).toBe('Name');
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );
  for (const ch of name) await press(page, ch === ' ' ? 'Space' : ch);
  await expect.poll(async () => (await nameEntry(page))?.name).toBe(name);
  await press(page, 'Enter');
}

/** Play the intro, pressing A (Z) through every dialogue box; returns the texts shown. */
async function playIntro(page: Page): Promise<string[]> {
  const seen: string[] = [];
  await expect.poll(() => scene(page)).toBe('Intro');
  while ((await scene(page)) === 'Intro') {
    const v = await intro(page);
    if (v?.dialogue) {
      const text = v.dialogue.full.replace(/\n/g, ' ');
      if (seen[seen.length - 1] !== text) seen.push(text);
      await press(page, 'z');
    } else await page.waitForTimeout(50);
  }
  return seen;
}

/** Wait until the player stands free in the overworld. */
async function standing(page: Page, expected: Partial<Tile> = {}): Promise<void> {
  await expect
    .poll(async () => ({ ...(await tile(page)), locked: await hook<boolean>(page, 'overworldLocked') }))
    .toMatchObject({ ...expected, moving: false, locked: false });
}

/** Click a name-grid cell (base pixels → page pixels through the canvas box). */
async function clickCell(page: Page, label: string): Promise<void> {
  const v = (await nameEntry(page))!;
  const i = v.cells.indexOf(label);
  expect(i).toBeGreaterThanOrEqual(0);
  const r = v.rects[i]!;
  const box = (await page.locator('canvas').boundingBox())!;
  const s = box.width / 512;
  await page.mouse.click(box.x + (r.x + r.width / 2) * s, box.y + (r.y + r.height / 2) * s);
}

test('a first-time player goes title → name → intro → free movement in under 60 s', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const errors = watchErrors(page);
  const started = Date.now();
  await page.goto('/');
  const t = await waitForTitle(page);
  // No save: Continuar is hidden, only Nueva partida.
  expect(t).toMatchObject({
    ui: 'press',
    hasSave: false,
    brokenSave: false,
    logo: 'Flexymon',
    hint: 'Pulsa START',
  });
  await page.screenshot({ path: testInfo.outputPath(`m11-title-${testInfo.project.name}.png`) });
  await press(page, 'Enter');
  await expect.poll(() => title(page)).toMatchObject({ ui: 'menu', options: ['Nueva partida'], cursor: 0 });
  await page.screenshot({ path: testInfo.outputPath(`m11-title-menu-${testInfo.project.name}.png`) });
  await press(page, 'z');

  await expect.poll(() => scene(page)).toBe('Name');
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );
  for (const k of ['A', 'n', 'a']) await press(page, k);
  await expect.poll(async () => (await nameEntry(page))?.name).toBe('Ana');
  await page.screenshot({ path: testInfo.outputPath(`m11-name-${testInfo.project.name}.png`) });
  await press(page, 'Enter');

  await expect.poll(() => scene(page)).toBe('Intro');
  // The intro starts on the spawn tile, the coworker on its tile; both walk as scripted.
  await expect
    .poll(async () => (await intro(page))?.dialogue?.full ?? null)
    .toBe('¡Hola, Ana! Bienvenido a ahora.');
  const mid = (await intro(page))!;
  expect(mid.player).toEqual({ x: 15, y: 8, facing: 'up' });
  expect(mid.coworker).toMatchObject({ x: 15, y: 7 });
  await page.screenshot({ path: testInfo.outputPath(`m11-intro-${testInfo.project.name}.png`) });
  const texts = await playIntro(page);
  expect(texts).toEqual([
    '¡Hola, Ana! Bienvenido a ahora.',
    'Aquí todos trabajamos con flexymon. Toma, este es para ti.',
    '¡Recibes a Portátil!',
    'Cuídalo bien. ¡Nos vemos por la oficina!',
  ]);

  await standing(page, { map: 'test', x: 15, y: 8, facing: 'up' });
  const elapsed = Date.now() - started;
  expect(elapsed).toBeLessThan(60_000);
  testInfo.annotations.push({ type: 'time to free movement', description: `${elapsed} ms` });
  // Starting state from start.json, with the chosen name; the first map is saved.
  expect(await hook(page, 'playerName')).toBe('Ana');
  expect((await hook<{ speciesId: string }[]>(page, 'team')).map((m) => m.speciesId)).toEqual(['portatil']);
  expect(await hook(page, 'euros')).toBe(200);
  expect(await hook(page, 'items')).toEqual({ cafe: 3 });
  await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), SAVE_KEY)).not.toBeNull();
  // Free movement.
  await press(page, 'ArrowLeft');
  await press(page, 'ArrowLeft');
  await standing(page, { x: 14, y: 8 });
  await page.screenshot({ path: testInfo.outputPath(`m11-free-${testInfo.project.name}.png`) });
  expect(errors).toEqual([]);
});

for (const [name, cafes, secret] of [
  ['PACO', 13, true],
  ['Pacoo', 3, false],
] as const) {
  test(`the name "${name}" ${secret ? 'receives' : 'does not receive'} the secret-name items`, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await waitForTitle(page);
    await chooseNewGame(page);
    await typeName(page, name);
    const texts = await playIntro(page);
    const message = 'El de siempre te ha guardado unos cafés.';
    if (secret) expect(texts.slice(2, 4)).toEqual(['¡Recibes a Portátil!', message]);
    else expect(texts).not.toContain(message);
    await standing(page);
    expect(await hook(page, 'playerName')).toBe(name);
    expect(await hook(page, 'items')).toEqual({ cafe: cafes });
  });
}

test('Continuar is hidden with no save and restores the saved game when there is one', async ({ page }) => {
  test.setTimeout(60_000);
  const errors = watchErrors(page);
  await page.goto('/');
  expect((await waitForTitle(page)).hasSave).toBe(false);
  // Make a save through the normal game: quick start, walk, change euros, close the menu (save point).
  expect(await hook(page, 'quickStart')).toBe(true);
  await standing(page, { map: 'test', x: 15, y: 10 });
  await press(page, 'ArrowRight');
  await press(page, 'ArrowRight');
  await standing(page, { x: 16, y: 10, facing: 'right' });
  await hook(page, 'setEuros', 432);
  await press(page, 'Enter');
  await expect.poll(() => hook<{ ui: string } | null>(page, 'menu')).not.toBeNull();
  await press(page, 'x');
  await expect
    .poll(
      async () =>
        JSON.parse((await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY)) ?? 'null')?.euros,
    )
    .toBe(432);

  await page.reload();
  const t = await waitForTitle(page);
  expect(t.hasSave).toBe(true);
  await press(page, 'Enter');
  await expect
    .poll(() => title(page))
    .toMatchObject({ ui: 'menu', options: ['Continuar', 'Nueva partida'], cursor: 0 });
  await press(page, 'z');
  await standing(page, { map: 'test', x: 16, y: 10, facing: 'right' });
  expect(await hook(page, 'euros')).toBe(432);
  expect(await hook(page, 'playerName')).toBe('Rogelio');
  expect(errors).toEqual([]);
});

test('Nueva partida over a save asks first: No keeps the save, Sí starts a new game', async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  await page.goto('/');
  await waitForTitle(page);
  await hook(page, 'quickStart');
  await standing(page);
  await hook(page, 'setEuros', 999);
  await press(page, 'Enter');
  await expect.poll(() => hook(page, 'menu')).not.toBeNull();
  await press(page, 'x');
  await expect
    .poll(
      async () =>
        JSON.parse((await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY)) ?? 'null')?.euros,
    )
    .toBe(999);

  await page.reload();
  await waitForTitle(page);
  // Read the save on the title (the reload itself writes a quiet save on page hide).
  const saved = await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY);
  await chooseNewGame(page);
  await expect.poll(async () => (await title(page))?.confirm).toEqual({ options: ['Sí', 'No'], cursor: 1 });
  await page.screenshot({ path: testInfo.outputPath(`m11-confirm-${testInfo.project.name}.png`) });
  await press(page, 'z'); // No
  await expect.poll(async () => (await title(page))?.ui).toBe('press');
  expect(await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY)).toBe(saved);

  await chooseNewGame(page);
  await expect.poll(async () => (await title(page))?.confirm?.cursor).toBe(1);
  await press(page, 'ArrowUp');
  await expect.poll(async () => (await title(page))?.confirm?.cursor).toBe(0);
  await press(page, 'z'); // Sí
  await typeName(page, 'Eva');
  await playIntro(page);
  await standing(page, { x: 15, y: 8 });
  expect(await hook(page, 'euros')).toBe(200);
  await expect
    .poll(
      async () =>
        JSON.parse((await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY)) ?? 'null')?.player?.name,
    )
    .toBe('Eva');
});

test('name screen: keyboard letters (Z and X too), Backspace, 10 characters, grid clicks, empty name', async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  await page.goto('/');
  await waitForTitle(page);
  await chooseNewGame(page);
  await expect.poll(() => scene(page)).toBe('Name');
  const v = (await nameEntry(page))!;
  // A–Z, Ñ, á é í ó ú, space, Borrar, OK.
  expect(v.cells.join('')).toBe('ABCDEFGHIJKLMNÑOPQRSTUVWXYZáéíóú␣BorrarOK');

  // Enter with an empty name only shows the message.
  await press(page, 'Enter');
  await expect.poll(async () => (await nameEntry(page))?.message).toBe('Escribe al menos una letra.');
  expect(await scene(page)).toBe('Name');

  // Z and X type letters here (text mode), Backspace deletes, at most 10 characters.
  for (const k of ['Z', 'x', 'w', 'Backspace']) await press(page, k);
  await expect.poll(async () => (await nameEntry(page))?.name).toBe('Zx');
  for (const k of 'abcdefghij') await press(page, k);
  await expect.poll(async () => (await nameEntry(page))?.name).toBe('Zxabcdefgh');
  for (let i = 0; i < 10; i += 1) await press(page, 'Backspace');
  await expect.poll(async () => (await nameEntry(page))?.name).toBe('');

  // The grid: arrows move the cursor; clicks press cells.
  await press(page, 'ArrowRight');
  await press(page, 'ArrowDown');
  await expect.poll(async () => (await nameEntry(page))?.cell).toBe('M');
  for (const label of ['Ñ', 'á', 'Borrar']) await clickCell(page, label);
  await expect.poll(async () => (await nameEntry(page))?.name).toBe('Ñ');
  await press(page, 'o');
  await expect.poll(async () => (await nameEntry(page))?.name).toBe('Ño');
  await page.screenshot({ path: testInfo.outputPath(`m11-name-grid-${testInfo.project.name}.png`) });
  await clickCell(page, 'OK');
  await expect.poll(() => scene(page)).toBe('Intro');
  await expect.poll(async () => (await intro(page))?.name).toBe('Ño');
});
