# Flexymon — Progress

Work through the milestones in order, one per session (see `CLAUDE.md` and `docs/PLAN.md`).
When a milestone is merged, tick it here and add a 3–5 line summary under "Milestone notes".

## Milestones

- [x] M0 — Project skeleton and placeholders
- [x] M1 — Config loading and validation
- [x] M2 — Battle and rules logic (no graphics)
- [x] M3 — Overworld: one map, movement, input
- [x] M4 — Maps, warps and interiors
- [x] M5 — Dialogue and talking NPCs
- [x] M6 — Battle scene
- [x] M7 — Wild encounters, catching and merging
- [ ] M8 — Enemy NPCs
- [ ] M9 — Items, team, storage, shops and healing
- [ ] M10 — Start menu and saving
- [ ] M11 — Title screen, intro and secret names
- [ ] M12 — Mobile controls and minimap
- [ ] M13 — The Audi to Murcia
- [ ] M14 — Build the world
- [ ] M15 — Audio, polish and deployment

## Milestone notes

### Repo preparation (before M0)

- Added `docs/PLAN.md` (the milestone plan, verbatim), this file, a PR template, and `.gitignore`.
- Rewrote `CLAUDE.md` so it matches the plan. The earlier `CLAUDE.md` (generic template) disagreed
  with the plan on several points; the plan won everywhere (see "Resolved at preparation" below).
- Kept the existing Playwright setup: `playwright.config.ts` and `tests/e2e/smoke.spec.ts`. The
  smoke test expects `window.__GAME__` (with `isBooted`) when built with `VITE_E2E=1`, so **M0 must
  expose it** and install `@playwright/test` as a dev dependency.
- **For M0:** task 8 (CLAUDE.md, docs/PLAN.md, docs/PROGRESS.md) is already done; only update
  them if M0 changes something (e.g. the exact Phaser version or script names). No code, no
  `package.json` and no folder skeleton exist yet; M0 creates all of them.

### M0

- Built: Vite + TS strict + Phaser 4.2.1 skeleton (`Boot` → `Preload`, which shows "Flexymon" from `t('app.title')`
  centred on a black 512×288 canvas, `FIT` + `CENTER_BOTH`, `pixelArt`/`roundPixels`); `src/core/log.ts`
  (output only in dev or `VITE_E2E=1` builds), `rng.ts` (mulberry32: `seed/next/int/float/chance/pick/weighted/id`),
  `events.ts` (typed `EventBus` + shared `events`, first event `game:ready`); `src/i18n` (`t`, `createT`);
  every folder with a `README.md`; nine data files as empty `[]` / `{}`; `npm run placeholders` (see `tools/README.md`).
- Hooks: `window.__GAME__` and `window.__E2E__.{activeScenes,currentScene}` (table in `tests/README.md`).
  New e2e test `tests/e2e/m0-title.spec.ts`. Unit tests for rng, events, `t()` and the placeholder tool.
- Deviations: `eslint.config.js` (flat config) instead of `.eslintrc.cjs`; scenes live in `src/scenes/boot-scene.ts`
  and `preload-scene.ts` (not listed in the M0 files, but required by the folder layout); extra files
  `src/vite-env.d.ts`, `.prettierignore`, `tools/fallback/silent.{ogg,mp3}`, extra scripts `format` and `coverage`;
  extra dev deps `typescript-eslint`, `@eslint/js`, `eslint-config-prettier`, `globals` (ESLint flat config),
  `pngjs` + `@types/pngjs` (placeholder PNGs), `@vitest/coverage-v8` (needed by M2), `@playwright/test` 1.64.1.
  TypeScript is 6.0.3, not 7.x: `typescript-eslint` 8.72 only supports `<6.1`.
- Audio placeholders: `ffmpeg` (present in the cloud container) makes a real 0.2 s beep; without it the tool
  copies silent files and reports it. `.prettierignore` skips `*.md` so the plan text is never reformatted.
