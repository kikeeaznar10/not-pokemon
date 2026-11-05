// M5 "Done when": adding a new talker to npcs.json makes it appear and talk with no code change;
// wandering NPCs never leave their rectangle; the player can never end up inside an NPC. Plus: the
// dialogue box types, A reveals then advances, the arrow/`more` flag, the voice, the healer/storage
// talk order (M9 replaced the "[curar]"/"[caja]" placeholders with the real heal and storage box) and the ChoiceBox.
// Extra NPCs are injected by intercepting `data/npcs.json` (no code or shipped data changes).
// The shipped becario wanders in the same rectangle, so three wanderers share it with the player. Since M8
// an enemy walks out of its rectangle to challenge the player, so this test serves it as a talker.
// The wander watch lasts M5_WATCH_MS (default 20 s; run once with 120000 for the plan's 2 minutes).
import { test, expect, type Page } from '@playwright/test';

interface Tile {
  map: string;
  x: number;
  y: number;
  facing: string;
  moving: boolean;
}
interface NpcInfo extends Tile {
  id: string;
  talking: boolean;
}
interface Dialog {
  page: number;
  pages: number;
  text: string;
  full: string;
  typed: boolean;
  more: boolean;
  voicePlays: number;
}
type Hooks = Record<string, (...a: unknown[]) => unknown>;

const WATCH_MS = Number(process.env.M5_WATCH_MS ?? 20_000);

const hook = <T>(page: Page, name: string, ...args: unknown[]): Promise<T> =>
  page.evaluate(
    ([n, a]) => (window as unknown as { __E2E__: Hooks }).__E2E__[n as string]!(...(a as unknown[])),
    [name, args] as const,
  ) as Promise<T>;
const tile = (page: Page) => hook<Tile | null>(page, 'playerTile');
const npcs = (page: Page) => hook<NpcInfo[]>(page, 'npcs');
const dialog = (page: Page) => hook<Dialog | null>(page, 'dialogue');

async function standing(page: Page, expected: Partial<Tile>): Promise<void> {
  await expect
    .poll(async () => ({ ...(await tile(page)), locked: await hook<boolean>(page, 'overworldLocked') }))
    .toMatchObject({ ...expected, moving: false, locked: false });
}

const npc = (over: Record<string, unknown>) => ({
  type: 'talker',
  name: 'Prueba',
  sprite: 'assets/sprites/npcs/camarero.png',
  voice: 'assets/audio/sfx/voice_low.ogg',
  map: 'test',
  facing: 'down',
  wander: null,
  ...over,
});

/**
 * Serve npcs.json with `extra` appended and, optionally, a different new-game spawn. With `talkersOnly`,
 * shipped enemies become talkers (M8: they would otherwise walk out of their rectangle to battle).
 */
