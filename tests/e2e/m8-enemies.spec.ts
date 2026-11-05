// M8 "Done when": an enemy NPC 4 tiles away in a straight line triggers, 5 tiles away or behind a wall does
// not; after beating it, standing next to it gives only `defeatDialogue`, and walking 7 tiles away and back
// triggers it again; after a loss, previously beaten NPCs fight again. Plus: the "!" bubble, the walk up,
// the reward message and euros, the Losing rule (respawn, half the euros, "Te has despertado…"), talking to a
// ready enemy starts the battle, the debug overlay's euros line and its "NPC: todos listos" command.
// Enemies and stronger stats are injected by intercepting npcs.json / flexymon.json (no shipped data changes):
// Portátil hits hard enough to win in one blow (when it does not miss); the boss's Ratón always wins.
import { test, expect, type Page } from '@playwright/test';
import { neutralIntro } from './neutral-intro';

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
  state: string | null;
  alert: boolean;
}
interface BattleView {
  kind: string;
  result: string | null;
  ui: string;
  menu: { options: { label: string; enabled: boolean }[]; cursor: number } | null;
  message: string | null;
  opponent: { speciesId: string; name: string };
}
type Hooks = Record<string, (...a: unknown[]) => unknown>;

const hook = <T>(page: Page, name: string, ...args: unknown[]): Promise<T> =>
  page.evaluate(
    ([n, a]) => (window as unknown as { __E2E__: Hooks }).__E2E__[n as string]!(...(a as unknown[])),
    [name, args] as const,
  ) as Promise<T>;
const tile = (page: Page) => hook<Tile | null>(page, 'playerTile');
const battle = (page: Page) => hook<BattleView | null>(page, 'battle');
const npcs = (page: Page) => hook<NpcInfo[]>(page, 'npcs');
const npc = async (page: Page, id: string) => (await npcs(page)).find((n) => n.id === id)!;
const dialogue = (page: Page) => hook<{ full: string } | null>(page, 'dialogue');
const npcStates = (page: Page) => hook<Record<string, string>>(page, 'npcStates');
const euros = (page: Page) => hook<number>(page, 'euros');

const enemy = (over: Record<string, unknown>) => ({
  type: 'enemy',
  name: 'Becaria',
  sprite: 'assets/sprites/npcs/becario.png',
  voice: 'assets/audio/sfx/voice_high.ogg',
  map: 'test',
  wander: null,
  sight: 4,
  reward: { min: 80, max: 140 },
  ...over,
});

/** Stands at (15, 4) looking down column 15 (the path): sees (15, 5)…(15, 8). */
const VIGIA = enemy({
  id: 'vigia',
  spawn: { x: 15, y: 4 },
  facing: 'down',
  dialogue: ['¡Te he visto!'],
  defeatDialogue: ['Me rindo.'],
  team: ['teclado'],
});
/** At (9, 10) looking right; the wall at x = 11 hides (12, 10) and (13, 10). */
const MURO = enemy({
  id: 'muro',
  spawn: { x: 9, y: 10 },
  facing: 'right',
  dialogue: ['¿Hay alguien?'],
  defeatDialogue: ['Vale.'],
  team: ['teclado'],
});
/** At (20, 10) looking left: sees (16, 10)…(19, 10). Its Ratón is unbeatable here. */
const JEFE = enemy({
  id: 'jefe',
  spawn: { x: 20, y: 10 },
  facing: 'left',
  dialogue: ['A mi despacho.'],
  defeatDialogue: ['Bien.'],
  team: ['raton'],
});