- Verified with Playwright (desktop, android, android-landscape, iphone/WebKit) + screenshots: title centred
  at (256,144), 16:9 canvas filling one axis and centred, rescales on window resize, `antialias` off (no blur);
  `npm run dev` boots with no console errors; `npm run placeholders` run twice with sample data created 7 files,
  then 0. Next (M1): fill `public/data/`, add zod schemas, Boot loads data, add `ErrorScene`.

### M1

- Built: zod schemas for all nine files (`src/data/schemas/`, strict objects), `src/data/loader.ts`
  (fetch → parse → schema → cross-refs → frozen `GameData` with lookup maps, `getGameData()`), `ErrorScene`
  (red, one `file › path › message` line per error, scroll with arrows/wheel/drag), Preload loading every
  sprite and sound by its JSON path (OGG, MP3 fallback), minimal valid content + placeholder assets (committed).
  Details: `src/data/README.md`, `public/data/README.md`. New hooks: `dataSummary`, `dataErrors`,
  `preloadComplete`, `failedAssets`, `hasTexture`, `hasSound` (`tests/README.md`).
- Deviations / decisions: only one zone exists, so every map reference (NPCs, start, car) points to
  `valencia` (the camarero is in `valencia`, not `bar_pacos`); encounter lists use `raton`/`teclado` instead of
  the plan's `monitor`/`movil`. Items: the 4 examples **plus `carnet` and `cafe_doble`** (key items, price null) so
  the plan's `car.json` example validates. Strict objects, unique ids, shops may only sell priced items, and
  secret names may not collide are extra checks (written up in `public/data/README.md`). "ñ" is not treated as an
  accent when matching names (`src/logic/names.ts`, used later by M11).
- Files outside the M1 list: `src/logic/constants.ts` (started with `TEAM_MAX`, `EUROS_MAX`, `ITEM_COUNT_MAX`,
  used by the schemas; M2 adds the rest), `src/logic/names.ts`, `src/core/events.ts` (`data:loaded`, `data:error`),
  `src/main.ts` (hooks), `src/i18n/es.json`, `vite.config.ts` (coverage includes `src/data`), `tests/e2e/m0-title.spec.ts`
  (waits for `preloadComplete()` since Preload now loads assets first). Boot now *launches* Preload and Preload
  stops Boot when done, so a scene is always active (the smoke test caught the gap).
- Verified with Playwright on all four profiles + screenshots (`tests/e2e/m1-data.spec.ts`): valid data reaches
  Preload-complete with every asset loaded and no console errors; `"compilarr"` shows the red screen with
  `flexymon.json › [0].attacks[0] › unknown attack "compilarr"`; 40 errors scroll with the arrows. Unit tests cover
  every schema rule and every cross-reference rule. Note for M3: ErrorScene reads the arrow keys through Phaser
  directly (no Input service yet); switch it to `src/core/input.ts`. Phaser 4 geometry masks did not clip text, so
  the ErrorScene uses an opaque header strip instead.

### M2

- Built: every rule as pure, tested TypeScript in `src/logic/` (`instance`, `modifiers`, `damage`, `ai`, `battle`,
  `team`, `merge`, `inventory`, `economy`, `encounter`, `npc-state`, `save`; table in `src/logic/README.md`) and the
  M2 constants. `chooseAction(state, action, { data, rng })` returns `{ state, events[] }`; the event list and the
  fixed RNG call order are documented in `battle.ts`. 142 unit tests, `src/logic/` coverage 99 % lines / 96 %
  branches; `tests/logic/battle.test.ts` plays Portátil vs Ratón with seed 2026 and checks the exact events.
- Deviations: `chooseAction` takes a third `ctx` argument (content + rng) so the state stays plain data; the
  battle state carries the bag (`items`) and subtracts used items. Extra module `inventory.ts`, extra helpers
  `actionError` / `availableSwitches` / `battleItems` / `introEvents`, and `SAVE_VERSION` in constants.
  Fleeing ends the round before the AI chooses (no RNG used).
