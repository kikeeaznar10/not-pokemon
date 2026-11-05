// M13 "Done when": without the items the car only talks; with any valid pair it drives; the items are still in
// the bag afterwards; returning from Murcia lands next to the office car. Plus: "¿Subir al Audi?" with Sí / No
// (B = No), the trip scene (direction, 4–6 s, not skippable in the first second, any button skips after it).
// Test maps (public/maps/README.md): the office Audi is on `test` (8–9, 11); the "Murcia" Audi on `test_east`
// (2–3, 9); car.json lands on test_east (2, 10) and test (8, 12). The player starts next to a car
// (start.json served with another spawn).
import { test, expect, type Page } from '@playwright/test';
import { neutralIntro } from './neutral-intro';

interface Tile {
  map: string;
  x: number;
  y: number;
  facing: string;
  moving: boolean;
}
interface CarTrip {
  to: string;
  elapsedMs: number;
  skippable: boolean;
  finished: boolean;
  skipped: boolean;
  flipped: boolean;
}
type Hooks = Record<string, (...a: unknown[]) => unknown>;

const hook = <T>(page: Page, name: string, ...args: unknown[]): Promise<T> =>
  page.evaluate(
    ([n, a]) => (window as unknown as { __E2E__: Hooks }).__E2E__[n as string]!(...(a as unknown[])),
    [name, args] as const,
  ) as Promise<T>;
const tile = (page: Page) => hook<Tile | null>(page, 'playerTile');
const dialogue = (page: Page) => hook<{ full: string } | null>(page, 'dialogue');
const choice = (page: Page) => hook<{ options: string[]; cursor: number } | null>(page, 'choice');
const trip = (page: Page) => hook<CarTrip | null>(page, 'carTrip');

const LOCKED = 'El Audi está cerrado. Te falta algo...';
const ASK = '¿Subir al Audi?';

/** Serve start.json with the player standing at `spawn` (and an intro that fits that map). */
async function startAt(page: Page, spawn: object): Promise<void> {
  await page.route('**/data/start.json', async (route) => {
    const res = await route.fetch();
    const start = (await res.json()) as Record<string, unknown>;
    await route.fulfill({ response: res, body: JSON.stringify({ ...start, spawn }) });
  });
  await neutralIntro(page, (spawn as { map: string }).map);
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
  await page.waitForFunction(() =>
    (window as unknown as { __E2E__: { quickStart(): boolean } }).__E2E__.quickStart(),
  );
  await standing(page, expected);
  return errors;
}

