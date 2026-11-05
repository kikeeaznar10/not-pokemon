// Checks: entering the house door and leaving puts the player back outside the door facing
// down; walking off the east edge arrives at the west edge of test_east on the same row; a warp
// pointing at a wall fails at load time with a clear message. Plus: interiors are centred, zone
// music changes only when the file changes, and the debug teleport menu works.
// Map layouts: public/maps/README.md.
import { test, expect, type Page } from '@playwright/test';

interface Tile {
  map: string;
  x: number;
  y: number;
  facing: string;
  moving: boolean;
}
type Hooks = Record<string, (...a: unknown[]) => unknown>;

const hook = <T>(page: Page, name: string, ...args: unknown[]): Promise<T> =>
  page.evaluate(
    ([n, a]) => (window as unknown as { __E2E__: Hooks }).__E2E__[n as string]!(...(a as unknown[])),
    [name, args] as const,
  ) as Promise<T>;
const tile = (page: Page) => hook<Tile | null>(page, 'playerTile');

/** Wait until the player stands still, unlocked, in the expected state. */
async function standing(page: Page, expected: Partial<Tile>): Promise<void> {
  await expect
    .poll(async () => ({ ...(await tile(page)), locked: await hook<boolean>(page, 'overworldLocked') }))
    .toMatchObject({ ...expected, moving: false, locked: false });
}

/** Tap `key` once and wait for the expected result. */
async function tap(page: Page, key: string, expected: Partial<Tile>): Promise<void> {
  await page.keyboard.press(key);
  await standing(page, expected);
}

/** Tap `key` once per tile, each time expecting the next coordinate. */
async function walk(page: Page, key: string, axis: 'x' | 'y', to: number): Promise<void> {
  let at = (await tile(page))![axis];
  const dir = to > at ? 1 : -1;
  while (at !== to) {
    at += dir;
    await tap(page, key, { [axis]: at });
  }
}

async function enterOverworld(page: Page, query = ''): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto(`/${query}`);
  await page.waitForFunction(
    () =>
      (window as unknown as { __E2E__?: { preloadComplete(): boolean } }).__E2E__?.preloadComplete() === true,
  );
  // The title replaced "Pulsa START"; quickStart() continues a save or starts at the spawn (no intro).
  await page.waitForFunction(() =>
    (window as unknown as { __E2E__: { quickStart(): boolean } }).__E2E__.quickStart(),
  );
  await standing(page, { map: 'test', x: 15, y: 10 });
  return errors;
}

const cameraScroll = (page: Page) =>
  page.evaluate(() => {
    const g = (
      window as unknown as {
        __GAME__: {
          scene: { getScene(k: string): { cameras: { main: { scrollX: number; scrollY: number } } } };
        };
      }
    ).__GAME__;
    const cam = g.scene.getScene('Overworld').cameras.main;
    return { x: cam.scrollX, y: cam.scrollY };
  });

