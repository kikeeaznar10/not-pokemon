// M9 "Done when": buying 3 Cafés with 200 € leaves 50 € and 3 more Cafés, selling one gives 25 €; a Café in
// battle heals 20 HP and the opponent then acts; the storage box never lets the team become empty or exceed
// its slots. Plus: the shopkeeper's dialogue opens the shop, an unaffordable item says so, B backs out of every
// step, the shop and the healer ask for an auto-save, the healer heals team and storage.
// The player starts inside `test_house` next to the NPC under test (start.json served with another spawn).
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
interface ShopView {
  ui: string;
  mode: string | null;
  euros: number;
  menu: Menu | null;
  itemId: string | null;
  quantity: number;
  total: number;
  prompt: string;
  message: string | null;
}
interface StorageView {
  column: string;
  cursor: number;
  team: string[];
  storage: string[];
  teamSlots: number;
  message: string | null;
}
interface BattleView {
  ui: string;
  result: string | null;
  menu: Menu | null;
  message: string | null;
  player: { hp: number; shownHp: number; maxHp: number };
}
interface Inst {
  speciesId: string;
  currentHp: number;
}
type Hooks = Record<string, (...a: unknown[]) => unknown>;

const hook = <T>(page: Page, name: string, ...args: unknown[]): Promise<T> =>
  page.evaluate(
    ([n, a]) => (window as unknown as { __E2E__: Hooks }).__E2E__[n as string]!(...(a as unknown[])),
    [name, args] as const,
  ) as Promise<T>;
const tile = (page: Page) => hook<Tile | null>(page, 'playerTile');
const shop = (page: Page) => hook<ShopView | null>(page, 'shop');
const storage = (page: Page) => hook<StorageView | null>(page, 'storage');
const battle = (page: Page) => hook<BattleView | null>(page, 'battle');
const dialogue = (page: Page) => hook<{ full: string } | null>(page, 'dialogue');
/** The M9 save requests (`shop`, `healer`); M10 also asks for one on every map entry (`map`), left out here. */
const shopSaves = async (page: Page) =>
  (await hook<string[]>(page, 'saveRequests')).filter((r) => r === 'shop' || r === 'healer');

/** Serve start.json with the player standing at `spawn`. */
async function startAt(page: Page, spawn: object): Promise<void> {
  await page.route('**/data/start.json', async (route) => {
    const res = await route.fetch();
    const start = (await res.json()) as Record<string, unknown>;
    await route.fulfill({ response: res, body: JSON.stringify({ ...start, spawn }) });
  });
}

async function enterOverworld(page: Page, expected: Partial<Tile>): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto('/');
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

/** Press A through the overworld dialogue box until it closes; returns the texts seen. */
async function readDialogue(page: Page): Promise<string[]> {
  const seen: string[] = [];
  await expect.poll(() => dialogue(page), { timeout: 10_000 }).not.toBeNull();
  while (true) {
    const d = await dialogue(page);
    if (!d) return seen;
    if (seen.at(-1) !== d.full) seen.push(d.full);
    await press(page, 'z');
  }
}

/** Press A until the storage box's message closes (A first shows the whole text, then closes it). */
async function dismissStorageMessage(page: Page): Promise<void> {
  while ((await storage(page))?.message) await press(page, 'z');
}

/** Press A through the shop's message box; returns its text. */
async function shopMessage(page: Page): Promise<string> {
  await expect.poll(async () => (await shop(page))?.message ?? null).not.toBeNull();
  const text = (await shop(page))!.message!;
  while ((await shop(page))?.message) await press(page, 'z');
  return text;
}

