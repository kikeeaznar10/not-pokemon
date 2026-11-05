// M12 — mobile controls and minimap (docs/PLAN.md › M12 › Done when):
// - every action in the game can be done by touch alone (title, name, intro, walking, Start menu, Mapa, battle);
// - no browser zoom, scroll or text selection happens when tapping fast;
// - the minimap dot matches the player's position (and M / Mapa toggle it; hidden indoors).
// Also: the touch overlay only on touch devices with ≥ 48 px targets, the D-pad slide and multi-touch, the
// portrait "Gira el móvil" screen that pauses the game, and the fullscreen request on the first tap.
//
// Taps use Playwright's real touchscreen (`page.touchscreen.tap`). Holding, sliding and multi-touch, which
// Playwright cannot do with a real touchscreen, dispatch `PointerEvent`s of type `touch` on the controls: the same
// events the browser sends for a finger, read by the same handlers.
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import type { E2EHooks } from '../../src/main';
import { neutralIntro } from './neutral-intro';

type Win = { __E2E__: E2EHooks; __GAME__: { isPaused: boolean } };
type Tile = { map: string; x: number; y: number; facing: string; moving: boolean };

/** Run a hook in the page. */
async function hook<T>(page: Page, fn: (e2e: E2EHooks) => T): Promise<T> {
  return page.evaluate(`(${fn.toString()})(window.__E2E__)`) as Promise<T>;
}

const isTouch = (info: TestInfo): boolean => info.project.use.hasTouch === true;

/** Turn the page to landscape (phone profiles are portrait by default). */
async function landscape(page: Page): Promise<void> {
  const v = page.viewportSize();
  if (v && v.height > v.width) await page.setViewportSize({ width: v.height, height: v.width });
}

async function boot(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => (window as unknown as Win).__E2E__?.preloadComplete() === true);
}

/** Boot and enter the overworld at the spawn (no intro), standing still. */
async function enter(page: Page): Promise<Tile> {
  await boot(page);
  await page.waitForFunction(() => (window as unknown as Win).__E2E__.quickStart());
  await page.waitForFunction(() => {
    const e = (window as unknown as Win).__E2E__;
    return e.currentScene() === 'Overworld' && !e.overworldLocked() && e.playerTile()?.moving === false;
  });
  return (await hook(page, (e) => e.playerTile())) as Tile;
}

/** Centre of a touch control (CSS pixels). */
async function centre(page: Page, id: string): Promise<{ x: number; y: number }> {
  const c = (await hook(page, (e) => e.touchControls().controls)).find((k) => k.id === id);
  if (!c) throw new Error(`no touch control "${id}"`);
  return { x: c.x + c.width / 2, y: c.y + c.height / 2 };
}

/** A real tap on a control (or on the D-pad arm `dir`), then wait two frames so the game sees it. */
async function tap(page: Page, id: string, dir?: 'up' | 'down' | 'left' | 'right'): Promise<void> {
  const c = await centre(page, id);
  const off = { up: [0, -52], down: [0, 52], left: [-52, 0], right: [52, 0] } as const;
  const [dx, dy] = dir ? off[dir] : [0, 0];
  // M15: wait two frames first, as the keyboard press() helpers do since M7 — a menu or box ignores input on the
  // frame it opens, and under load a tap could land in exactly that frame.
  await frames(page, 2);
  await page.touchscreen.tap(c.x + dx, c.y + dy);
  await frames(page, 2);
}

async function frames(page: Page, n: number): Promise<void> {
  await page.evaluate(
    (count) =>
      new Promise<void>((done) => {
        let left = count;
        const next = () => (--left <= 0 ? done() : requestAnimationFrame(next));
        requestAnimationFrame(next);
      }),
    n,
  );
}

/**
 * Send a finger event to a control, as the browser does for a touch: `pointerdown` goes to the element under the
 * finger, later events to the control the finger started on (pointer capture). (`x`, `y`) are offsets from the
 * control's centre.
 */
