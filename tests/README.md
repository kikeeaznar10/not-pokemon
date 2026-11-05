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
| `window.__E2E__.currentScene()` | M0 | Key of the topmost active scene, ignoring the Debug overlay and the HUD (`'Title'` on the title since M11, `'Name'`, `'Intro'`, `'Overworld'`…), or `null`. |
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
| `window.__E2E__.npcs()` | M5 | NPCs on the current map: `{ id, x, y, facing, moving, talking, state, alert }` (tile = the step's start while moving; M8: `state` `ready`/`cooldown` for enemies, `null` otherwise; `alert` = the "!" bubble shows); `[]` outside the overworld. |
| `window.__E2E__.dialogue()` | M5 | The open dialogue box: `{ page, pages, text (visible), full, typed, more, voicePlays }`, or `null`. |
| `window.__E2E__.openChoice(options)` | M5 | Opens a ChoiceBox in the overworld (test helper; real uses come in M7/M9). |
| `window.__E2E__.choice()` / `choiceResult()` | M5 | Open choice box `{ options, cursor }` or `null`; the last result (index, `null` = cancelled with B, `undefined` = none yet). |
| `window.__E2E__.startBattle(seed, species?, kind?)` | M6 | Starts a battle from the overworld against a fresh flexymon (`raton`, `wild` by default; `kind` `npc` greys out Huir); the RNG is seeded with `seed` when the battle starts. `false` if refused (locked, mid-step, box open). |
| `window.__E2E__.battle()` | M6 | The battle screen: `{ kind, phase, result, round, ui ('anim'/'main'/'attack'/'team'/'catch'/'end'; `catch` = the Llevármelo/Dejarlo choice after a wild win, M7, shown in `menu`), menu { options[{label, enabled}], cursor }, message, player, opponent }`; each side `{ uid, speciesId, name, hp, maxHp (logic), shownHp (bar), hpText }`. `null` outside a battle. |
| `window.__E2E__.team()` / `setTeam(members)` | M6 | The team in the game state; replace it with fresh flexymon `[{ speciesId, currentHp? }]`. |
| `window.__E2E__.party()` | M7 | `{ team, storage, teamSlots }` from the game state (copies). |
| `window.__E2E__.safeSteps()` | M7 | Steps left without encounter rolls (3 after every map entry and battle); `null` outside the overworld. |
| `window.__E2E__.encountersEnabled()` / `setEncounters(on)` | M7 | Read / set the debug flag that switches wild encounters off (same as the F2 menu's "Encuentros" option). |
| `window.__E2E__.euros()` / `setEuros(n)` | M8 | Read / set the player's euros in the game state. |
| `window.__E2E__.items()` / `setItems(items)` | M9 | Read / replace the bag `{ itemId: count }` in the game state. |
| `window.__E2E__.setParty({ team?, storage?, teamSlots? })` | M9 | Replace team and/or storage with fresh flexymon `[{ speciesId, currentHp? }]` and/or set the slots. |
| `window.__E2E__.useFieldItem(itemId, targetUid?)` | M9 | Runs `useFieldItem` on the game state: the `use` (`heal` / `revive` / `team_slot`) or `{ error }`. |
| `window.__E2E__.shop()` | M9 | The open shop: `{ shopId, ui ('main'/'list'/'quantity'/'confirm'/'message'/'closed'), mode, euros, menu, itemId, quantity, total, prompt, message }`, else `null`. |
| `window.__E2E__.storage()` | M9 | The open storage box: `{ column, cursor, team[], storage[] (species ids), teamSlots, message }`, else `null`. |
| `window.__E2E__.saveRequests()` | M9 | Reasons of every `save:request` since load (`healer`, `shop`; M10: `map`, `battle`, `menu`). |
| `window.__E2E__.savesWritten()` | M10 | Reasons of every save written since load (`quiet` = page hidden / closed). |
| `window.__E2E__.savedGame()` | M10 | The raw `flexymon.save.v1` text, or `null`. |
| `window.__E2E__.saveIcon()` | M10 | True while the "Guardando…" icon shows (600 ms after each save). |
| `window.__E2E__.menu()` | M10 | The open Start menu: `{ ui ('main'/'team'/'detail'/'move'/'bag'/'bag_target'/'options'/'message'/'closed'), menu { options, cursor }, detail (stats `{ stat, value, base, bonus }`, attacks) on the detail page, options { music, sfx, textSpeed, cursor }, description (Mochila), message, messageTyped }`, else `null`. |
| `window.__E2E__.options()` / `setOptions(o)` | M10 | Read / replace the options `{ music, sfx (0–10), textSpeed ('slow'/'normal'/'fast') }` (stored in `flexymon.options` and applied). |
| `window.__E2E__.musicGain()` | M10 | The music option's gain applied to the music player (0–1). |
| `window.__E2E__.patchState(patch)` | M10 | Merge fields into the game state (e.g. `team` with bonuses, `npcs`); the position follows the player. |
| `window.__E2E__.npcStates()` | M8 | Enemy NPC states from the game state: `{ id: 'ready' \| 'cooldown' }` (an NPC never beaten is missing = `ready`). |
| `window.__E2E__.title()` | M11 | The title screen: `{ ui ('press'/'menu'/'confirm'/'leaving'), options (menu labels), cursor, confirm (Sí/No box or null), hasSave, brokenSave, logo, hint }`, else `null`. |
| `window.__E2E__.quickStart()` | M11 | On the title: continue a valid save, else a new game with the default name at `start.json › spawn`, skipping menu, name and intro (what Start did before M11). `false` if the title is not showing. |
| `window.__E2E__.nameEntry()` | M11 | The name screen: `{ name, cursor, cell (label under the cursor), cells (labels), message, rects (cell rectangles in base pixels) }`, else `null`. |
| `window.__E2E__.intro()` | M11 | The intro: `{ step, type, name, player, coworker ({ x, y, facing }), dialogue, handedOver, secretMessage, jinglePlays }`, else `null`. |
| `window.__E2E__.playerName()` | M11 | The player's name in the game state. |
| `window.__E2E__.touchControls()` | M12 | The touch overlay: `{ shown, controls [{ id ('dpad'/'a'/'b'/'start'/'map'), x, y, width, height }] (CSS pixels), pressed (ids held; the D-pad as 'dpad:<dir>') }`; `{ shown: false, controls: [], pressed: [] }` on non-touch devices. |
| `window.__E2E__.inputDown()` | M12 | Actions the Input service holds down now (keys and touch alike). |
| `window.__E2E__.rotateScreen()` | M12 | `{ shown ("Gira el móvil" on screen), paused (game loop), touch (touch device) }`. |
| `window.__E2E__.fullscreenRequested()` | M12 | True once the first tap asked for fullscreen. |
| `window.__E2E__.minimap()` | M12 | The minimap in the overworld: `{ zone, shown (player's choice), visible (drawn), available (outdoors with an image), frame { x, y, width, height, scale } (base pixels), mapSize, tile, dot { x, y } (base pixels), dotOn (blink) }`, else `null`. |

To reach the overworld in a test: wait for `preloadComplete()`, then call `quickStart()` until it returns true
(`page.waitForFunction(() => window.__E2E__.quickStart())`; M11 — the title needs a frame to start). To test the
real flow, press Enter on the title and choose from its menu (`tests/e2e/m11-title-intro.spec.ts`). In the name
screen letter keys (Z and X too) type text, so press Enter for OK.

`tests/e2e/neutral-intro.ts` (M11): the boot checks reject an `intro.json` whose coworker or walks do not fit the
`start.json › spawn` map. A test that moves the spawn (intercepting `start.json`) also calls `neutralIntro(page, map)`,
which serves an intro with no walks and the coworker on a free tile of that map (the helpers `startAt` / `patchData`
in the M5, M7–M10 specs do this).
Keys pressed with Playwright are seen on the next game frame: poll for the expected state
(`expect.poll(...)`) instead of reading it right after the key press, and wait for one press to take effect
before the next (two presses in one frame count once). After a warp, also wait for `overworldLocked()` to be false
(see the `standing()` helper in `tests/e2e/m4-warps.spec.ts`).

`tests/e2e/m5-dialogue.spec.ts` adds NPCs by intercepting `data/npcs.json` with `page.route` (so "a new talker needs
no code change" is tested without touching the shipped data). Its wander watch lasts `M5_WATCH_MS` ms (default
20000); run it once with `M5_WATCH_MS=120000 npx playwright test tests/e2e/m5-dialogue.spec.ts --project=desktop -g wandering`
for the plan's 2-minute check.

**Portrait phones (M12).** On a touch device in portrait the game shows "Gira el móvil" and pauses. The `android`
and `iphone` profiles are portrait, so `playwright.config.ts` starts them with `localStorage['flexymon.e2e.allowPortrait']
= '1'`, an E2E-only switch (`src/main.ts`, ignored in production builds) that turns the guard off so the older specs
still drive the game there. `tests/e2e/m12-mobile.spec.ts` removes it (`addInitScript`) to test the guard, and turns
the phones to landscape (`setViewportSize`) for its touch tests. Touch taps use `page.touchscreen.tap` (real touch
events, Chromium and WebKit); holds, slides and multi-touch dispatch `PointerEvent`s of type `touch` on the controls,
since Playwright's touchscreen can only tap.

`tests/e2e/m6-battle.spec.ts` drives battles with `advance()` (presses A through messages until a menu or the overworld is
back). Loss and forced-switch tests try seeds 1–10 until the case happens, since the opponent's attack is random.

Since M9 the overworld hooks (`playerTile`, `overworldLocked`, `npcs`, `dialogue`…) also answer while the overworld
is paused under the Shop or Storage scene; `battle().ui` can be `item` / `item_target`.
`tests/e2e/m9-items.spec.ts` serves `start.json` with a spawn inside `test_house` next to the NPC under test.

Since M10 every page load that reaches the overworld writes `flexymon.save.v1`, and the next quick start (or Continuar, M11) on the title
continues that game: tests start with an empty `localStorage` (a new browser context per test), so only tests that
reload see a save. `currentScene()` ignores the always-on `Hud` scene. `tests/e2e/m10-menu-save.spec.ts` reloads with
`page.reload()` (the quiet save on `pagehide` keeps the exact tile) and writes garbage with `localStorage.setItem`.

Add new helpers to the `E2EHooks` interface in `src/main.ts` and to this table.

`tests/e2e/m8-enemies.spec.ts` injects enemy NPCs (`npcs.json`) and boosted stats (`flexymon.json`) with `page.route`,
so NPC battles end the same way every time without seeds: Portátil wins in one blow unless it misses, and the boss's
Ratón always wins. Since M8, `m5-dialogue.spec.ts`'s wander watch serves the shipped enemies as talkers (an enemy leaves
its rectangle to challenge the player).