async function patchData(page: Page, extra: object[], spawn?: object, talkersOnly = false): Promise<void> {
  await page.route('**/data/npcs.json', async (route) => {
    const res = await route.fetch();
    let list = (await res.json()) as Record<string, unknown>[];
    if (talkersOnly) {
      list = list.map((n) => {
        if (n.type !== 'enemy') return n;
        const talker: Record<string, unknown> = { ...n, type: 'talker' };
        for (const k of ['sight', 'team', 'reward', 'defeatDialogue']) delete talker[k];
        return talker;
      });
    }
    await route.fulfill({ response: res, body: JSON.stringify([...list, ...extra]) });
  });
  if (spawn) {
    await page.route('**/data/start.json', async (route) => {
      const res = await route.fetch();
      const start = (await res.json()) as Record<string, unknown>;
      await route.fulfill({ response: res, body: JSON.stringify({ ...start, spawn }) });
    });
  }
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

/** Press A (Z) and wait for the dialogue box to reach `expected`. */
async function pressA(page: Page, expected: Partial<Dialog> | null): Promise<void> {
  await page.keyboard.press('z');
  if (expected === null) await expect.poll(() => dialog(page)).toBeNull();
  else await expect.poll(() => dialog(page)).toMatchObject(expected);
}

const LONG =
  'Esta frase es bastante larga a propósito, para comprobar que el texto se parte en varias líneas y que, ' +
  'si no cabe en una sola caja, sigue en la siguiente sin perder ninguna palabra. Así nadie se queda sin ' +
  'leer lo que el camarero tiene que contar sobre las bravas, el café y el tráfico de la V-21.';

test('a talker added to npcs.json appears, turns to the player and talks through the box', async ({
  page,
}, testInfo) => {
  await patchData(page, [
    npc({ id: 'vecina_test', spawn: { x: 17, y: 10 }, dialogue: ['¡Hola! Soy nueva en la oficina.', LONG] }),
  ]);
  const errors = await enterOverworld(page, { map: 'test', x: 15, y: 10 });
  expect(await npcs(page)).toEqual([
    // `state` (null: not an enemy) and `alert` were added in M8.
    {
      id: 'vecina_test',
      x: 17,
      y: 10,
      facing: 'down',
      moving: false,
      talking: false,
      state: null,
      alert: false,
    },
  ]);

  // The NPC blocks the player: walking right stops at (16, 10).
  await page.keyboard.press('ArrowRight');
  await standing(page, { x: 15, facing: 'right' });
  await page.keyboard.down('ArrowRight');
  await standing(page, { x: 16 });
  await page.waitForTimeout(600);
  await page.keyboard.up('ArrowRight');
  await standing(page, { x: 16, y: 10, facing: 'right' });

  // A: the NPC faces the player, the box types out.
  await page.keyboard.press('z');
  await expect.poll(() => dialog(page)).toMatchObject({ page: 0, full: '¡Hola! Soy nueva en la oficina.' });
  expect(await hook<boolean>(page, 'overworldLocked')).toBe(true);
  expect((await npcs(page))[0]).toMatchObject({ facing: 'left', talking: true });
  const first = (await dialog(page))!;
  expect(first.typed).toBe(false);
  expect(first.more).toBe(true);
  await page.waitForTimeout(300);
  await page.screenshot({ path: testInfo.outputPath(`typing-${testInfo.project.name}.png`) });

  // A while typing shows everything; the player cannot move meanwhile.
  await pressA(page, { page: 0, typed: true, text: '¡Hola! Soy nueva en la oficina.' });
  expect((await dialog(page))!.voicePlays).toBeGreaterThan(0);
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(300);
  expect(await tile(page)).toMatchObject({ x: 16, facing: 'right' });
  await page.screenshot({ path: testInfo.outputPath(`arrow-a-${testInfo.project.name}.png`) });
  await page.waitForTimeout(400); // the arrow blinks: one of these two screenshots shows it
  await page.screenshot({ path: testInfo.outputPath(`arrow-b-${testInfo.project.name}.png`) });

  // The long string wraps (several lines) and continues on more boxes; every word is shown.
  await pressA(page, { page: 1 });
  const d = (await dialog(page))!;
  expect(d.pages).toBeGreaterThan(2);
  expect(d.full).toContain('\n');
  const words: string[] = [];
  for (let p = 1; p < d.pages; p += 1) {
    await expect.poll(async () => (await dialog(page))!.typed, { timeout: 15_000 }).toBe(true);
    words.push(...(await dialog(page))!.full.split(/\s+/));
    await page.screenshot({ path: testInfo.outputPath(`long-${p}-${testInfo.project.name}.png`) });
    await pressA(page, p + 1 < d.pages ? { page: p + 1 } : null);
  }
  expect(words.join(' ')).toBe(LONG);

  // After the last box the player moves again; the NPC stays still (no wander) facing the player.
  expect((await npcs(page))[0]).toMatchObject({ facing: 'left', talking: false });
  await page.keyboard.press('ArrowLeft');
  await standing(page, { facing: 'left' });
  await page.keyboard.press('ArrowLeft');
  await standing(page, { x: 15, y: 10 });
  expect(errors).toEqual([]);
});

test('healer heals before its dialogue; storage opens the box after it (M9)', async ({ page }) => {
  await patchData(page, [
    npc({
      id: 'enfermera_test',
      type: 'healer',
      spawn: { x: 15, y: 9 },
      dialogue: ['¡Ya estás como nuevo!'],
    }),
    npc({ id: 'caja_test', type: 'storage', spawn: { x: 16, y: 10 }, dialogue: ['Aquí guardas tus cosas.'] }),
  ]);
  await enterOverworld(page, { map: 'test', x: 15, y: 10 });

  await page.keyboard.press('ArrowUp');
  await standing(page, { facing: 'up' });
  await pressA(page, { page: 0, full: 'Tus flexymon están como nuevos.' });
  await pressA(page, { page: 0, typed: true });
  await pressA(page, { page: 1, full: '¡Ya estás como nuevo!' });
  await pressA(page, { typed: true });
  await pressA(page, null);
  await standing(page, { facing: 'up' });

  await page.keyboard.press('ArrowRight');
  await standing(page, { facing: 'right', x: 15 });
  await pressA(page, { page: 0, full: 'Aquí guardas tus cosas.' });
  await pressA(page, { typed: true });
  await pressA(page, null);
  await expect.poll(() => hook(page, 'storage')).not.toBeNull();
  await nextFrames(page);
  await page.keyboard.press('x');
  await expect.poll(() => hook(page, 'storage')).toBeNull();
  await standing(page, { x: 15, y: 10 });
});

/**
 * Wait two animation frames, so at least one game update ran: a ChoiceBox ignores input on the frame it
 * opens, and a key pressed in that frame would be lost (flaky under load).
 */
const nextFrames = (page: Page) =>
  page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );

