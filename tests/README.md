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
| `window.__E2E__.currentScene()` | M0 | Key of the topmost active scene, ignoring the Debug overlay (`'Preload'` on the title, `'Overworld'` after Start), or `null`. |
| `window.__E2E__.dataSummary()` | M1 | Counts per content collection, or `null` if data is not loaded. |
| `window.__E2E__.dataErrors()` | M1 | The `file › path › message` lines shown by the ErrorScene (`[]` if not shown). |
| `window.__E2E__.preloadComplete()` | M1 | True once Preload loaded every asset. |
| `window.__E2E__.failedAssets()` | M1 | Keys of assets that failed to load. |
| `window.__E2E__.hasTexture(key)` / `hasSound(key)` | M1 | Whether an asset (key = its JSON path) is loaded. |
| `window.__E2E__.playerTile()` | M3 | `{ map, x, y, facing, moving }` in the overworld (tiles as in Tiled), else `null`. |
| `window.__E2E__.debugLines()` | M3 | The Debug overlay's lines while shown (F2; needs a dev build or `?debug=1`), else `null`. |
| `window.__E2E__.debugMode()` | M4 | `'hidden'`, `'info'` or `'menu'` (teleport list); `null` when debugging is disabled. |
| `window.__E2E__.currentMusic()` | M4 | Sound key of the zone music playing or fading in (e.g. `assets/audio/music/test.ogg`), or `null`. |
| `window.__E2E__.overworldLocked()` | M4 | True while the overworld ignores movement (warp fade, debug menu; from M5 also an open dialogue or choice box). |
| `window.__E2E__.npcs()` | M5 | NPCs on the current map: `{ id, x, y, facing, moving, talking }` (tile = the step's start while moving); `[]` outside the overworld. |
| `window.__E2E__.dialogue()` | M5 | The open dialogue box: `{ page, pages, text (visible), full, typed, more, voicePlays }`, or `null`. |
| `window.__E2E__.openChoice(options)` | M5 | Opens a ChoiceBox in the overworld (test helper; real uses come in M7/M9). |
| `window.__E2E__.choice()` / `choiceResult()` | M5 | Open choice box `{ options, cursor }` or `null`; the last result (index, `null` = cancelled with B, `undefined` = none yet). |
| `window.__E2E__.startBattle(seed, species?, kind?)` | M6 | Starts a battle from the overworld against a fresh flexymon (`raton`, `wild` by default; `kind` `npc` greys out Huir); the RNG is seeded with `seed` when the battle starts. `false` if refused (locked, mid-step, box open). |
| `window.__E2E__.battle()` | M6 | The battle screen: `{ kind, phase, result, round, ui ('anim'/'main'/'attack'/'team'/'end'), menu { options[{label, enabled}], cursor }, message, player, opponent }`; each side `{ uid, speciesId, name, hp, maxHp (logic), shownHp (bar), hpText }`. `null` outside a battle. |
| `window.__E2E__.team()` / `setTeam(members)` | M6 | The team in the game state; replace it with fresh flexymon `[{ speciesId, currentHp? }]`. |

To reach the overworld in a test: wait for `preloadComplete()`, then `page.keyboard.press('Enter')`.
Keys pressed with Playwright are seen on the next game frame: poll for the expected state
(`expect.poll(...)`) instead of reading it right after the key press, and wait for one press to take effect
before the next (two presses in one frame count once). After a warp, also wait for `overworldLocked()` to be false
(see the `standing()` helper in `tests/e2e/m4-warps.spec.ts`).

`tests/e2e/m5-dialogue.spec.ts` adds NPCs by intercepting `data/npcs.json` with `page.route` (so "a new talker needs
no code change" is tested without touching the shipped data). Its wander watch lasts `M5_WATCH_MS` ms (default
20000); run it once with `M5_WATCH_MS=120000 npx playwright test tests/e2e/m5-dialogue.spec.ts --project=desktop -g wandering`
for the plan's 2-minute check.

`tests/e2e/m6-battle.spec.ts` drives battles with `advance()` (presses A through messages until a menu or the overworld is
back). Loss and forced-switch tests try seeds 1–10 until the case happens, since the opponent's attack is random.

Add new helpers to the `E2EHooks` interface in `src/main.ts` and to this table.