test('shop: buy 3 Cafés with 200 € (50 € left), sell one for 25 €; B backs out; auto-save on leaving', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await startAt(page, { map: 'test_house', x: 7, y: 6, facing: 'right' });
  const errors = await enterOverworld(page, { map: 'test_house', x: 7, y: 6 });
  expect(await hook<number>(page, 'euros')).toBe(200);
  expect(await hook(page, 'items')).toEqual({ cafe: 3 });

  // The shopkeeper says its dialogue, then the shop opens over the paused overworld.
  await press(page, 'z');
  expect(await readDialogue(page)).toEqual(['¡Bienvenido!']);
  await expect
    .poll(() => shop(page))
    .toMatchObject({ ui: 'main', euros: 200, prompt: '¿Qué quieres hacer?' });
  expect((await shop(page))!.menu!.options.map((o) => o.label)).toEqual(['Comprar', 'Vender', 'Salir']);
  expect(await hook<boolean>(page, 'overworldLocked')).toBe(true);

  // Comprar: the stock with prices.
  await press(page, 'z');
  await expect.poll(async () => (await shop(page))?.ui).toBe('list');
  const list = (await shop(page))!;
  expect(list).toMatchObject({ mode: 'buy', itemId: 'cafe', prompt: 'Recupera 20 PS.\nTienes: 3' });
  expect(list.menu!.options.map((o) => o.label)).toEqual(['Café', 'Lata energética', 'Regleta']);
  await page.screenshot({ path: testInfo.outputPath(`shop-buy-${testInfo.project.name}.png`) });

  // Regleta (1000 €) is too expensive.
  await press(page, 'ArrowDown');
  await press(page, 'ArrowDown');
  await expect.poll(async () => (await shop(page))?.itemId).toBe('regleta');
  await press(page, 'z');
  expect(await shopMessage(page)).toBe('No tienes suficiente dinero.');
  await expect.poll(async () => (await shop(page))?.ui).toBe('list');

  // Café × 3: the picker (Up +1, B goes back to the list), the confirmation, the purchase.
  await press(page, 'ArrowUp');
  await press(page, 'ArrowUp');
  await expect.poll(async () => (await shop(page))?.itemId).toBe('cafe');
  await press(page, 'z');
  await expect
    .poll(() => shop(page))
    .toMatchObject({ ui: 'quantity', quantity: 1, total: 50, prompt: '¿Cuántos?' });
  await press(page, 'x');
  await expect.poll(async () => (await shop(page))?.ui).toBe('list');
  await press(page, 'z');
  await expect.poll(async () => (await shop(page))?.ui).toBe('quantity');
  await press(page, 'ArrowRight'); // +10, capped at the 4 the money allows
  await expect.poll(async () => (await shop(page))?.quantity).toBe(4);
  await press(page, 'ArrowDown');
  await expect.poll(() => shop(page)).toMatchObject({ quantity: 3, total: 150 });
  await page.screenshot({ path: testInfo.outputPath(`shop-quantity-${testInfo.project.name}.png`) });
  await press(page, 'z');
  await expect
    .poll(() => shop(page))
    .toMatchObject({ ui: 'confirm', prompt: '¿Compras 3 × Café por 150 €?' });
  await press(page, 'z'); // Sí
  expect(await shopMessage(page)).toBe('¡Gracias por tu compra!');
  expect(await hook<number>(page, 'euros')).toBe(50);
  expect(await hook(page, 'items')).toEqual({ cafe: 6 });
  await expect.poll(() => shop(page)).toMatchObject({ ui: 'list', euros: 50 });

  // Vender: Café for 25 € each.
  await press(page, 'x');
  await expect.poll(async () => (await shop(page))?.ui).toBe('main');
  await press(page, 'ArrowDown');
  await press(page, 'z');
  await expect.poll(() => shop(page)).toMatchObject({ ui: 'list', mode: 'sell', itemId: 'cafe' });
  await page.screenshot({ path: testInfo.outputPath(`shop-sell-${testInfo.project.name}.png`) });
  await press(page, 'z');
  await expect.poll(() => shop(page)).toMatchObject({ ui: 'quantity', quantity: 1, total: 25 });
  await press(page, 'z');
  await expect.poll(() => shop(page)).toMatchObject({ ui: 'confirm', prompt: '¿Vendes 1 × Café por 25 €?' });
  await press(page, 'z');
  expect(await shopMessage(page)).toBe('Has vendido 1 × Café por 25 €.');
  expect(await hook<number>(page, 'euros')).toBe(75);
  expect(await hook(page, 'items')).toEqual({ cafe: 5 });

  // B, B: out of the shop; the overworld moves again and an auto-save was requested.
  expect(await shopSaves(page)).toEqual([]);
  await press(page, 'x');
  await expect.poll(async () => (await shop(page))?.ui).toBe('main');
  await press(page, 'x');
  await expect.poll(() => shop(page)).toBeNull();
  await standing(page, { map: 'test_house', x: 7, y: 6 });
  expect(await shopSaves(page)).toEqual(['shop']);
  expect(errors).toEqual([]);
});

test('a Café in battle heals 20 HP and the opponent then acts; the bag keeps the rest', async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  const errors = await enterOverworld(page, { map: 'test', x: 15, y: 10 });
  await hook(page, 'setTeam', [{ speciesId: 'portatil', currentHp: 10 }]);
  expect(await hook<boolean>(page, 'startBattle', 7)).toBe(true);
  const messages: string[] = [];
  const toMenu = async () => {
    for (;;) {
      const v = await battle(page);
      if (v?.message) {
        if (messages.at(-1) !== v.message) messages.push(v.message);
        await press(page, 'z');
      } else if (v?.ui === 'main') return v;
      else await page.waitForTimeout(40);
    }
  };
  await toMenu();
  messages.length = 0;

  // Objeto → Café (x3) → Portátil.
  await press(page, 'ArrowRight');
  await press(page, 'z');
  await expect.poll(async () => (await battle(page))?.ui).toBe('item');
  expect((await battle(page))!.menu!.options).toEqual([{ label: 'Café', enabled: true }]);
  await page.screenshot({ path: testInfo.outputPath(`battle-items-${testInfo.project.name}.png`) });
  await press(page, 'z');
  await expect.poll(async () => (await battle(page))?.ui).toBe('item_target');
  expect((await battle(page))!.menu!.options).toEqual([{ label: 'Portátil', enabled: true }]);
  await page.screenshot({ path: testInfo.outputPath(`battle-item-target-${testInfo.project.name}.png`) });
  await press(page, 'z');
  const after = await toMenu();
  expect(messages[0]).toBe('Usas Café con Portátil.');
  expect(messages[1]).toBe('Portátil recupera 20 PS.');
  expect(messages[2]).toMatch(/^¡Ratón salvaje usa /);
  expect(after.player.hp).toBeLessThanOrEqual(30);
  expect(after.player.shownHp).toBe(after.player.hp);

  // Flee: the bag in the game state now holds 2 Cafés.
  await press(page, 'ArrowRight');
  await press(page, 'ArrowDown');
  await press(page, 'z');
  await expect.poll(async () => (await battle(page))?.message).toBe('¡Escapas sin problemas!');
  while (await battle(page)) await press(page, 'z');
  await standing(page, { x: 15, y: 10 });
  expect(await hook(page, 'items')).toEqual({ cafe: 2 });
  expect(errors).toEqual([]);
});