async function finger(
  page: Page,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  pointerId: number,
  id: string,
  x = 0,
  y = 0,
): Promise<void> {
  const c = await centre(page, id);
  await page.evaluate(
    ({ type, pointerId, id, px, py }) => {
      const control = document.querySelector(`[data-control="${id}"]`);
      const target = type === 'pointerdown' ? (document.elementFromPoint(px, py) ?? control) : control;
      target?.dispatchEvent(
        new PointerEvent(type, {
          pointerId,
          pointerType: 'touch',
          isPrimary: pointerId === 1,
          clientX: px,
          clientY: py,
          bubbles: true,
          cancelable: true,
        }),
      );
    },
    { type, pointerId, id, px: c.x + x, py: c.y + y },
  );
}

test('touch controls: only on touch devices, every target at least 48 px, inside the screen', async ({
  page,
}, testInfo) => {
  await landscape(page);
  await boot(page);
  const view = await hook(page, (e) => e.touchControls());
  const rotate = await hook(page, (e) => e.rotateScreen());
  if (!isTouch(testInfo)) {
    expect(view).toEqual({ shown: false, controls: [], pressed: [] });
    expect(rotate.touch).toBe(false);
    expect(await page.locator('[data-testid="touch-controls"]').count()).toBe(0);
    return;
  }
  expect(rotate.touch).toBe(true);
  expect(view.shown).toBe(true);
  expect(view.controls.map((c) => c.id).sort()).toEqual(['a', 'b', 'dpad', 'map', 'start']);
  const vp = page.viewportSize()!;
  for (const c of view.controls) {
    expect(c.width, c.id).toBeGreaterThanOrEqual(48);
    expect(c.height, c.id).toBeGreaterThanOrEqual(48);
    expect(c.x, c.id).toBeGreaterThanOrEqual(0);
    expect(c.y, c.id).toBeGreaterThanOrEqual(0);
    expect(c.x + c.width, c.id).toBeLessThanOrEqual(vp.width);
    expect(c.y + c.height, c.id).toBeLessThanOrEqual(vp.height);
  }
  // Each D-pad arm is a 48 px target too.
  const arms = await page.$$eval('.tc-arm', (els) => els.map((el) => el.getBoundingClientRect().width));
  expect(arms).toHaveLength(4);
  for (const w of arms) expect(w).toBeGreaterThanOrEqual(48);
  // Semi-transparent: the button background lets the game show through.
  const alpha = await page.$eval('.tc-a', (el) => getComputedStyle(el).backgroundColor);
  expect(alpha).toMatch(/rgba\(255, 255, 255, 0\.\d+\)/);
  // D-pad bottom left, A / B bottom right, Start / Mapa top right.
  const at = Object.fromEntries(view.controls.map((c) => [c.id, c]));
  expect(at.dpad!.x).toBeLessThan(vp.width / 2);
  expect(at.dpad!.y).toBeGreaterThan(vp.height / 2);
  for (const id of ['a', 'b']) {
    expect(at[id]!.x).toBeGreaterThan(vp.width / 2);
    expect(at[id]!.y).toBeGreaterThan(vp.height / 2);
  }
  for (const id of ['start', 'map']) {
    expect(at[id]!.x).toBeGreaterThan(vp.width / 2);
    expect(at[id]!.y).toBeLessThan(vp.height / 2);
  }
  await page.screenshot({ path: testInfo.outputPath('m12-touch-title.png') });
});