test('house door: in, then out puts the player outside the door facing down', async ({ page }, testInfo) => {
  const errors = await enterOverworld(page);
  expect(await hook(page, 'currentMusic')).toBe('assets/audio/music/test.ogg');
  // Spawn (15, 10) → up to row 7 → left to column 6 → up into the door at (6, 6).
  await tap(page, 'ArrowUp', { facing: 'up' });
  await walk(page, 'ArrowUp', 'y', 7);
  await tap(page, 'ArrowLeft', { facing: 'left' });
  await walk(page, 'ArrowLeft', 'x', 6);
  await tap(page, 'ArrowUp', { facing: 'up' });
  await page.keyboard.press('ArrowUp');
  await standing(page, { map: 'test_house', x: 4, y: 7, facing: 'up' });
  expect(await hook(page, 'currentMusic')).toBe('assets/audio/music/interior.ogg');

  // The 10 × 8 interior (320 × 256 px) is centred on the 512 × 288 screen.
  expect(await cameraScroll(page)).toEqual({ x: -96, y: -16 });
  await page.screenshot({ path: testInfo.outputPath(`house-${testInfo.project.name}.png`) });

  // Walls inside block.
  await tap(page, 'ArrowLeft', { facing: 'left' });
  await walk(page, 'ArrowLeft', 'x', 1);
  // Pressing into the wall changes nothing, so there is no new state to wait for: wait, then check.
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(400);
  await standing(page, { x: 1, facing: 'left' });
  await tap(page, 'ArrowRight', { facing: 'right' });
  await walk(page, 'ArrowRight', 'x', 4);

  // Leave: down off the doormat.
  await tap(page, 'ArrowDown', { facing: 'down' });
  await page.keyboard.press('ArrowDown');
  await standing(page, { map: 'test', x: 6, y: 7, facing: 'down' });
  expect(await hook(page, 'currentMusic')).toBe('assets/audio/music/test.ogg');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('east edge: walking off arrives at the west edge of test_east on the same row, and back', async ({
  page,
}, testInfo) => {
  const errors = await enterOverworld(page);
  await tap(page, 'ArrowDown', { y: 11 });
  await tap(page, 'ArrowDown', { y: 12 });
  await tap(page, 'ArrowRight', { facing: 'right' });
  await walk(page, 'ArrowRight', 'x', 29);
  await page.keyboard.press('ArrowRight');
  await standing(page, { map: 'test_east', x: 0, y: 12, facing: 'right' });
  // Same file in both zones: the music keeps playing.
  expect(await hook(page, 'currentMusic')).toBe('assets/audio/music/test.ogg');
  await standing(page, { map: 'test_east', y: 12 });
  await page.screenshot({ path: testInfo.outputPath(`east-${testInfo.project.name}.png`) });

  // Back: walk to x = 0 and off the west edge.
  await tap(page, 'ArrowLeft', { facing: 'left' });
  await walk(page, 'ArrowLeft', 'x', 0);
  await page.keyboard.press('ArrowLeft');
  await standing(page, { map: 'test', x: 29, y: 12, facing: 'left' });
  expect(errors, errors.join('\n')).toEqual([]);
});

test('a warp pointing at a wall fails at load time with a clear message', async ({ page }) => {
  await page.route('**/maps/test/test.tmj', async (route) => {
    const res = await route.fetch();
    const map = JSON.parse(await res.text()) as {
      layers: {
        name: string;
        objects?: { name: string; properties?: { name: string; value: unknown }[] }[];
      }[];
    };
    const door = map.layers.find((l) => l.name === 'warps')!.objects!.find((o) => o.name === 'house_door')!;
    for (const p of door.properties!) {
      if (p.name === 'toX') p.value = 0;
      if (p.name === 'toY') p.value = 0;
    }
    await route.fulfill({ response: res, body: JSON.stringify(map) });
  });
  await page.goto('/');
  await page.waitForFunction(
    () =>
      (window as unknown as { __E2E__?: { currentScene(): string | null } }).__E2E__?.currentScene() ===
      'Error',
  );
  expect(await hook(page, 'dataErrors')).toEqual([
    'maps/test/test.tmj › warps.house_door › target tile (0, 0) on map "test_house" is not walkable',
  ]);
});

test('debug menu teleports to any zone spawn; the player does not move while it is open', async ({
  page,
}) => {
  await enterOverworld(page, '?debug=1');
  await page.keyboard.press('F2');
  await expect.poll(() => hook(page, 'debugMode')).toBe('info');
  await page.keyboard.press('F2');
  await expect.poll(() => hook(page, 'debugMode')).toBe('menu');
  expect(await hook<string[]>(page, 'debugLines')).toEqual(
    expect.arrayContaining(['> test', '  test_house', '  test_east']),
  );
  // One press per frame at most counts, so wait for each move of the cursor.
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => hook<string[]>(page, 'debugLines')).toContain('> test_house');
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => hook<string[]>(page, 'debugLines')).toContain('> test_east');
  expect(await tile(page)).toMatchObject({ map: 'test', x: 15, y: 10, facing: 'down' }); // did not move
  await page.keyboard.press('KeyZ');
  await standing(page, { map: 'test_east', x: 2, y: 10 });
  expect(await hook(page, 'debugMode')).toBe('info');
  // B closes the menu without teleporting.
  await page.keyboard.press('F2');
  await expect.poll(() => hook(page, 'debugMode')).toBe('menu');
  await page.keyboard.press('KeyX');
  await expect.poll(() => hook(page, 'debugMode')).toBe('info');
  expect(await tile(page)).toMatchObject({ map: 'test_east', x: 2, y: 10 });
});