- Decisions (safe assumptions, see Open questions › Raised in M2): items with no effect are refused; every completed
  step counts as a safe step; merge HP gain also applies to a fainted instance (literal rule); save migration rules.
- For M6: the scene calls `actionError()` to grey out options and plays `events` in order; `damage.hp` / `maxHp`
  drive the HP bar. For M10: `parseSave` returns `warnings[]` to log and a failure reason; the store copies broken
  saves. No e2e test added (no visible change); the existing Playwright suite was run.

### M3

- Built: `src/core/input.ts` (Input service; keyboard via DOM listeners, Phaser keyboard turned off so no scene
  reads keys; F2 = `debug`), pure grid movement `src/logic/movement.ts` (`WALK_MS` 200, `TURN_TAP_MS` 100 in
  constants), Tiled reading `src/data/tiled.ts` (solid / encounter cells, spawn points, tileset paths),
  `world/player.ts`, `OverworldScene`, `DebugScene` (dev or `?debug=1`, F2: map, tile, FPS). Test map
  `public/maps/test.tmj` (30 × 20, layout in `public/maps/README.md`) + zone `test` in `zones.json`;
  `start.json` spawn/respawn now on `test`. ErrorScene now scrolls through the Input service.
- Rules chosen (see Open questions › Raised in M3): pressing the faced direction walks at once; a NEW direction
  turns first and walks if held ≥ 100 ms; a tap shorter than one frame still counts. A cell is solid if any
  tile layer has a `solid` tile there (so the hidden `collision` layer and solid wall/water tiles both block).
- Files outside the M3 list: `tools/make-test-map.ts` + `npm run test-map` (generates the map, the placeholder
  tileset and player sheet, since Tiled cannot be used in a cloud session; never overwrites without `--force`),
  `src/data/tiled.ts`, `src/core/events.ts` (`zone:entered`, `player:moved`), `src/config/game.ts` (scenes,
  keyboard off), `src/main.ts` (input wiring, hooks `playerTile`, `debugLines`), `preload-scene.ts` (title now
  says "Pulsa START" and Start/A/tap enters the overworld), `es.json`, READMEs. Tests updated for the new data:
  zone count 2, 13 sounds, duplicate-zone index, title hint text.
- Verified with Playwright on all four profiles + screenshots (`tests/e2e/m3-overworld.spec.ts`): tap turns,
  each press moves exactly one tile and stops on the grid, the wall and the map edge block (also while holding),
  holding walks without pausing between tiles, WASD works, F2 shows `Mapa: test` / `Casilla: 15, 10` at the
  spawn object Tiled places at (15, 10). For M4: the `valencia` zone still has no `.tmj` (NPCs and car point to it);
  M4's walkable-spawn checks need it drawn or those references moved to the test maps.

### M4

- Built: warps (`src/logic/warp.ts`, read from the `warps` layer by `src/data/tiled.ts`): `step` warps fire when a
  step ends inside them, `action` warps on A while facing them (ready for the car); leaving out `toX`/`toY` keeps the
  column/row (edges); a step warp one tile outside the map makes that off-map tile walkable. Overworld warp
  sequence: lock, fade out 200 ms, restart on the target, fade in, unlock, safe steps reset. Three test maps
  (`test`, `test_house` 10 × 8 indoor centred on black, `test_east`), boot-time map loading + checks
  (`src/data/map-checks.ts`: NPC/start/car/map spawn points walkable, warp targets exist and are walkable),
  zone music with 500 ms crossfade (`src/world/music.ts`), debug teleport menu (F2 cycles hidden → info → menu).
- Content change: the `valencia` zone (no map yet) is gone from `zones.json`; its encounter groups moved to `test`,
  the camarero to `test_house`, the becario to `test_east`, the car endpoints to the test maps, and the unused
  `valencia.ogg/.mp3` placeholders were deleted. M14 brings the real zones back.