test('storage box: the team never becomes empty or exceeds its slots', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await startAt(page, { map: 'test_house', x: 7, y: 4, facing: 'right' });
  const errors = await enterOverworld(page, { map: 'test_house', x: 7, y: 4 });
  await hook(page, 'setParty', {
    team: [{ speciesId: 'portatil' }],
    storage: [{ speciesId: 'raton' }, { speciesId: 'teclado', currentHp: 0 }],
    teamSlots: 2,
  });

  await press(page, 'z');
  expect(await readDialogue(page)).toEqual(['Te abro la caja de los flexymon.']);
  await expect
    .poll(() => storage(page))
    .toMatchObject({
      column: 'team',
      cursor: 0,
      team: ['portatil'],
      storage: ['raton', 'teclado'],
    });
  await page.screenshot({ path: testInfo.outputPath(`storage-${testInfo.project.name}.png`) });

  // The last team member cannot leave.
  await press(page, 'z');
  await expect.poll(async () => (await storage(page))?.message).toBe('No puedes dejar tu equipo vacío.');
  await dismissStorageMessage(page);
  expect((await storage(page))!.team).toEqual(['portatil']);

  // Caja → Equipo until the 2 slots are full; the third is refused.
  await press(page, 'ArrowRight');
  await expect.poll(async () => (await storage(page))?.column).toBe('storage');
  await press(page, 'z');
  await expect.poll(() => storage(page)).toMatchObject({ team: ['portatil', 'raton'], storage: ['teclado'] });
  await press(page, 'z');
  await expect.poll(async () => (await storage(page))?.message).toBe('Tu equipo está lleno.');
  await dismissStorageMessage(page);
  expect((await storage(page))!.team).toEqual(['portatil', 'raton']);

  // Equipo → Caja is fine while another member stays.
  await press(page, 'ArrowLeft');
  await press(page, 'z');
  await expect.poll(() => storage(page)).toMatchObject({ team: ['raton'], storage: ['teclado', 'portatil'] });
  await page.screenshot({ path: testInfo.outputPath(`storage-moved-${testInfo.project.name}.png`) });

  await press(page, 'x');
  await expect.poll(() => storage(page)).toBeNull();
  await standing(page, { map: 'test_house', x: 7, y: 4 });
  const party = await hook<{ team: Inst[]; storage: Inst[]; teamSlots: number }>(page, 'party');
  expect(party.team.map((m) => m.speciesId)).toEqual(['raton']);
  expect(party.storage.map((m) => m.speciesId)).toEqual(['teclado', 'portatil']);
  expect(party.teamSlots).toBe(2);
  expect(errors).toEqual([]);
});

test('healer: full heal of team and storage, message, auto-save', async ({ page }) => {
  test.setTimeout(60_000);
  await startAt(page, { map: 'test_house', x: 2, y: 4, facing: 'left' });
  const errors = await enterOverworld(page, { map: 'test_house', x: 2, y: 4 });
  await hook(page, 'setParty', {
    team: [
      { speciesId: 'portatil', currentHp: 0 },
      { speciesId: 'raton', currentHp: 3 },
    ],
    storage: [{ speciesId: 'teclado', currentHp: 1 }],
  });

  await press(page, 'z');
  expect(await readDialogue(page)).toEqual([
    'Tus flexymon están como nuevos.',
    'Aquí siempre hay café para todos.',
  ]);
  await standing(page, { x: 2, y: 4 });
  const party = await hook<{ team: Inst[]; storage: Inst[] }>(page, 'party');
  expect(party.team.map((m) => m.currentHp)).toEqual([40, 30]);
  expect(party.storage.map((m) => m.currentHp)).toEqual([38]);
  expect(await shopSaves(page)).toEqual(['healer']);
  expect(errors).toEqual([]);
});