test('choice box: cursor wraps, A chooses, B cancels', async ({ page }, testInfo) => {
  await enterOverworld(page, { map: 'test', x: 15, y: 10 });
  await hook(page, 'openChoice', ['Sí', 'No']);
  await expect.poll(() => hook(page, 'choice')).toEqual({ options: ['Sí', 'No'], cursor: 0 });
  expect(await hook<boolean>(page, 'overworldLocked')).toBe(true);
  await nextFrames(page);
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => hook(page, 'choice')).toMatchObject({ cursor: 1 });
  await page.screenshot({ path: testInfo.outputPath(`choice-${testInfo.project.name}.png`) });
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => hook(page, 'choice')).toMatchObject({ cursor: 0 });
  await page.keyboard.press('ArrowUp');
  await expect.poll(() => hook(page, 'choice')).toMatchObject({ cursor: 1 });
  await page.keyboard.press('z');
  await expect.poll(() => hook(page, 'choiceResult')).toBe(1);
  expect(await hook(page, 'choice')).toBeNull();
  expect(await tile(page)).toMatchObject({ x: 15, y: 10 }); // arrows moved the cursor, not the player

  await hook(page, 'openChoice', ['Llevármelo', 'Dejarlo']);
  await expect.poll(() => hook(page, 'choice')).toMatchObject({ cursor: 0 });
  await nextFrames(page);
  await page.keyboard.press('x');
  await expect.poll(() => hook(page, 'choiceResult')).toBeNull();
  await standing(page, { x: 15, y: 10 });
});

test('wandering NPCs stay in their rectangle and never share a tile with the player or each other', async ({
  page,
}, testInfo) => {
  test.setTimeout(WATCH_MS + 60_000);
  const rect = { x: 7, y: 12, width: 8, height: 5 };
  const fast = { ...rect, stepEveryMs: [100, 400] };
  await patchData(
    page,
    [
      npc({ id: 'w1', map: 'test_east', spawn: { x: 8, y: 13 }, wander: fast, dialogue: ['¡Uf!'] }),
      npc({ id: 'w2', map: 'test_east', spawn: { x: 12, y: 15 }, wander: fast, dialogue: ['¡Ay!'] }),
    ],
    { map: 'test_east', x: 10, y: 12, facing: 'down' },
    true,
  );
  const errors = await enterOverworld(page, { map: 'test_east', x: 10, y: 12 });

  // The player wanders around (and into) the NPCs in the page itself, while samples are taken every frame.
  const result = await page.evaluate(
    async ({ ms, r }) => {
      const e2e = (window as unknown as { __E2E__: Hooks }).__E2E__;
      const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      const fire = (type: string, code: string) => window.dispatchEvent(new KeyboardEvent(type, { code }));
      const problems: string[] = [];
      const seen = new Set<string>();
      let samples = 0;
      let held = '';
      const end = performance.now() + ms;
      let next = 0;
      while (performance.now() < end) {
        if (performance.now() > next) {
          if (held) fire('keyup', held);
          // Random walk, pulled back towards the NPCs' rectangle so the player keeps bumping into them.
          const at = e2e.playerTile!() as Tile;
          held =
            at.x < r.x
              ? 'ArrowRight'
              : at.x >= r.x + r.width
                ? 'ArrowLeft'
                : at.y < r.y - 1
                  ? 'ArrowDown'
                  : at.y >= r.y + r.height
                    ? 'ArrowUp'
                    : keys[Math.floor(Math.random() * 4)]!;
          fire('keydown', held);
          next = performance.now() + 150 + Math.random() * 600;
        }
        await new Promise((res) => requestAnimationFrame(res));
        const p = e2e.playerTile!() as Tile;
        const list = e2e.npcs!() as NpcInfo[];
        samples += 1;
        for (const n of list) {
          seen.add(`${n.id}@${n.x},${n.y}`);
          if (n.x < r.x || n.y < r.y || n.x >= r.x + r.width || n.y >= r.y + r.height)
            problems.push(`${n.id} left its rectangle at ${n.x},${n.y}`);
        }
        const tiles = [`${p.x},${p.y}`, ...list.map((n) => `${n.x},${n.y}`)];
        if (new Set(tiles).size !== tiles.length) problems.push(`shared tile: ${tiles.join(' ')}`);
      }
      if (held) fire('keyup', held);
      return { problems, samples, distinct: seen.size };
    },
    { ms: WATCH_MS, r: rect },
  );
  await page.screenshot({ path: testInfo.outputPath(`wander-${testInfo.project.name}.png`) });
  expect(result.problems).toEqual([]);
  expect(result.samples).toBeGreaterThan(50);
  expect(result.distinct).toBeGreaterThan(6); // they really moved around
  expect(errors).toEqual([]);
});