- Fixes/decisions: a direction pressed during the frame always counts as a new press (`updateMovement(…, freshPress)`),
  otherwise a quick second tap after a turn could be swallowed. Files outside the list: `src/world/camera.ts`,
  `game-data.ts` (`maps`, `withMaps`), loader, Preload (loads tilesets + player sheet), `main.ts` (music, hooks
  `currentMusic`, `overworldLocked`, `debugMode`), events, es.json, READMEs; data tests updated for the new zones.
- Verified with Playwright on all four profiles + screenshots (`tests/e2e/m4-warps.spec.ts`): door in/out lands at
  (6, 7) facing down; walking off the east edge on row 12 arrives at `test_east` (0, 12) and back at `test` (29, 12);
  a warp aimed at a wall shows `maps/test.tmj › warps.house_door › target tile (0, 0) on map "test_house" is not
  walkable`; the interior is centred; music switches test → interior and stays on test → test_east; teleport menu.
  Music is only checked by key (headless browsers have no audible output); the crossfade is unit-tested.

### M5

- Built: `ui/dialog-box.ts` (512 × 80, types at `TEXT_CPS` 30/s, A reveals then advances, blinking arrow when more
  follows, word wrap, voice every `VOICE_EVERY_CHARS` 3 chars), `ui/choice-box.ts` (+ `ui/cursor.ts`), `world/npc.ts`
  (NPCs of the current zone spawn, wander, block), talking in `OverworldScene` (NPC turns to the player, stops,
  says its lines; player frozen until the last box). Rules are pure and tested: `logic/dialogue.ts`,
  `logic/npc-wander.ts`, `logic/talk.ts` (healer `[curar]` before its dialogue, storage `[caja]` after, until M9).
- Hooks: `npcs()`, `dialogue()`, `openChoice()`, `choice()`, `choiceResult()`; `overworldLocked()` now also covers an
  open box (`tests/README.md`). Files outside the M5 list: the three `src/logic/` files, `constants.ts`
  (`TEXT_CPS`, `VOICE_EVERY_CHARS`), `movement.ts` (`renderPosition`/`walkFrame` accept NPC state), `ui/cursor.ts`,
  `main.ts` (hooks), `es.json` (`npc.healer_placeholder`, `npc.storage_placeholder`), READMEs.
- Rules chosen (Open questions › Raised in M5): NPCs never step on warp tiles; both tiles of a step in progress are
  taken (player and NPCs), so nobody can share a tile; A talks to an NPC standing on, or arriving at, the faced tile;
  NPCs take priority over `action` warps; enemy NPCs only talk for now (sight and battles are M8).
- Verified with Playwright on all four profiles + screenshots (`tests/e2e/m5-dialogue.spec.ts`): a talker injected
  into `npcs.json` (route interception, no code change) appears, blocks, turns and talks; long text wraps and
  continues on further boxes with every word kept; healer/storage placeholders; choice box; three wanderers + a
  randomly walking player never leave the rectangle or share a tile, watched 20 s per profile and once for 2 minutes
  (desktop). For M6/M7: reuse `DialogBox`/`ChoiceBox` (one per scene, call `update` each frame while open).

### M6

- Built: `BattleScene` (layout per plan; messages in the M5 DialogBox, A to go on), `ui/hp-bar.ts` (400 ms animation,
  green/yellow/red), `ui/grid-menu.ts` (2 × 2 main menu, attack list + accuracy, team list with icons/HP, greyed options),
  pure `logic/battle-view.ts` (`viewSteps(events)` → message/sound/show/hit/hp/faint steps, menu rows via `actionError`)
  so the scene never computes a rule. Overworld: 600 ms flash, sleeps under the battle, wakes on the same tile on
  `battle:ended` (safe steps reset). Debug menu (F2 ×2): "Combate: {name}" per flexymon. Objeto says "Pronto".