async function standing(page: Page, expected: Partial<Tile> = {}): Promise<void> {
  await expect
    .poll(async () => ({ ...(await tile(page)), locked: await hook<boolean>(page, 'overworldLocked') }), {
      timeout: 15_000,
    })
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

/** A facing the car: the question stays on screen with Sí / No beside it. */
async function askForCar(page: Page): Promise<void> {
  await press(page, 'z');
  await expect.poll(() => choice(page)).toEqual({ options: ['Sí', 'No'], cursor: 0 });
  expect((await dialogue(page))?.full).toBe(ASK);
}

test('without a pair the car only talks; with one it drives to Murcia and the items stay', async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  await startAt(page, { map: 'test', x: 8, y: 10, facing: 'down' }); // the Audi is just below
  const errors = await enterOverworld(page, { map: 'test', x: 8, y: 10, facing: 'down' });

  // No pair: only the locked dialogue, no question, the player stays.
  for (const bag of [{}, { llaves_audi: 1 }, { carnet: 1, cafe_doble: 1 }]) {
    await hook(page, 'setItems', bag);
    await press(page, 'z');
    expect(await readDialogue(page)).toEqual([LOCKED]);
    expect(await choice(page)).toBeNull();
    await standing(page, { map: 'test', x: 8, y: 10 });
  }
  await page.screenshot({ path: testInfo.outputPath('m13-locked.png') });

  // Either pair opens it. Keys + licence: the question; No (B) keeps the player here.
  await hook(page, 'setItems', { llaves_audi: 1, carnet: 1 });
  await askForCar(page);
  await press(page, 'x');
  await expect.poll(() => choice(page)).toBeNull();
  await standing(page, { map: 'test', x: 8, y: 10 });

  // Keys + double coffee: the question again; this time the No option chosen with the cursor.
  const bag = { llaves_audi: 1, cafe_doble: 2, cafe: 3 };
  await hook(page, 'setItems', bag);
  await askForCar(page);
  await page.screenshot({ path: testInfo.outputPath('m13-ask.png') });
  await press(page, 'ArrowDown');
  await expect.poll(() => choice(page)).toMatchObject({ cursor: 1 });
  await press(page, 'z');
  await expect.poll(() => choice(page)).toBeNull();
  expect(await dialogue(page)).toBeNull();
  await standing(page, { map: 'test', x: 8, y: 10 });
  expect(await trip(page)).toBeNull();

  // Sí: the trip to Murcia plays out (nose to the right) and lands on car.json › toMurcia.
  await askForCar(page);
  await press(page, 'z');
  await expect.poll(() => trip(page)).toMatchObject({ to: 'murcia', flipped: false, finished: false });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: testInfo.outputPath('m13-trip.png') });
  let last: CarTrip | null = null;
  await expect
    .poll(
      async () => {
        const t = await trip(page);
        if (t) last = t;
        return t;
      },
      { timeout: 15_000, intervals: [50] }, // sample often: the finished state lasts one 200 ms fade
    )
    .toBeNull();
  expect(last).toMatchObject({ finished: true, skipped: false });
  expect(last!.elapsedMs).toBeGreaterThanOrEqual(5000);
  await standing(page, { map: 'test_east', x: 2, y: 10, facing: 'down' });
  expect(await hook(page, 'items')).toEqual(bag);
  await page.screenshot({ path: testInfo.outputPath('m13-murcia.png') });
  expect(errors).toEqual([]);
});

test('the Murcia car needs nothing, can be skipped after 1 s and lands next to the office car', async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  await startAt(page, { map: 'test_east', x: 3, y: 10, facing: 'up' }); // the Murcia Audi is just above
  const errors = await enterOverworld(page, { map: 'test_east', x: 3, y: 10, facing: 'up' });
  await hook(page, 'setItems', {});

  await askForCar(page);
  await press(page, 'z');
  await expect.poll(() => trip(page)).toMatchObject({ to: 'valencia', flipped: true });
  // Too early: a button does nothing during the first second.
  const early = (await trip(page))!;
  expect(early.skippable).toBe(false);
  await page.keyboard.press('z');
  await page.waitForTimeout(100);
  expect(await trip(page)).toMatchObject({ finished: false, skipped: false });
  await expect.poll(async () => (await trip(page))?.skippable).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('m13-trip-back.png') });
  await press(page, 'x'); // any button
  await expect.poll(() => trip(page), { intervals: [50] }).toMatchObject({ finished: true, skipped: true });
  const elapsed = (await trip(page))?.elapsedMs ?? 0;
  expect(elapsed).toBeGreaterThanOrEqual(1000);
  expect(elapsed).toBeLessThan(5000);

  // Back at car.json › toValencia (8, 12), right below the office Audi (8–9, 11).
  await standing(page, { map: 'test', x: 8, y: 12, facing: 'down' });
  expect(await hook(page, 'items')).toEqual({});
  await press(page, 'ArrowUp'); // turn to face the car
  await standing(page, { x: 8, y: 12, facing: 'up' });
  await press(page, 'z');
  expect(await readDialogue(page)).toEqual([LOCKED]); // it is the office car, and the bag is empty
  await page.screenshot({ path: testInfo.outputPath('m13-back-office.png') });
  // The trip back saved the new position (M10 map save on arrival).
  expect(await hook<string[]>(page, 'saveRequests')).toContain('map');
  expect(errors).toEqual([]);
});
