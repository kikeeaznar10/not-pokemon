/// <reference types="vite/client" />

/** Environment variables read by the game (Vite exposes only `VITE_*`). */
interface ImportMetaEnv {
  /** `'1'` in builds made for Playwright: enables logs and the `window.__GAME__` / `__E2E__` hooks. */
  readonly VITE_E2E?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