/** Serve the injected enemies (shipped NPCs kept) and the boosted stats; optionally move the spawn. */
async function patchData(page: Page, extra: object[], spawn?: object): Promise<void> {
  await page.route('**/data/npcs.json', async (route) => {
    const res = await route.fetch();
    const list = (await res.json()) as object[];
    await route.fulfill({ response: res, body: JSON.stringify([...list, ...extra]) });
  });
  await page.route('**/data/flexymon.json', async (route) => {
    const res = await route.fetch();
    const list = (await res.json()) as { id: string; stats: Record<string, number> }[];
    const boost: Record<string, Record<string, number>> = {
      portatil: { attack: 999, speed: 500 },
      raton: { hp: 999, attack: 999, speed: 999 },
    };
    for (const sp of list) sp.stats = { ...sp.stats, ...boost[sp.id] };
    await route.fulfill({ response: res, body: JSON.stringify(list) });
  });
  if (spawn) {
    await page.route('**/data/start.json', async (route) => {
      const res = await route.fetch();
      const start = (await res.json()) as Record<string, unknown>;
      await route.fulfill({ response: res, body: JSON.stringify({ ...start, spawn }) });
    });
    // M11: the intro must fit the spawn's map at boot (see neutral-intro.ts).
    await neutralIntro(page, (spawn as { map: string }).map);
  }
}

async function enterOverworld(page: Page, expected: Partial<Tile>, url = '/'): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto(url);
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

const FACING: Record<string, string> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};
const DELTA: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

/**
 * One step with `key` (turning first if needed). `'walk'` once the player stands on the next tile with
 * input unlocked; `'spotted'` if, standing there, an enemy shows its "!" (input stays locked).
 */
async function step(page: Page, key: string): Promise<'walk' | 'spotted'> {
  const before = (await tile(page))!;
  if (before.facing !== FACING[key]) {
    await press(page, key);
    await standing(page, { facing: FACING[key] });
  }
  const [dx, dy] = DELTA[key]!;
  const target = { x: before.x + dx, y: before.y + dy };
  await press(page, key);
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const t = await tile(page);
    if (t && t.x === target.x && t.y === target.y && !t.moving) {
      if ((await npcs(page)).some((n) => n.alert)) return 'spotted';
      if (!(await hook<boolean>(page, 'overworldLocked'))) return 'walk';
    }
    await page.waitForTimeout(20);
  }
  throw new Error(`step ${key}: never reached ${JSON.stringify(target)}`);
}

/** Press A through the dialogue box until it closes; returns the texts seen. */
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

/**
 * Play an NPC battle that just started (or is about to) to its end: A through messages, Atacar → first
 * attack in every menu. Returns the battle messages and the last view; resolves once the battle scene is gone.
 */
async function fight(page: Page): Promise<{ messages: string[]; last: BattleView }> {
  await expect.poll(() => battle(page), { timeout: 10_000 }).not.toBeNull();
  const messages: string[] = [];
  let last: BattleView | null = null;
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const v = await battle(page);
    if (!v) return { messages, last: last! };
    last = v;
    if (v.message) {
      if (messages.at(-1) !== v.message) messages.push(v.message);
      await press(page, 'z');
    } else if (v.ui === 'main' && v.menu?.cursor === 0) {
      await press(page, 'z');
      await expect.poll(async () => (await battle(page))?.ui).toBe('attack');
      await press(page, 'z');
    } else await page.waitForTimeout(40);
  }
  throw new Error(`fight: never ended (${JSON.stringify(last)})`);
}