- Files outside the M6 list: `src/core/session.ts` + `src/logic/new-game.ts` (the battle needs a live team; a new game
  from `start.json` until M10 saves), `src/ui/cursor.ts` (`moveGridCursor`), constants (`BATTLE_FLASH_MS`, `HP_ANIM_MS`,
  `HP_YELLOW_BELOW`, `HP_RED_BELOW`), events (`debug:battle`, `battle:ended`), `config/game.ts`, `debug-scene.ts`,
  `main.ts` (hooks `startBattle`, `battle`, `team`, `setTeam`), `es.json`, READMEs. `tests/i18n/t.test.ts` used
  `battle.wild_appeared` as its "missing key" example; that key exists now, so it uses another missing key.
- Decisions (Open questions › Raised in M6): a lost battle returns to the same tile with the team healed (M8 replaces
  this with the Losing rule); B in the main menu does nothing; the forced switch after a faint cannot be cancelled.
- Verified with Playwright (`tests/e2e/m6-battle.spec.ts`, all four profiles) + screenshots: Portátil vs Ratón won,
  lost and fled; after every round `shownHp == hp` and "PS hp/max" matches; B returns from attack/team menus and
  Objeto; Huir greyed and inert against an NPC; voluntary and forced switches; debug menu battle. For M7: start wild
  battles with `OverworldScene.startBattle({ speciesId })` and handle the catch choice on `battle:ended` (`win`).

### M7

