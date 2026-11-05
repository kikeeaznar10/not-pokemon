// Shared e2e helper. The intro in `intro.json` plays on the `start.json › spawn` map, and the boot checks
// reject an intro whose coworker or walks do not fit that map. Tests that move the spawn for convenience (and
// then enter with `quickStart()`, skipping the intro) serve this neutral intro with it: the coworker stands on a
// known free tile of the spawn's map and the script is only the handover.
import type { Page } from '@playwright/test';

/** A walkable tile per test map that no test uses as its spawn. */
const COWORKER_SPOT: Record<string, { x: number; y: number }> = {
  test: { x: 15, y: 3 },
  test_house: { x: 4, y: 7 },
  test_east: { x: 2, y: 10 },
};

/** Serve `intro.json` with no walks and the coworker on a free tile of `map`. */
export async function neutralIntro(page: Page, map: string): Promise<void> {
  const spot = COWORKER_SPOT[map];
  if (!spot) throw new Error(`neutralIntro: no coworker spot for map "${map}"`);
  await page.route('**/data/intro.json', async (route) => {
    const res = await route.fetch();
    const intro = (await res.json()) as { coworker: object };
    const body = { ...intro, coworker: { ...intro.coworker, ...spot }, steps: [{ type: 'handover' }] };
    await route.fulfill({ response: res, body: JSON.stringify(body) });
  });
}