test('4 tiles in front triggers, 5 does not; win pays, then only defeatDialogue; 7 away and back triggers again', async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await patchData(page, [VIGIA], { map: 'test', x: 15, y: 10, facing: 'up' });
  const errors = await enterOverworld(page, { map: 'test', x: 15, y: 10 }, '/?debug=1');
  expect(await npc(page, 'vigia')).toMatchObject({ x: 15, y: 4, state: 'ready', alert: false });

  // 5 tiles away: nothing. 4 tiles away: the "!" bubble, the NPC walks to the adjacent tile.
  expect(await step(page, 'ArrowUp')).toBe('walk'); // (15, 9): distance 5
  expect(await step(page, 'ArrowUp')).toBe('spotted'); // (15, 8): distance 4
  expect(await hook<boolean>(page, 'overworldLocked')).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`alert-${testInfo.project.name}.png`) });
  await expect.poll(async () => (await npc(page, 'vigia')).alert).toBe(false);
  await expect.poll(() => dialogue(page)).toMatchObject({ full: '¡Te he visto!' });
  expect(await npc(page, 'vigia')).toMatchObject({ x: 15, y: 7, facing: 'down', moving: false });
  expect(await tile(page)).toMatchObject({ x: 15, y: 8, facing: 'up' });
  await page.screenshot({ path: testInfo.outputPath(`challenge-${testInfo.project.name}.png`) });
  expect(await readDialogue(page)).toEqual(['¡Te he visto!']);

  // The battle: NPC kind (Huir greyed out), its team; a win pays 80–140 €.
  await expect.poll(() => battle(page), { timeout: 10_000 }).not.toBeNull();
  expect((await battle(page))!.kind).toBe('npc');
  const { messages, last } = await fight(page);
  expect(last.result).toBe('win');
  expect(messages[0]).toBe('¡El rival saca a Teclado!');
  const reward = /^¡Has ganado (\d+) €!$/.exec(messages.at(-1)!);
  expect(reward, messages.join(' | ')).not.toBeNull();
  const n = Number(reward![1]);
  expect(n).toBeGreaterThanOrEqual(80);
  expect(n).toBeLessThanOrEqual(140);
  expect(await euros(page)).toBe(200 + n);

  // Back in the overworld the NPC says its defeatDialogue; it is now in cooldown.
  await expect.poll(() => dialogue(page), { timeout: 10_000 }).toMatchObject({ full: 'Me rindo.' });
  await page.screenshot({ path: testInfo.outputPath(`defeat-${testInfo.project.name}.png`) });
  expect(await readDialogue(page)).toEqual(['Me rindo.']);
  await standing(page, { x: 15, y: 8 });
  expect(await npcStates(page)).toEqual({ vigia: 'cooldown' });
  expect((await hook<string[]>(page, 'debugLines')) ?? []).toEqual([]); // overlay hidden

  // Standing next to it and pressing A: only the defeatDialogue, no battle.
  await press(page, 'z');
  expect(await readDialogue(page)).toEqual(['Me rindo.']);
  await standing(page, { x: 15, y: 8 });
  expect(await battle(page)).toBeNull();

  // Walk 7 tiles away (Manhattan from (15, 7)): ready again. Coming back into sight triggers it.
  for (let i = 0; i < 6; i++) expect(await step(page, 'ArrowDown')).toBe('walk'); // → (15, 14)
  await expect.poll(() => npcStates(page)).toEqual({ vigia: 'ready' });
  expect(await step(page, 'ArrowUp')).toBe('walk'); // (15, 13): distance 6
  expect(await step(page, 'ArrowUp')).toBe('walk'); // (15, 12): distance 5
  expect(await step(page, 'ArrowUp')).toBe('spotted'); // (15, 11): distance 4
  expect(await readDialogue(page)).toEqual(['¡Te he visto!']);
  expect(await npc(page, 'vigia')).toMatchObject({ x: 15, y: 10 });
  expect((await fight(page)).last.result).toBe('win');
  expect(await readDialogue(page)).toEqual(['Me rindo.']);
  await standing(page, { x: 15, y: 11 });
  expect(await euros(page)).toBeGreaterThanOrEqual(200 + n + 80);

  // Debug overlay: the euros line, and "NPC: todos listos" makes the beaten NPC ready again.
  await press(page, 'F2');
  await expect
    .poll(async () => (await hook<string[]>(page, 'debugLines'))?.[3])
    .toBe(`Euros: ${await euros(page)}`);
  await press(page, 'F2');
  await expect.poll(() => hook<string>(page, 'debugMode')).toBe('menu');
  await press(page, 'ArrowUp'); // wraps to the last entry
  await expect
    .poll(async () => (await hook<string[]>(page, 'debugLines'))!.at(-1))
    .toBe('> NPC: todos listos');
  expect(await npcStates(page)).toEqual({ vigia: 'cooldown' });
  await press(page, 'z');
  await expect.poll(() => npcStates(page)).toEqual({ vigia: 'ready' });
  await press(page, 'F2');
  await expect.poll(() => hook<string>(page, 'debugMode')).toBe('hidden');
  expect(errors).toEqual([]);
});

