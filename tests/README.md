# tests

- `tests/core/`, `tests/i18n/`, `tests/tools/`, `tests/data/` (fixture: the shipped `public/data/` via `tests/data/fixture.ts`;
  `tests/logic/helpers.ts` adds `gameData()`, `inst()` and `scriptedRng()` for rule tests), `tests/logic/`: Vitest unit
  tests mirroring `src/` (`npm test`; coverage with `npm run coverage`). Vitest only picks up `tests/**/*.test.ts`
  and ignores `tests/e2e/`.
- `tests/e2e/`: Playwright browser tests (`npx playwright test`). They build with `VITE_E2E=1` and serve `dist/`.

## Test hooks (`src/main.ts`)

Exposed when `import.meta.env.DEV` is true or the build has `VITE_E2E=1`:

| Hook | Since | What it is |
| --- | --- | --- |
| `window.__GAME__` | M0 | The `Phaser.Game` instance (`isBooted`, `scene`, `config`…). |
| `window.__E2E__.activeScenes()` | M0 | Keys of the active scenes, bottom to top. |
| `window.__E2E__.currentScene()` | M0 | Key of the topmost active scene (`'Preload'` in M0), or `null`. |
| `window.__E2E__.dataSummary()` | M1 | Counts per content collection, or `null` if data is not loaded. |
| `window.__E2E__.dataErrors()` | M1 | The `file › path › message` lines shown by the ErrorScene (`[]` if not shown). |
| `window.__E2E__.preloadComplete()` | M1 | True once Preload loaded every asset. |
| `window.__E2E__.failedAssets()` | M1 | Keys of assets that failed to load. |
| `window.__E2E__.hasTexture(key)` / `hasSound(key)` | M1 | Whether an asset (key = its JSON path) is loaded. |

Add new helpers to the `E2EHooks` interface in `src/main.ts` and to this table.
