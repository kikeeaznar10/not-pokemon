// M3 "Done when": the player moves exactly one tile per press, never stops between tiles, cannot walk
// through walls or off the map; holding walks continuously, tapping turns in place; F2 shows the tile
// coordinates and they match Tiled. Test map geometry: public/maps/README.md.
import { test, expect, type Page } from '@playwright/test';

interface Tile {
  map: string;
  x: number;
  y: number;
  facing: string;
  moving: boolean;
}

const tile = (page: Page) =>
  page.evaluate(() => (window as unknown as { __E2E__: { playerTile(): Tile | null } }).__E2E__.playerTile());

const spritePos = (page: Page) =>
  page.evaluate(() => {
    type Obj = { name: string; x: number; y: number };
    const g = (
      window as unknown as { __GAME__: { scene: { getScene(k: string): { children: { list: Obj[] } } } } }
    ).__GAME__;
    const p = g.scene.getScene('Overworld').children.list.find((o) => o.name === 'player')!;
    return { x: p.x, y: p.y };
  });

/**
 * Wait until the player stands still in the expected state, then wait a little longer and check it
 * did not move again (so one press = exactly one tile, not "at least one").
 */
const expectStanding = async (page: Page, expected: Partial<Tile>): Promise<void> => {
  await expect.poll(() => tile(page)).toMatchObject({ ...expected, moving: false });
  await page.waitForTimeout(300);
  expect(await tile(page)).toMatchObject({ ...expected, moving: false });
};

/** Load the game, press Start on the title and wait for the overworld. */
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
  await page.keyboard.press('Enter');
  await expect.poll(() => tile(page)).toMatchObject({ map: 'test', x: 15, y: 10, facing: 'down' });
  return errors;
}

test('one tile per press, tap turns in place, walls and map edges block', async ({ page }, testInfo) => {
  const errors = await enterOverworld(page);
  await page.screenshot({ path: testInfo.outputPath(`overworld-${testInfo.project.name}.png`) });

  // A tap in a new direction only turns.
  await page.keyboard.press('ArrowLeft');
  await expectStanding(page, { x: 15, y: 10, facing: 'left' });

  // Each tap in the facing direction moves exactly one tile.
  for (const x of [14, 13, 12]) {
    await page.keyboard.press('ArrowLeft');
    await expectStanding(page, { x, y: 10 });
    // Standing on the tile, exactly on the grid.
    expect(await spritePos(page)).toEqual({ x: x * 32, y: 320 });
  }

  // The wall at x = 11 blocks, even when holding.
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(600);
  await page.keyboard.up('ArrowLeft');
  await expectStanding(page, { x: 12, y: 10, facing: 'left' });

  // WASD works too: D faces right (tap = turn), D again walks one tile.
  await page.keyboard.press('KeyD');
  await expectStanding(page, { x: 12, facing: 'right' });
  await page.keyboard.press('KeyD');
  await expectStanding(page, { x: 13, y: 10 });
  expect(errors, errors.join('\n')).toEqual([]);
});

test('holding a direction walks continuously and stops at the map edge on the grid', async ({
  page,
}, testInfo) => {
  const errors = await enterOverworld(page);
  await page.keyboard.press('ArrowUp'); // turn
  await expectStanding(page, { x: 15, y: 10, facing: 'up' });
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => (await tile(page))!.moving).toBe(true);
  // While held, the player is always mid-step (it never pauses between tiles) until the edge.
  const samples: Tile[] = [];
  for (;;) {
    const t = (await tile(page))!;
    if (t.y <= 1) break;
    samples.push(t);
    await page.waitForTimeout(40);
  }
  const ys = samples.map((s) => s.y);
  expect(samples.length).toBeGreaterThan(3);
  expect(
    samples.every((s) => s.moving),
    JSON.stringify(samples),
  ).toBe(true);
  expect(ys).toEqual([...ys].sort((a, b) => b - a)); // only goes up
  await page.waitForTimeout(800);
  expect(await tile(page)).toMatchObject({ x: 15, y: 0, facing: 'up', moving: false });
  await page.keyboard.up('ArrowUp');
  expect(await spritePos(page)).toEqual({ x: 480, y: 0 });
  await page.screenshot({ path: testInfo.outputPath(`overworld-edge-${testInfo.project.name}.png`) });
  expect(errors, errors.join('\n')).toEqual([]);
});

test('F2 (with ?debug=1) shows the map and tile coordinates, matching Tiled', async ({ page }, testInfo) => {
  await enterOverworld(page, '?debug=1');
  const lines = () =>
    page.evaluate(() =>
      (window as unknown as { __E2E__: { debugLines(): string[] | null } }).__E2E__.debugLines(),
    );
  expect(await lines()).toBeNull();
  await page.keyboard.press('F2');
  // The spawn object in test.tmj sits at pixel (480, 320) = tile (15, 10) in Tiled.
  await expect.poll(lines).toEqual(expect.arrayContaining(['Mapa: test', 'Casilla: 15, 10']));
  await page.keyboard.press('ArrowRight');
  await expectStanding(page, { x: 15, facing: 'right' });
  await page.keyboard.press('ArrowRight');
  await expectStanding(page, { x: 16, y: 10 });
  await expect.poll(lines).toEqual(expect.arrayContaining(['Casilla: 16, 10']));
  expect((await lines())!.some((l) => /^FPS: \d+$/.test(l))).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`debug-${testInfo.project.name}.png`) });
  // Since M4, F2 cycles hidden → info → teleport menu → hidden.
  await page.keyboard.press('F2');
  await expect.poll(lines).toContain('Teletransporte (A: ir, B: cerrar)');
  await page.keyboard.press('F2');
  await expect.poll(lines).toBeNull();
});

test('without ?debug=1 a production-style build has no debug overlay', async ({ page }) => {
  await enterOverworld(page);
  await page.keyboard.press('F2');
  await page.waitForTimeout(200);
  expect(
    await page.evaluate(() =>
      (window as unknown as { __E2E__: { debugLines(): string[] | null } }).__E2E__.debugLines(),
    ),
  ).toBeNull();
});
