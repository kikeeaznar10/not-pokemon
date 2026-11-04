// M1 "Done when": valid data reaches Preload-complete with no console errors; a broken attack id
// shows the red ErrorScene naming the file and path.
import { test, expect, type Page } from '@playwright/test';

interface Hooks {
  currentScene(): string | null;
  preloadComplete(): boolean;
  failedAssets(): string[];
  dataErrors(): string[];
  dataSummary(): Record<string, number> | null;
  hasTexture(key: string): boolean;
  hasSound(key: string): boolean;
}

/** Call `window.__E2E__[name](...args)` in the page. */
const hook = <K extends keyof Hooks>(
  page: Page,
  name: K,
  ...args: Parameters<Hooks[K]>
): Promise<ReturnType<Hooks[K]>> =>
  page.evaluate(
    ([n, a]) => {
      const h = (window as unknown as { __E2E__: Record<string, (...x: unknown[]) => unknown> }).__E2E__;
      return h[n as string]!(...(a as unknown[]));
    },
    [name, args] as const,
  ) as Promise<ReturnType<Hooks[K]>>;

const collectErrors = (page: Page): string[] => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return errors;
};

test('valid data loads every asset and reaches Preload complete with no errors', async ({
  page,
}, testInfo) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await page.waitForFunction(
    () => (window as unknown as { __E2E__?: Hooks }).__E2E__?.preloadComplete() === true,
  );

  expect(await hook(page, 'currentScene')).toBe('Preload');
  expect(await hook(page, 'dataSummary')).toEqual({
    flexymon: 3,
    attacks: 6,
    items: 6,
    npcs: 2,
    zones: 3,
    shops: 1,
    secretNames: 1,
  });
  expect(await hook(page, 'failedAssets')).toEqual([]);
  expect(await hook(page, 'hasTexture', 'assets/sprites/flexymon/portatil_front.png')).toBe(true);
  expect(await hook(page, 'hasTexture', 'assets/sprites/items/lata.png')).toBe(true);
  expect(await hook(page, 'hasSound', 'assets/audio/sfx/compilar.ogg')).toBe(true);
  expect(await hook(page, 'hasSound', 'assets/audio/music/test.ogg')).toBe(true);
  expect(await hook(page, 'dataErrors')).toEqual([]);

  await page.screenshot({ path: testInfo.outputPath(`preload-${testInfo.project.name}.png`) });
  expect(errors, errors.join('\n')).toEqual([]);
});

test('a broken attack id shows the red ErrorScene with file › path › message', async ({ page }, testInfo) => {
  await page.route('**/data/flexymon.json', async (route) => {
    const res = await route.fetch();
    const body = (await res.text()).replace('"compilar"', '"compilarr"');
    await route.fulfill({ response: res, body });
  });
  await page.goto('/');
  await page.waitForFunction(
    () => (window as unknown as { __E2E__?: Hooks }).__E2E__?.currentScene() === 'Error',
  );

  expect(await hook(page, 'dataErrors')).toEqual([
    'flexymon.json › [0].attacks[0] › unknown attack "compilarr"',
  ]);
  expect(await hook(page, 'dataSummary')).toBeNull();
  await page.screenshot({ path: testInfo.outputPath(`error-${testInfo.project.name}.png`) });
});

test('many errors: the list scrolls with the arrow keys', async ({ page }, testInfo) => {
  await page.route('**/data/npcs.json', async (route) => {
    const res = await route.fetch();
    const npcs = JSON.parse(await res.text()) as Record<string, unknown>[];
    const broken = Array.from({ length: 40 }, (_, i) => ({ ...npcs[0], id: `npc_${i}`, map: `mapa_${i}` }));
    await route.fulfill({ response: res, body: JSON.stringify(broken) });
  });
  await page.goto('/');
  await page.waitForFunction(
    () => (window as unknown as { __E2E__?: Hooks }).__E2E__?.currentScene() === 'Error',
  );
  expect(await hook(page, 'dataErrors')).toHaveLength(40);

  const bodyY = () =>
    page.evaluate(() => {
      type Obj = { name: string; y: number };
      const g = (
        window as unknown as { __GAME__: { scene: { getScene(k: string): { children: { list: Obj[] } } } } }
      ).__GAME__;
      return g.scene.getScene('Error').children.list.find((o) => o.name === 'error-list')!.y;
    });
  const before = await bodyY();
  await page.locator('canvas').click();
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowDown');
  await expect.poll(bodyY).toBeLessThan(before);
  await page.screenshot({ path: testInfo.outputPath(`error-scrolled-${testInfo.project.name}.png`) });
  await page.keyboard.press('ArrowUp');
});