test('a wall between the NPC and the player hides the player', async ({ page }) => {
  test.setTimeout(60_000);
  await patchData(page, [MURO], { map: 'test', x: 14, y: 10, facing: 'left' });
  const errors = await enterOverworld(page, { map: 'test', x: 14, y: 10 });
  expect(await step(page, 'ArrowLeft')).toBe('walk'); // (13, 10): distance 4, wall at (11, 10) between
  expect(await step(page, 'ArrowLeft')).toBe('walk'); // (12, 10): distance 3, still behind the wall
  await page.waitForTimeout(800);
  expect(await npc(page, 'muro')).toMatchObject({ x: 9, y: 10, alert: false, talking: false });
  expect(await battle(page)).toBeNull();
  expect(errors).toEqual([]);
});

test('after a loss: woken at the office with half the euros, and beaten NPCs fight again', async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await patchData(page, [VIGIA, JEFE], { map: 'test', x: 15, y: 9, facing: 'up' });
  const errors = await enterOverworld(page, { map: 'test', x: 15, y: 9 });

  // Beat the vigía (cooldown).
  expect(await step(page, 'ArrowUp')).toBe('spotted'); // (15, 8)
  expect(await readDialogue(page)).toEqual(['¡Te he visto!']);
  expect((await fight(page)).last.result).toBe('win');
  expect(await readDialogue(page)).toEqual(['Me rindo.']);
  await standing(page, { x: 15, y: 8 });
  expect(await npcStates(page)).toEqual({ vigia: 'cooldown' });
  const before = await euros(page);

  // Walk into the boss's sight and lose.
  expect(await step(page, 'ArrowDown')).toBe('walk'); // (15, 9)
  expect(await step(page, 'ArrowDown')).toBe('walk'); // (15, 10)
  expect(await step(page, 'ArrowRight')).toBe('spotted'); // (16, 10): distance 4
  expect(await readDialogue(page)).toEqual(['A mi despacho.']);
  const lost = await fight(page);
  expect(lost.last.result).toBe('lose');
  expect(lost.messages).toContain('No te quedan flexymon en pie...');
  expect(lost.messages.some((m) => m.includes('€'))).toBe(false);

  // The Losing rule: respawn point, message, half the euros, team healed, every NPC ready.
  await expect
    .poll(() => dialogue(page), { timeout: 10_000 })
    .toMatchObject({
      full: 'Te has despertado en la oficina...',
    });
  expect(await tile(page)).toMatchObject({ map: 'test', x: 15, y: 11, facing: 'down' });
  await page.screenshot({ path: testInfo.outputPath(`woke-up-${testInfo.project.name}.png`) });
  expect(await readDialogue(page)).toEqual(['Te has despertado en la oficina...']);
  await standing(page, { x: 15, y: 11 });
  expect(await euros(page)).toBe(Math.floor(before / 2));
  expect((await hook<{ currentHp: number }[]>(page, 'team'))[0]!.currentHp).toBe(40);
  expect(await npcStates(page)).toEqual({ vigia: 'ready' }); // the boss never had a state (missing = ready)
  expect(await npc(page, 'jefe')).toMatchObject({ state: 'ready' });
  expect(await npc(page, 'vigia')).toMatchObject({ x: 15, y: 4, state: 'ready' });

  // The beaten vigía fights again: walk up beside it and talk to it (A starts the same sequence).
  expect(await step(page, 'ArrowLeft')).toBe('walk'); // (14, 11)
  for (let y = 10; y >= 4; y--) expect(await step(page, 'ArrowUp')).toBe('walk'); // → (14, 4)
  await press(page, 'ArrowRight');
  await standing(page, { x: 14, y: 4, facing: 'right' });
  await press(page, 'z');
  await expect.poll(async () => (await npc(page, 'vigia')).alert).toBe(true);
  expect(await npc(page, 'vigia')).toMatchObject({ facing: 'left' });
  expect(await readDialogue(page)).toEqual(['¡Te he visto!']);
  expect((await fight(page)).last.result).toBe('win');
  expect(await readDialogue(page)).toEqual(['Me rindo.']);
  expect((await npcStates(page)).vigia).toBe('cooldown');
  expect(errors).toEqual([]);
});
