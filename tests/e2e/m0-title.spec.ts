// M0 "Done when": a black 16:9 area with "Flexymon" centred, scaling with the window without blur.
import { test, expect, type Page } from '@playwright/test';

interface TextInfo {
  text: string;
  x: number;
  y: number;
}

const readState = (page: Page) =>
  page.evaluate(() => {
    // The hooks are untyped here on purpose: smoke.spec.ts owns the global Window declaration.
    const w = window as unknown as {
      __GAME__: {
        config: { width: number; height: number; antialias: boolean; roundPixels: boolean };
        scene: {
          getScene(key: string): {
            children: { list: { type: string; text?: string; x: number; y: number }[] };
          };
        };
      };
      __E2E__: { currentScene(): string | null };
    };
    const game = w.__GAME__;
    const texts: TextInfo[] = game.scene
      .getScene('Title')
      .children.list.filter((o) => o.type === 'Text')
      .map((o) => ({ text: o.text ?? '', x: o.x, y: o.y }));
    return {
      scene: w.__E2E__.currentScene(),
      width: game.config.width,
      height: game.config.height,
      antialias: game.config.antialias,
      roundPixels: game.config.roundPixels,
      texts,
    };
  });

test('shows "Flexymon" centred on a 16:9 canvas that scales with the window', async ({ page }, testInfo) => {
  await page.goto('/');
  // Since M1 Preload first loads every asset; since M11 the TitleScene shows once it is complete.
  await page.waitForFunction(
    () =>
      (window as unknown as { __E2E__?: { currentScene(): string | null } }).__E2E__?.currentScene() ===
      'Title',
  );

  const state = await readState(page);
  expect(state.width).toBe(512);
  expect(state.height).toBe(288);
  // pixelArt: true turns antialiasing off (nearest-neighbour scaling, no blur).
  expect(state.antialias).toBe(false);
  expect(state.roundPixels).toBe(true);
  // M11: the TitleScene shows the logo near the top and the "Pulsa START" hint near the bottom, both centred
  // (over the office picture; M0–M10 drew them in Preload at y 144 / 192).
  expect(state.texts).toEqual([
    { text: 'Flexymon', x: 256, y: 48 },
    { text: 'Pulsa START', x: 256, y: 248 },
  ]);

  const checkCanvas = async () => {
    const vp = page.viewportSize()!;
    const box = (await page.locator('canvas').boundingBox())!;
    expect(box.width / box.height).toBeCloseTo(16 / 9, 1);
    // FIT: fills one dimension; CENTER_BOTH: equal margins on the other.
    const fillsWidth = Math.abs(box.width - vp.width) < 2;
    const fillsHeight = Math.abs(box.height - vp.height) < 2;
    expect(fillsWidth || fillsHeight).toBe(true);
    expect(Math.abs(box.x - (vp.width - box.width - box.x))).toBeLessThan(2);
    expect(Math.abs(box.y - (vp.height - box.height - box.y))).toBeLessThan(2);
    return box;
  };

  const before = await checkCanvas();
  await page.screenshot({ path: testInfo.outputPath(`title-${testInfo.project.name}.png`) });

  const vp = page.viewportSize()!;
  await page.setViewportSize({ width: Math.round(vp.width * 0.6), height: vp.height });
  await expect.poll(async () => (await page.locator('canvas').boundingBox())!.width).not.toBe(before.width);
  await checkCanvas();
  await page.screenshot({ path: testInfo.outputPath(`title-resized-${testInfo.project.name}.png`) });
});