test('every action can be done by touch alone: title, name, intro, walking, menu, Mapa, battle', async ({
  page,
}, testInfo) => {
  test.skip(!isTouch(testInfo), 'touch devices only (the desktop has no touch controls)');
  test.setTimeout(120_000);
  await landscape(page);
  await boot(page);
  await page.waitForFunction(() => (window as unknown as Win).__E2E__.currentScene() === 'Title');

  // Title: A opens the menu (no save: only Nueva partida), A chooses it.
  await tap(page, 'a');
  await expect.poll(() => hook(page, (e) => e.title()?.ui)).toBe('menu');
  await tap(page, 'a');
  await expect.poll(() => hook(page, (e) => e.currentScene())).toBe('Name');

  // Name: A presses the cell under the cursor ("A"), the D-pad moves the cursor, B deletes (text mode does not
  // affect touch), Start is OK.
  await tap(page, 'a');
  await tap(page, 'dpad', 'right');
  await tap(page, 'a');
  await expect.poll(() => hook(page, (e) => e.nameEntry()?.name)).toBe('AB');
  await tap(page, 'b');
  await expect.poll(() => hook(page, (e) => e.nameEntry()?.name)).toBe('A');
  // The cursor is still on B: two more steps right reach D.
  await tap(page, 'dpad', 'right');
  await tap(page, 'dpad', 'right');
  await expect.poll(() => hook(page, (e) => e.nameEntry()?.cell)).toBe('D');
  await tap(page, 'a');
  await expect.poll(() => hook(page, (e) => e.nameEntry()?.name)).toBe('AD');
  await tap(page, 'start');
  await expect.poll(() => hook(page, (e) => e.currentScene())).toBe('Intro');

  // Intro: A through every dialogue box until free movement.
  for (let i = 0; i < 80; i++) {
    const free = await hook(
      page,
      (e) => e.currentScene() === 'Overworld' && !e.overworldLocked() && e.playerTile()?.moving === false,
    );
    if (free) break;
    await tap(page, 'a');
    await page.waitForTimeout(100);
  }
  expect(await hook(page, (e) => e.currentScene())).toBe('Overworld');
  expect(await hook(page, (e) => e.playerName())).toBe('AD');
  const start = (await hook(page, (e) => e.playerTile())) as Tile;

  // Walking: a tap on a new direction turns, the next tap walks one tile.
  await tap(page, 'dpad', 'right');
  await expect.poll(() => hook(page, (e) => e.playerTile()?.facing)).toBe('right');
  await tap(page, 'dpad', 'right');
  await expect
    .poll(() => hook(page, (e) => e.playerTile()))
    .toMatchObject({ x: start.x + 1, y: start.y, moving: false });

  // Mapa toggles the minimap.
  expect(await hook(page, (e) => e.minimap()?.shown)).toBe(true);
  await tap(page, 'map');
  await expect.poll(() => hook(page, (e) => e.minimap()?.visible)).toBe(false);
  await tap(page, 'map');
  await expect.poll(() => hook(page, (e) => e.minimap()?.visible)).toBe(true);

  // Start opens the menu, the D-pad moves its cursor, B closes it.
  await tap(page, 'start');
  await expect.poll(() => hook(page, (e) => e.menu()?.ui)).toBe('main');
  await tap(page, 'dpad', 'down');
  await expect.poll(() => hook(page, (e) => e.menu()?.menu?.cursor)).toBe(1);
  await tap(page, 'b');
  await expect.poll(() => hook(page, (e) => e.menu())).toBeNull();
  await expect.poll(() => hook(page, (e) => e.overworldLocked())).toBe(false);

  // Battle: A through the messages, the D-pad to Huir, A to flee.
  expect(await hook(page, (e) => e.startBattle(7))).toBe(true);
  await expect.poll(() => hook(page, (e) => e.battle()?.ui), { timeout: 15_000 }).not.toBeUndefined();
  for (let i = 0; i < 30 && (await hook(page, (e) => e.battle()?.ui)) !== 'main'; i++) {
    await tap(page, 'a');
    await page.waitForTimeout(100);
  }
  expect(await hook(page, (e) => e.battle()?.ui)).toBe('main');
  const fleeLabel = await hook(page, (e) => e.battle()!.menu!.options[3]!.label);
  await tap(page, 'dpad', 'right');
  await tap(page, 'dpad', 'down');
  await expect.poll(() => hook(page, (e) => e.battle()?.menu?.cursor)).toBe(3);
  expect(fleeLabel).toBe('Huir');
  await tap(page, 'a');
  for (let i = 0; i < 30 && (await hook(page, (e) => e.currentScene())) !== 'Overworld'; i++) {
    await tap(page, 'a');
    await page.waitForTimeout(150);
  }
  await expect.poll(() => hook(page, (e) => e.currentScene()), { timeout: 10_000 }).toBe('Overworld');
  await page.screenshot({ path: testInfo.outputPath('m12-touch-overworld.png') });
});