- Built: the `encounters` layer is read by `src/data/tiled.ts` (`group` + `mode` per rectangle, both required);
  load checks: a group missing from zones.json is an error, an unused one a boot warning (`mapWarnings`,
  `LoadResult.warnings`). The overworld runs `checkStep()` after every completed non-warp step; an encounter halts
  the player on that tile (a held key's next step is dropped, `haltAt`) and starts a wild battle. After a wild win
  the BattleScene asks "¿Te llevas a {name}?" (ChoiceBox Llevármelo / Dejarlo, B = Dejarlo) and runs `takeFlexymon()`
  with the message from `catchMessages()`. Test map: tall grass x 20–23 y 2–5 inside `jardin` (`tiles`) and a crowd
  rectangle `plaza` (`all`) at x 1–4 y 13–16 (`npm run test-map -- --force` regenerated only `test.tmj`). F2 menu
  option "Encuentros: sí/no" (`src/core/debug-flags.ts`). Hooks `party`, `safeSteps`, `encountersEnabled`,
  `setEncounters`; `battle().ui` can be `catch`.
- Files outside a list (M7 has none in the plan): `src/core/debug-flags.ts`, `src/logic/movement.ts` (`haltAt`),
  `world/player.ts` (`halt`), `logic/battle-view.ts` (`catchMessages`), `data/loader.ts` + `boot-scene.ts`
  (warnings), `main.ts` (hooks), `es.json`, READMEs. `tests/data/tiled.test.ts` asserted "no tall grass yet"; it now
  checks the grass and rectangles. `tests/e2e/m6-battle.spec.ts`'s `advance()` presses B (Dejarlo) on the new catch
  choice, so the M6 checks run unchanged.
- Flaky tests fixed (they also failed now and then on `main`): a menu or ChoiceBox ignores input on the frame it opens,
  and the M5/M6 tests could press a key in that very frame under load. The `press()` helpers (M6, M7) and the M5
  choice-box test now wait two animation frames before pressing. No game code changed for this.
- Decisions (Open questions › Raised in M7): the catch choice happens on the battle screen, before the fade-out;
  Dejarlo shows no message; while encounters are switched off, safe steps still count down.
- Verified with Playwright on all four profiles + screenshots (`tests/e2e/m7-encounters.spec.ts`): with every rate at
  100 (zones.json intercepted), 3 safe steps after map entry and after each battle, then every grass step starts a
  battle, plain grass inside a `tiles` rectangle never does, a held key stops on the grass tile; the `all` rectangle
  rolls on plain grass; a second Ratón merges with "¡Ratón se ha fusionado! {stat} +{n}" and exactly that bonus
  rises; a new species joins a team with a free slot; with a full team it goes to storage with its message;
  Dejarlo changes nothing; the debug option stops encounters. For M8: NPC battles skip the catch (`kind` `npc`).

## Open questions

### From the plan (none block M0–M12)

- [ ] What is the catch item that replaces the 100% catch? (Hook: `canCatch()` and item effect `catch`.)
- [ ] Which item pairs unlock the Audi, and where does the player get each item? (Placeholders: `llaves_audi`, `carnet`, `cafe_doble`; decide by M13.)
- [ ] Final list of secret names and their rewards. Keep the real list out of public repos if the names refer to coworkers.
- [ ] Final roster of flexymon, enemies and dialogue (M14 target: 12 flexymon, 15 enemy NPCs).
- [ ] Is it fine to use the names Isaval, Ciruelo and the bars in a game shared internally? Check with the relevant people before M14.
- [ ] Which static host, and does the link need a password? (Decide by M15.)
- [ ] Who draws the real art and sound, and in what order? Suggested: title office, player, Portátil, tilesets, then flexymon.

### Raised in M7 (safe assumptions in brackets)

- [ ] Where does the catch choice appear? [On the battle screen after the win message, before fading out.] Does B
  mean Dejarlo? [Yes.] Is there a message after Dejarlo? [No.]
- [ ] Wording for a new flexymon joining the team or going to storage is not in the plan. [`catch.to_team` "¡{name}
  se une a tu equipo!", `catch.to_storage` "Tu equipo está lleno. {name} se ha enviado a la caja." in `es.json`.]
- [ ] Must an encounter rectangle's `mode` be set? [Yes, a missing or unknown mode stops the game at boot.]
- [ ] With encounters switched off in the debug menu, do safe steps still run down? [Yes; nothing rolls.]

### Raised in M6 (safe assumptions in brackets)

- [ ] What happens after a loss before M8's Losing rule exists? [Back on the same tile, team fully healed.]
- [ ] Is there game state before M10 saves? [`src/core/session.ts` holds it in memory; a reload starts a new game.]
- [ ] What does B do in the battle's main menu? [Nothing.] Can the forced replacement after a faint be cancelled? [No.]
- [ ] Battle message wording (appear, uses, stat up/down, win/lose…) is not in the plan. [Written in `es.json`
  under `battle.*`; easy to change.]

### Raised in M5 (safe assumptions in brackets)

- [ ] The plan asks for a pixel font, but no font asset exists. [Browser monospace at 14 px in the dialogue and
  choice boxes; swap in a pixel font with the real art.]
- [ ] NPC sprites are single 32 × 32 placeholders, so facing cannot be seen. [`world/npc.ts` treats a 64 × 128 image
  as a sheet with the player's layout and shows facing/walk frames; other sizes are drawn still. Real NPC art should
  use the sheet layout.]
- [ ] What happens to a dialogue string too long for one box? [It continues on extra boxes; no text is cut.]
- [ ] May wandering NPCs stand on warp tiles (doors, edges)? [No, they could block a door.]
- [ ] Does B advance dialogue? [No, only A, as the plan says; B cancels a ChoiceBox.]
- [ ] Talking to an enemy NPC before M8. [It says its `dialogue`; no sight check or battle yet.]

### Raised in M4 (safe assumptions in brackets)

- [ ] How are map-edge warps drawn in Tiled? [A step-warp rectangle one tile outside the map, with `toX` (or
  `toY`) set and the other left out so the row (or column) is kept. Documented in `public/maps/README.md`.]
- [ ] `valencia` had no map. [Removed from `zones.json` until M14; everything that pointed at it now points at the
  test maps.]
- [ ] The debug teleport needs a menu but only the game keys exist. [F2 cycles info → menu; in the menu the arrows,
  A and B drive the list and the player does not move.]

### Raised in M3 (safe assumptions in brackets)

- [ ] "Turn in place on a short tap (< 100 ms)": does that apply when tapping the direction already faced?
  [No: the faced direction walks at once (one tile per press); only a new direction turns first.]
- [ ] Does `solid = true` block only in the `collision` layer, or in any layer? [Any tile layer.]
- [ ] What is the `spawns` object layer for? [Named spawn points; `default` is the zone spawn, used when no
  position is given (and by M4's debug teleport). New games still use `start.json › spawn`.]
- [ ] Until the Title scene (M11), how does the player get from the title to the game? [The Preload screen says
  "Pulsa START"; Start, A or a tap enters the overworld at `start.json › spawn`.]
- [ ] The player sprite path (`assets/sprites/player.png`) is not in any content file. [Constant in
  `src/world/player.ts`; move it to config if the plan wants several player sprites.]

### Raised in M2 (safe assumptions in brackets)

- [ ] Can a healing item be used on a flexymon at full HP, or a heal on a fainted one? [No: `actionError` returns
  `no_effect`, the turn is not used. Revive only works on fainted ones; buff items always target the active one.]
- [ ] Do safe steps count every completed step or only steps on encounter tiles? [Every completed step.]
- [ ] Merging an HP gain into a fainted instance raises `currentHp` too, which revives it. [Literal rule kept.]
- [ ] Old saves that no longer fit the content. [Unknown flexymon/items/NPCs dropped; bonus and HP clamped; unknown
  map → respawn point; extra team members → storage; empty team takes the first stored flexymon; no flexymon at all
  → the save is treated as broken (`empty_team`).]
- [ ] Should key items be buyable when they have a price? [Yes for buying (only `price: null` blocks it); never
  sellable.]

### Raised in M1 (safe assumptions in brackets)

- [ ] The plan does not say what a "Preload-complete screen" looks like. [It still shows the "Flexymon" title
  until the Title scene exists (M11).]
- [ ] Should key items be allowed a price, or should `key` imply `price: null`? [Not enforced; only shops are
  checked.]

### Raised during repo preparation (safe assumptions in brackets)

- [x] The plan names `.eslintrc.cjs`, but current ESLint (v9+) uses flat config. **Resolved in M0:**
  `eslint.config.js`.
- [x] The plan puts unit tests in `tests/` mirroring `src/logic`, and the repo already has
  Playwright tests in `tests/e2e/`. **Resolved in M0:** unit tests go in `tests/core/`, `tests/i18n/`,
  `tests/logic/`…; Vitest runs `tests/**/*.test.ts` and excludes `tests/e2e/**`.
- [x] M2 asks for `vitest --coverage` above 90%. **Resolved in M0:** `@vitest/coverage-v8` installed;
  `npm run coverage`.
- [ ] The plan's folder tree is rooted at `flexymon/`; this repo is `not-pokemon`. [The repo root
  plays the role of `flexymon/`; no extra nesting.]
- [ ] "Checked by hand in the browser" is not possible in an unattended cloud session.
  [Verify with Playwright through `window.__E2E__` hooks plus screenshots, and say so in the PR.]
- [ ] Is this repo public? Plan open question about secret names and real company/coworker names
  depends on it. [Keep only placeholder secret names (`paco`) in the repo until confirmed.]

### Resolved at preparation (old `CLAUDE.md` vs plan — plan wins)

| Topic | Old CLAUDE.md | Now (per plan) |
| --- | --- | --- |
| Pure game logic | `src/core/` | `src/logic/` (`src/core/` = log, rng, events, input, save store) |
| Content JSON | `src/data/` | `public/data/` (schemas + loader in `src/data/`) |
| Maps | `public/assets/maps/` | `public/maps/` |
| Resolution | 320×180 or 240×160 | 512×288 |
| Input module | `src/input/controls.ts`, incl. gamepad | `src/core/input.ts`, no gamepad |
| Types / levels | type chart, stats/leveling | no types, no levels, no XP |
| Unit test command | `npx vitest run` | `npm test` (runs `vitest run`) |
