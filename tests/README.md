# tests

- `tests/core/`, `tests/i18n/`, `tests/tools/` (and from M1/M2 `tests/data/`, `tests/logic/`): Vitest unit
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

Add new helpers to the `E2EHooks` interface in `src/main.ts` and to this table.