test('D-pad: holding walks, sliding the thumb changes direction without lifting, multi-touch with A', async ({
  page,
}, testInfo) => {
  test.skip(!isTouch(testInfo), 'touch devices only');
  await landscape(page);
  const start = await enter(page);

  // Hold right: the player turns, then keeps walking.
  await finger(page, 'pointerdown', 1, 'dpad', 52, 0);
  expect(await hook(page, (e) => e.inputDown())).toEqual(['right']);
  await expect.poll(() => hook(page, (e) => e.playerTile()!.x)).toBeGreaterThanOrEqual(start.x + 2);
  // Slide the same finger to the up arm: now it walks up, with no lift in between.
  await finger(page, 'pointermove', 1, 'dpad', 4, -52);
  expect(await hook(page, (e) => e.inputDown())).toEqual(['up']);
  expect(await hook(page, (e) => e.touchControls().pressed)).toEqual(['dpad:up']);
  await expect.poll(() => hook(page, (e) => e.playerTile()!.y)).toBeLessThanOrEqual(start.y - 2);
  // Slide off the pad, still above it: still up.
  await finger(page, 'pointermove', 1, 'dpad', 10, -160);
  expect(await hook(page, (e) => e.inputDown())).toEqual(['up']);
  // A second finger holds B while the first still holds the D-pad.
  await finger(page, 'pointerdown', 2, 'b');
  expect((await hook(page, (e) => e.inputDown())).sort()).toEqual(['b', 'up']);
  expect((await hook(page, (e) => e.touchControls().pressed)).sort()).toEqual(['b', 'dpad:up']);
  // Lifting the thumb releases the D-pad only.
  await finger(page, 'pointerup', 1, 'dpad', 10, -160);
  expect(await hook(page, (e) => e.inputDown())).toEqual(['b']);
  await finger(page, 'pointerup', 2, 'b');
  expect(await hook(page, (e) => e.inputDown())).toEqual([]);
  await expect.poll(() => hook(page, (e) => e.playerTile()?.moving)).toBe(false);
  // The centre of the pad is a dead zone.
  await finger(page, 'pointerdown', 3, 'dpad', 0, 0);
  expect(await hook(page, (e) => e.inputDown())).toEqual([]);
  await finger(page, 'pointerup', 3, 'dpad', 0, 0);
});

test('tapping fast never zooms, scrolls or selects text', async ({ page }, testInfo) => {
  test.skip(!isTouch(testInfo), 'touch devices only');
  await landscape(page);
  await enter(page);
  const ids = ['a', 'b', 'dpad', 'a', 'a', 'map', 'map', 'b'];
  const points = await Promise.all(ids.map((id) => centre(page, id)));
  const canvas = (await page.locator('canvas').boundingBox())!;
  points.push({ x: canvas.x + canvas.width / 2, y: canvas.y + canvas.height / 3 });
  for (let round = 0; round < 6; round++) for (const p of points) await page.touchscreen.tap(p.x, p.y);
  const state = await page.evaluate(() => ({
    scale: window.visualViewport?.scale ?? 1,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    selection: window.getSelection()?.toString() ?? '',
    bodyTouchAction: getComputedStyle(document.body).touchAction,
    controlTouchAction: getComputedStyle(document.querySelector('.tc-a')!).touchAction,
    userSelect: getComputedStyle(document.querySelector('.tc-a')!).userSelect,
    viewport: document.querySelector('meta[name=viewport]')?.getAttribute('content') ?? '',
  }));
  expect(state.scale).toBe(1);
  expect(state.scrollX).toBe(0);
  expect(state.scrollY).toBe(0);
  expect(state.selection).toBe('');
  expect(state.bodyTouchAction).toBe('none');
  expect(state.controlTouchAction).toBe('none');
  expect(state.userSelect).toBe('none');
  expect(state.viewport).toContain('user-scalable=no');
  // The controls and the page cancel the browser's default for touches, double taps and long presses.
  const prevented = await page.evaluate(() =>
    ['touchstart', 'touchmove', 'touchend', 'contextmenu', 'dblclick', 'selectstart'].map((type) => {
      const ev = new Event(type, { bubbles: true, cancelable: true });
      document.querySelector('.tc-a')!.dispatchEvent(ev);
      return ev.defaultPrevented;
    }),
  );
  expect(prevented).toEqual([true, true, true, true, true, true]);
  const pagePrevented = await page.evaluate(() =>
    ['touchmove', 'gesturestart', 'dblclick'].map((type) => {
      const ev = new Event(type, { bubbles: true, cancelable: true });
      document.body.dispatchEvent(ev);
      return ev.defaultPrevented;
    }),
  );
  expect(pagePrevented).toEqual([true, true, true]);
  // The game is still fine and nothing is stuck down.
  expect(await hook(page, (e) => e.inputDown())).toEqual([]);
  expect(await hook(page, (e) => e.currentScene())).toBe('Overworld');
});

