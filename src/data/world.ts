/**
 * Which content set the game loads.
 *
 * The real game always reads `public/data/`. Dev and E2E builds (`import.meta.env.DEV` or `VITE_E2E=1`) can
 * load the frozen **test world** instead — the small early content set and test maps (`public/test-world/data/`, maps in
 * `public/maps/test/`) — with the URL parameter `?world=test` or `localStorage['flexymon.e2e.world'] = 'test'`.
 * The older browser tests run on it (`playwright.config.ts` sets the localStorage key), so their
 * tile coordinates keep working while the real world changes. Production builds ignore both switches.
 */

/** Data directory (relative to the `public/` root) of the real world. */
export const WORLD_DATA_DIR = 'data/';
/** Data directory (relative to the `public/` root) of the frozen test world. */
export const TEST_WORLD_DATA_DIR = 'test-world/data/';
/** localStorage key that selects the test world in dev / E2E builds (value `test`). */
export const WORLD_STORAGE_KEY = 'flexymon.e2e.world';

/**
 * Pure choice of the data directory: the test world only when switches are `allowed` (dev / E2E build) and
 * either the URL query has `world=test` or the stored value is `test`.
 */
export function chooseDataDir(allowed: boolean, search: string, stored: string | null): string {
  if (!allowed) return WORLD_DATA_DIR;
  const fromUrl = new URLSearchParams(search).get('world');
  return (fromUrl ?? stored) === 'test' ? TEST_WORLD_DATA_DIR : WORLD_DATA_DIR;
}

/** The data directory for this page (reads the build flags, the URL and localStorage). */
export function dataDir(): string {
  const allowed = import.meta.env.DEV || import.meta.env.VITE_E2E === '1';
  let stored: string | null;
  try {
    stored = window.localStorage.getItem(WORLD_STORAGE_KEY);
  } catch {
    stored = null; // storage blocked (private mode…): the real world
  }
  return chooseDataDir(allowed, window.location.search, stored);
}
