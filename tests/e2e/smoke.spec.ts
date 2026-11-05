import { test, expect } from '@playwright/test';

declare global {
  interface Window {
    __GAME__?: { isBooted: boolean; scene: { getScenes(active: boolean): { scene: { key: string } }[] } };
  }
}

test('game boots, renders a scene, and logs no errors', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/');

  // Wait for Phaser to boot and at least one scene to be active.
  await page.waitForFunction(() => window.__GAME__?.isBooted === true);
  const activeScenes = await page.evaluate(() =>
    window.__GAME__!.scene.getScenes(true).map((s) => s.scene.key),
  );
  expect(activeScenes.length).toBeGreaterThan(0);

  // The canvas exists and is sized to the viewport.
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box!.width).toBeGreaterThan(100);

  await page.screenshot({ path: testInfo.outputPath(`boot-${testInfo.project.name}.png`) });

  expect(errors, errors.join('\n')).toEqual([]);
});