test('portrait shows "Gira el móvil" and pauses the game; landscape resumes it', async ({
  page,
}, testInfo) => {
  // The phone profiles start with the E2E portrait switch on (playwright.config.ts): turn it off here.
  await page.addInitScript(() => window.localStorage.removeItem('flexymon.e2e.allowPortrait'));
  const v = page.viewportSize()!;
  const portrait = { width: Math.min(v.width, v.height), height: Math.max(v.width, v.height) };
  const wide = { width: portrait.height, height: portrait.width };
  await page.setViewportSize(portrait);
  await page.goto('/');
  const screen = page.locator('[data-testid="rotate-screen"]');
  if (!isTouch(testInfo)) {
    // A desktop window may be tall: no guard there.
    await page.waitForFunction(() => (window as unknown as Win).__E2E__?.preloadComplete() === true);
    expect(await hook(page, (e) => e.rotateScreen())).toEqual({ shown: false, paused: false, touch: false });
    expect(await screen.count()).toBe(0);
    return;
  }
  await page.waitForFunction(() => (window as unknown as Win).__E2E__ !== undefined);
  await expect(screen).toBeVisible();
  await expect(screen).toContainText('Gira el móvil');
  expect(await hook(page, (e) => e.rotateScreen())).toEqual({ shown: true, paused: true, touch: true });
  // Paused from the start: nothing loads while the phone is upright.
  await page.waitForTimeout(800);
  expect(await hook(page, (e) => e.preloadComplete())).toBe(false);
  await page.screenshot({ path: testInfo.outputPath('m12-rotate.png') });

  await page.setViewportSize(wide);
  await expect(screen).toBeHidden();
  await expect
    .poll(() => hook(page, (e) => e.rotateScreen()))
    .toEqual({ shown: false, paused: false, touch: true });
  await page.waitForFunction(() => (window as unknown as Win).__E2E__.preloadComplete());
  await page.waitForFunction(() => (window as unknown as Win).__E2E__.quickStart());
  await expect.poll(() => hook(page, (e) => e.currentScene())).toBe('Overworld');

  // Upright again while playing: the game stops (its clock and the player stand still) until turned back.
  await page.setViewportSize(portrait);
  await expect(screen).toBeVisible();
  await expect.poll(() => hook(page, (e) => e.rotateScreen().paused)).toBe(true);
  const clock = () =>
    page.evaluate(
      () =>
        (
          window as unknown as { __GAME__: { scene: { getScene(k: string): { time: { now: number } } } } }
        ).__GAME__.scene.getScene('Overworld').time.now,
    );
  const before = await clock();
  const tile = await hook(page, (e) => e.playerTile());
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(600);
  await page.keyboard.up('ArrowDown');
  expect(await clock()).toBe(before);
  expect(await hook(page, (e) => e.playerTile())).toEqual(tile);
  await page.setViewportSize(wide);
  await expect(screen).toBeHidden();
  await expect.poll(() => hook(page, (e) => e.rotateScreen().paused)).toBe(false);
  await expect.poll(clock).toBeGreaterThan(before);
});

test('the first tap asks for fullscreen', async ({ page }, testInfo) => {
  test.skip(!isTouch(testInfo), 'touch devices only');
  await landscape(page);
  await boot(page);
  expect(await hook(page, (e) => e.fullscreenRequested())).toBe(false);
  const canvas = (await page.locator('canvas').boundingBox())!;
  await page.touchscreen.tap(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  await expect.poll(() => hook(page, (e) => e.fullscreenRequested())).toBe(true);
  // The tap still reached the game: the title menu opened.
  await expect.poll(() => hook(page, (e) => e.title()?.ui)).toBe('menu');
});

/** Where the dot must be for the player's tile, from the minimap's frame (base pixels, rounded like the sprite). */
function expectedDot(m: NonNullable<ReturnType<E2EHooks['minimap']>>): { x: number; y: number } {
  const f = m.frame!;
  return {
    x: Math.round(f.x + ((m.tile.x + 0.5) * f.width) / m.mapSize.width),
    y: Math.round(f.y + ((m.tile.y + 0.5) * f.height) / m.mapSize.height),
  };
}

async function walk(page: Page, key: string, expected: Partial<Tile>): Promise<void> {
  await page.keyboard.press(key);
  await expect.poll(() => hook(page, (e) => e.playerTile())).toMatchObject({ ...expected, moving: false });
  // M15: the minimap follows the player in the overworld's next update, so let a frame pass before reading it.
  await frames(page, 2);
}

test('minimap: the dot matches the player, M toggles it, hidden indoors, Mapa in the Start menu', async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  // Start just below the house door so the interior is one step away.
  await page.route('**/data/start.json', async (route) => {
    const res = await route.fetch();
    const start = (await res.json()) as Record<string, unknown>;
    const spawn = { map: 'test', x: 6, y: 8, facing: 'right' };
    await route.fulfill({ response: res, body: JSON.stringify({ ...start, spawn }) });
  });
  await neutralIntro(page, 'test');
  await landscape(page);
  const start = await enter(page);
  expect(start).toMatchObject({ map: 'test', x: 6, y: 8 });

  let m = (await hook(page, (e) => e.minimap()))!;
  expect(m).toMatchObject({ zone: 'test', shown: true, visible: true, available: true });
  expect(m.mapSize).toEqual({ width: 30, height: 20 });
  // The placeholder is 3 px per tile (90 × 60), drawn unscaled in the top-left corner.
  expect(m.frame).toEqual({ x: 4, y: 4, width: 90, height: 60, scale: 1 });
  expect(m.tile).toEqual({ x: 6, y: 8 });
  expect(m.dot).toEqual(expectedDot(m));
  expect(m.dot).toEqual({ x: 24, y: 30 }); // 4 + 6.5 × 3 = 23.5 → 24, 4 + 8.5 × 3 = 29.5 → 30

  // The dot follows every step.
  await walk(page, 'ArrowRight', { x: 7, y: 8 });
  await walk(page, 'ArrowRight', { x: 8, y: 8 });
  m = (await hook(page, (e) => e.minimap()))!;
  expect(m.tile).toEqual({ x: 8, y: 8 });
  expect(m.dot).toEqual(expectedDot(m));
  // It blinks.
  const seen = new Set<boolean>();
  for (let i = 0; i < 20 && seen.size < 2; i++) {
    seen.add((await hook(page, (e) => e.minimap()!.dotOn)) as boolean);
    await page.waitForTimeout(80);
  }
  expect([...seen].sort()).toEqual([false, true]);
  await page.screenshot({ path: testInfo.outputPath('m12-minimap.png') });

  // M toggles it.
  await page.keyboard.press('m');
  await expect.poll(() => hook(page, (e) => e.minimap()?.visible)).toBe(false);
  expect(await hook(page, (e) => e.minimap()?.shown)).toBe(false);
  await page.keyboard.press('m');
  await expect.poll(() => hook(page, (e) => e.minimap()?.visible)).toBe(true);

  // Into the house: no minimap indoors.
  await walk(page, 'ArrowLeft', { x: 8, facing: 'left' });
  await walk(page, 'ArrowLeft', { x: 7 });
  await walk(page, 'ArrowLeft', { x: 6 });
  await walk(page, 'ArrowUp', { x: 6, y: 8, facing: 'up' });
  await walk(page, 'ArrowUp', { x: 6, y: 7 });
  await page.keyboard.press('ArrowUp'); // the door (6, 6)
  await expect.poll(() => hook(page, (e) => e.playerTile()?.map)).toBe('test_house');
  await expect.poll(() => hook(page, (e) => e.overworldLocked())).toBe(false);
  m = (await hook(page, (e) => e.minimap()))!;
  expect(m).toMatchObject({ zone: 'test_house', shown: true, visible: false, available: false, dot: null });
  // M indoors changes the choice but still shows nothing.
  await page.keyboard.press('m');
  await expect.poll(() => hook(page, (e) => e.minimap()?.shown)).toBe(false);
  expect(await hook(page, (e) => e.minimap()?.visible)).toBe(false);
  await page.keyboard.press('m');
  await expect.poll(() => hook(page, (e) => e.minimap()?.shown)).toBe(true);

  // Start menu › Mapa indoors only explains.
  await openMapEntry(page);
  await expect.poll(() => hook(page, (e) => e.menu()?.message)).toBe('Aquí dentro no hay mapa.');
  await closeMenu(page);
  expect(await hook(page, (e) => e.minimap()?.shown)).toBe(true);

  // Back outside: shown again, at the door.
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => hook(page, (e) => e.playerTile()?.facing)).toBe('down');
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => hook(page, (e) => e.playerTile()?.map)).toBe('test');
  await expect.poll(() => hook(page, (e) => e.overworldLocked())).toBe(false);
  m = (await hook(page, (e) => e.minimap()))!;
  expect(m).toMatchObject({ zone: 'test', visible: true, tile: { x: 6, y: 7 } });
  expect(m.dot).toEqual(expectedDot(m));

  // Start menu › Mapa outdoors toggles it, and says so.
  await openMapEntry(page);
  await expect.poll(() => hook(page, (e) => e.menu()?.message)).toBe('Minimapa desactivado.');
  expect(await hook(page, (e) => e.minimap()?.visible)).toBe(false);
  await closeMenu(page);
  await openMapEntry(page);
  await expect.poll(() => hook(page, (e) => e.menu()?.message)).toBe('Minimapa activado.');
  expect(await hook(page, (e) => e.minimap()?.visible)).toBe(true);
  await closeMenu(page);
});

/** Start → the menu, down twice to Mapa, A (the dialogue then shows the message). */
async function openMapEntry(page: Page): Promise<void> {
  await page.keyboard.press('Enter');
  await expect.poll(() => hook(page, (e) => e.menu()?.ui)).toBe('main');
  await frames(page, 2);
  for (const want of [1, 2]) {
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => hook(page, (e) => e.menu()?.menu?.cursor)).toBe(want);
  }
  await page.keyboard.press('z');
  await expect.poll(() => hook(page, (e) => e.menu()?.ui)).toBe('message');
}

/** Close the message with A (until the main menu is back), then close the menu with B. */
async function closeMenu(page: Page): Promise<void> {
  for (let i = 0; i < 10 && (await hook(page, (e) => e.menu()?.ui)) !== 'main'; i++) {
    await page.keyboard.press('z');
    await page.waitForTimeout(150);
  }
  await expect.poll(() => hook(page, (e) => e.menu()?.ui)).toBe('main');
  await frames(page, 2);
  await page.keyboard.press('x');
  await expect.poll(() => hook(page, (e) => e.menu())).toBeNull();
  await expect.poll(() => hook(page, (e) => e.overworldLocked())).toBe(false);
}
