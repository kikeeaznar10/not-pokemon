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
- [x] M8 — Enemy NPCs
- [x] M9 — Items, team, storage, shops and healing
- [x] M10 — Start menu and saving
- [x] M11 — Title screen, intro and secret names
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

### M8

- Built: pure `src/logic/enemy-npc.ts` (`findSpotter`, `npcTeam`, `winAgainstNpc`, `loseBattle`, `placedEnemies` /
  `refreshCooldowns`), approach helpers in `npc-wander.ts` (`engage`, `forceStep`, `faceTo`; outside its rectangle an
  NPC only steps back towards it), `talk.ts` (cooldown enemy → `defeatDialogue`). Overworld: sight check after every
  player step and every NPC step while the player stands; spotted → halt, lock, "!" bubble 600 ms (`NPC_ALERT_MS`,
  text `npc.alert`), walk up (path tiles reserved), both face each other, `dialogue`, `npc` battle against a fresh
  team; A facing a `ready` enemy starts the same sequence. Battle: win with `npcId` → "¡Has ganado {n} €!", euros,
  `cooldown`; then the NPC says `defeatDialogue` in the overworld. Any loss (wild too) → Losing rule, restart at
  `start.json › respawn` with "Te has despertado en la oficina...". Debug: "Euros: {n}" in the F2 info, menu option
  "NPC: todos listos". Hooks `euros`, `setEuros`, `npcStates`; `npcs()` gained `state` and `alert`.
- Files outside a list (M8 has none in the plan): `npc-wander.ts`, `talk.ts`, `constants.ts`, `world/npc.ts`,
  `world/player.ts` (`face`), `battle-scene.ts`, `debug-scene.ts`, `main.ts`, `es.json`, READMEs. Tests changed on
  purpose: `m6-battle.spec.ts`'s loss test now checks the Losing rule (respawn (15, 11), half the euros, message)
  instead of M6's "same tile" placeholder (its `advance()` also accepts the overworld showing that message), and
  `m5-dialogue.spec.ts` expects the two new `npcs()` fields; `m7-encounters.spec.ts` presses ArrowUp twice in the debug menu (the new
  option is now last); `m5-dialogue.spec.ts`'s wander watch serves the shipped becario as a talker, since an enemy
  now walks out of its rectangle to challenge the randomly walking player. No check was weakened.
- Verified with Playwright on all four profiles + screenshots (`tests/e2e/m8-enemies.spec.ts`, injected enemies and
  boosted stats): 5 tiles away no trigger, 4 tiles triggers ("!", walk to the adjacent tile, dialogue, NPC battle);
  behind the wall no trigger; win pays 80–140 € and shows the reward; next to it A gives only `defeatDialogue`;
  7 tiles away → `ready`, back into sight triggers again; a loss respawns at (15, 11) with half the euros, healed
  team, message, and the beaten NPC fights again (started by talking to it); debug euros line and NPC reset.
- For M9/M10: the game state's `npcs` and `euros` are live (session); M10 just saves them. `loseBattle` heals
  through `healParty`; M9's healer can reuse it.

### M9

- Built: battle Objeto (`itemMenu` / `itemTargetMenu` in `battle-view.ts`: items "x{n}", heal/revive ask for a team
  member, buffs go on the active one; the round runs through the existing `chooseAction` `item`, so the item is
  consumed and the opponent acts); `ShopScene` (Comprar / Vender / Salir, icon + price lists, quantity picker 1 … the
  most money and bag allow, Up/Down ±1, Right/Left ±`QTY_BIG_STEP` 10, Sí/No confirmation, money box; rules in
  `logic/shop.ts`, money in `economy.ts`); `StorageScene` (Equipo / Caja columns, A moves, last-member and slot rules
  via `logic/storage-box.ts` → `team.ts`, scrolling); healer (heals team + storage, "Tus flexymon están como
  nuevos.", then its dialogue); pure `useFieldItem(state, data, itemId, targetUid?)` in `logic/field-items.ts`
  (tested; M10's Mochila calls it). NPCs added to `test_house`: recepcionista (healer, 1, 4), informático
  (storage, 8, 4), tendero (shopkeeper `tienda_alboraya`, 8, 6) with placeholder sprites.
- Auto-save: there is no save store before M10, so the healer and leaving a shop emit `save:request`
  (`healer` / `shop`) on the event bus; M10 must listen to it and save (hook `saveRequests()` records them).
  Shop and Storage are overlay scenes launched over the overworld, which pauses until `overlay:closed`.
- Files outside the M9 list (none is given): `src/logic/{field-items,shop,storage-box}.ts`, `battle-view.ts`,
  `talk.ts`, `constants.ts`, `core/events.ts` (`save:request`, `overlay:closed`), `ui/grid-menu.ts` (long lists
  scroll — the sell list and battle items can outgrow the frame), `config/game.ts`, `overworld-scene.ts`,
  `battle-scene.ts`, `main.ts` (hooks `items`, `setItems`, `setParty`, `useFieldItem`, `shop`, `storage`,
  `saveRequests`; overworld hooks also answer while it is paused), `es.json` (placeholders `npc.healer_placeholder`,
  `npc.storage_placeholder`, `battle.item_soon` removed), READMEs. Tests changed on purpose: `m5-dialogue.spec.ts`
  checks the real healer message and that the storage box opens (were the "[curar]"/"[caja]" placeholders),
  `m6-battle.spec.ts` checks Objeto opens the item list and B returns (was "Pronto"), `talk.test.ts`, the asset
  count (`assets.test.ts`) and `m1-data.spec.ts`'s NPC count (5) follow the new content.
- Verified with Playwright on all four profiles + screenshots (`tests/e2e/m9-items.spec.ts`): 3 Cafés with 200 € →
  50 € and 6 Cafés, selling one → 75 € (+25); Regleta says "No tienes suficiente dinero."; B backs out of picker,
  list and shop; a Café in battle shows "Usas Café con Portátil." / "recupera 20 PS." then the wild Ratón attacks,
  and 2 Cafés are left after fleeing; the box refuses to empty the team and to exceed 2 slots; the healer heals
  team and storage and requests a save. Unit tests: `field-items`, `shop`, `storage-box`, battle-view items.

### M10

- Built: `MenuScene` (Start in the overworld; the overworld pauses, so NPCs freeze): Equipo (list → detail page with
  the four stats as "value (base + bonus)", attacks, *Mover* to reorder), Mochila (descriptions, field items through
  `useFieldItem`: Café / revive pick a team member, Regleta at once, others greyed), Mapa (placeholder until M12),
  Opciones (Música / Efectos 0–10, Texto lenta / normal / rápida, stored in `flexymon.options`, applied live), Cerrar.
  Saving: `src/core/save-store.ts` (`flexymon.save.v1`; unreadable saves copied to `flexymon.save.broken`, fresh start),
  `src/core/autosave.ts` (saves on every `save:request`: `map`, `battle`, `shop`, `healer`, `menu`), `HudScene`
  ("Guardando…" for 600 ms on `save:done`). Preload loads a valid save on Start (no Title until M11). Debug option
  "Borrar partida". Pure rules: `logic/menu.ts`, `logic/options.ts`; `typeTick` takes the text speed.
- "Reload at any time": the listed save points alone would lose the steps since the last one, so the game also saves
  quietly on `pagehide` / page hidden, and `player:moved` (now also sent on a turn on the spot) keeps the position in
  the state. That quiet save is skipped when the slot no longer holds what the page wrote (devtools garbage, another
  tab), so the garbage check still starts fresh. Nothing is saved before the first map is entered.
- Files outside a list (M10 has none in the plan): `core/{save-store,autosave,options}.ts`, `logic/{menu,options}.ts`,
  `scenes/{menu,hud}-scene.ts`, `constants.ts` (`TEXT_SPEED_CPS`, `VOLUME_STEPS`, `SAVE_ICON_MS`), `dialogue.ts`,
  `ui/dialog-box.ts` and `battle-scene.ts` (text speed, effects volume, `save:request` `battle`), `world/music.ts`
  (`setGain`), `overworld-scene.ts`, `preload-scene.ts`, `debug-scene.ts`, `config/game.ts`, `events.ts`, `main.ts`
  (hooks `savesWritten`, `savedGame`, `saveIcon`, `menu`, `options`, `setOptions`, `musicGain`, `patchState`),
  `es.json`, READMEs. Tests changed on purpose: `m9-items.spec.ts` only counts `shop` / `healer` requests (M10 adds a
  `map` request on every map entry); `m7-encounters.spec.ts` expects "Borrar partida" between the "Opciones" header
  and "Encuentros" (the cursor moves are unchanged). No check was weakened.
- Verified with Playwright on all four profiles + screenshots (`tests/e2e/m10-menu-save.spec.ts`): after walking,
  turning and changing team (with bonuses), storage, bag, euros and NPC states, a reload continues on the same tile
  and facing with everything equal; garbage and schema-invalid saves start a new game with no page error and the
  broken copy kept; the menu pauses the overworld (the becario does not move for 3.5 s); detail stats; reorder;
  closing saves and shows "Guardando…"; Café +20 PS, Regleta 3 slots; options persist after reload; rápida types
  faster than lenta; map and battle saves; "Borrar partida" reloads into a new game.
- Known flaky (not changed): `m6-battle.spec.ts` "a battle can be lost" failed once on desktop in a full run (an
  extra A in the battle intro opened the attack menu, like the M7 note); it passed 24 / 24 when repeated.
- For M11: `saveStore.load(getGameData())` tells the Title whether *Continuar* exists (`loaded`); a new game is
  `resetGameState()` + `gameState()`. Move the load from Preload to the Title. Sound effects pass
  `{ volume: sfxVolume() }`.

### M11

- Built: `TitleScene` (the pixel office from `intro.json › titleImage`, logo, blinking "Pulsa START"; menu *Continuar*
  only with a valid save, *Nueva partida* asking Sí / No over a save), `NameScene` (grid A–Z, Ñ, á é í ó ú, space,
  Borrar, OK from `es.json › name.letters`; max 10; physical keyboard through a new Input *text mode*; clicks/taps on
  cells), `IntroScene` playing the new `public/data/intro.json` (schema `src/data/schemas/intro.ts`: `fade_in`,
  `wait`, `walk`, `face`, `say`, one `handover`) on the `start.json › spawn` map; the handover plays the jingle, shows
  "¡Recibes a Portátil!" and then the secret name's items and message. Pure rules: `logic/intro.ts`,
  `logic/name-entry.ts`. Preload now hands over to the Title; the save is read there (M10 note).
- Content: `intro.json` (10th data file; coworker "Compañera" walks down the path from (15, 3), control starts at
  (15, 8) on `test`), placeholders `assets/ui/title.png` (512 × 288 office drawn by `npm run placeholders`),
  `sprites/npcs/companera.png`, `audio/sfx/jingle_starter.{ogg,mp3}`. Boot checks the intro walks (`map-checks.ts`).
- Files outside the M11 list: `src/core/input.ts` (text mode), `src/world/zone-map.ts` (map drawing moved out of the
  Overworld so the Intro reuses it), `overworld-scene.ts`, `preload-scene.ts`, `config/game.ts`, data loader /
  game-data / assets / map-checks, `constants.ts` (`NAME_MAX_LENGTH`, `TITLE_BLINK_MS`), `main.ts` (hooks `title`,
  `quickStart`, `nameEntry`, `intro`, `playerName`), `tools/make-placeholders.ts` (title image), `es.json`, READMEs.
  Tests changed on purpose: every e2e helper that pressed Enter on the old Preload title now calls `quickStart()`
  (same behaviour: continue the save or new game at the spawn, no intro); `m0-title` reads the logo / hint from the
  Title scene (new positions), `m1-data` expects `Title` after Preload; `assets.test.ts` counts the new assets; tests that move
  `start.json › spawn` also serve a neutral intro (`tests/e2e/neutral-intro.ts`), since the boot checks reject an
  intro that does not fit the spawn's map.
- Verified with Playwright on all four profiles + screenshots (`tests/e2e/m11-title-intro.spec.ts`): title → name
  "Ana" → intro → free movement in about 9–23 s (under 60 s), starting state from `start.json` and saved; "PACO" gets
  +10 Cafés and the message, "Pacoo" does not; Continuar hidden with no save and restores position and euros;
  Nueva partida over a save: No keeps it, Sí replaces it; name screen keyboard / grid / limit / empty name.
- For M12: B in the name screen only comes from touch (the X key types "x" there); touch buttons must call
  `input.press/release`, which text mode does not affect. For M14: replace the intro script and coworker for the real
  office (`intro.json`), and keep the coworker's final walk out of view.

## Open questions

### From the plan (none block M0–M12)

- [ ] What is the catch item that replaces the 100% catch? (Hook: `canCatch()` and item effect `catch`.)
- [ ] Which item pairs unlock the Audi, and where does the player get each item? (Placeholders: `llaves_audi`, `carnet`, `cafe_doble`; decide by M13.)
- [ ] Final list of secret names and their rewards. Keep the real list out of public repos if the names refer to coworkers.
- [ ] Final roster of flexymon, enemies and dialogue (M14 target: 12 flexymon, 15 enemy NPCs).
- [ ] Is it fine to use the names Isaval, Ciruelo and the bars in a game shared internally? Check with the relevant people before M14.
- [ ] Which static host, and does the link need a password? (Decide by M15.)
- [ ] Who draws the real art and sound, and in what order? Suggested: title office, player, Portátil, tilesets, then flexymon.

### Raised in M11 (safe assumptions in brackets)

- [ ] Where does the intro happen, and who is the coworker? [On the `start.json › spawn` map (still the test map)
  with an intro-only coworker defined in `intro.json`; the plan's "walk into the office" waits for M14's real office.
  The intro starts on the spawn tile and control begins where the script leaves the player.]
- [ ] Where is the title image path configured? [`intro.json › titleImage`, so it is content, not code.]
- [ ] The intro is tied to the spawn: moving `start.json › spawn` without updating `intro.json` (coworker tile, walks)
  stops the game at boot with an `intro.json › …` error. [Kept: a broken intro would otherwise hang a new game.]
- [ ] The letter grid mixes upper-case A–Z / Ñ with lower-case á é í ó ú, as the plan lists them. [Kept literally; the
  physical keyboard types any case. A Mayús/minús key would be easy to add.]
- [ ] Physical keyboard vs. the A/B keys in the name screen. [Letter keys type, including Z and X, so on a keyboard
  Enter is OK and Backspace deletes; arrows still move the grid cursor. B (touch, M12) deletes, and on an empty name
  goes back to the title.] Which characters are allowed? [Letters of any alphabet and single spaces; no digits.]
- [ ] Does "Pulsa START" lead straight to the game when there is no save? [No: the menu shows with only Nueva
  partida, so the player sees the choice.] Confirmation wording and default. [Sí / No with the cursor on No.]
- [ ] A broken save on the title. [Only Nueva partida, plus the line "No se pudo leer la partida guardada."]
- [ ] The secret-name message order. ["¡Recibes a Portátil!" first, then the secret name's message, in the same
  dialogue; items capped at 99 each like any gain.]
- [ ] No music during the intro. [Zone music starts when the overworld enters the map (`zone:entered`), as before.]

### Raised in M10 (safe assumptions in brackets)

- [ ] "Reload at any time" vs. the list of save points. [Also a quiet save on page hide / close, not shown with
  "Guardando…"; skipped if the slot was changed outside the game.]
- [ ] Does B close the Start menu, and does Start close it again? [Both, and *Cerrar*. B goes back one step in the
  sub-screens.]
- [ ] Opciones ranges and defaults are not in the plan. [Volumes 0–10, both start at 10 (the music's mix level stays
  `MUSIC_VOLUME` 0.6 at 10); text 15 / 30 / 60 characters per second, normal = the old `TEXT_CPS`.]
- [ ] Mochila: are items not usable outside battle listed? [Yes, greyed with their description; key items too.]
- [x] Until M11 the game still starts from the "Pulsa START" screen (needed for the audio unlock); Start continues a
  valid save. [The plan's "load straight into the game" is read as "no Continuar / Nueva partida choice yet".]
  **Resolved in M11:** the Title scene offers Continuar / Nueva partida.
- [ ] The "Guardando…" icon look. [Small dark box top right, `HudScene`, until real UI art.]

### Raised in M9 (safe assumptions in brackets)

- [x] "Auto-save" after healing comes before saving exists (M10). **Resolved in M10:** `autosave.ts` saves on it.
- [ ] Healer message wording and order. ["Tus flexymon están como nuevos." (`healer.done`), shown after the heal
  and before the NPC's dialogue, as the plan's "heals the team, then says its dialogue".]
- [ ] Can field items target the storage box? [No: team only (`not_in_team`), the field menu only shows the team.]
  Can a buff item marked `"field"` be used outside battle? [No: refused, it would last no turns.]
- [ ] Shop details not in the plan: B in the picker goes back to the list; the picker does not wrap; the sell list
  shows key items greyed ("—") instead of hiding them; an unaffordable item stays selectable and says "No tienes
  suficiente dinero."; purchases are capped by bag room (99) as well as money; no goodbye line when leaving.
- [ ] Storage: a moved flexymon goes to the end of the other column; the box needs no Sí/No confirmation; fainted
  flexymon can be moved (shown greyed).
- [ ] Shop and storage NPCs live in `test_house` with the healer (plan: healer and storage there; the shopkeeper had
  no map before). [All three in `test_house` until M14 places the real shops.]

### Raised in M8 (safe assumptions in brackets)

- [ ] Where are the reward message and `defeatDialogue` shown? ["¡Has ganado {n} €!" on the battle screen after
  "¡Has ganado el combate!"; `defeatDialogue` in the overworld once it has faded back in.]
- [ ] Does the player turn to face an enemy that walked up? [Yes.] Does talking to a `ready` enemy also show the
  "!"? [Yes, the "same sequence", without the walk.]
- [ ] Where does an enemy stand after the battle? [Where it walked to. A wanderer outside its rectangle only steps
  towards the rectangle until it is back inside; a `wander: null` enemy stays there until the map is reloaded.]
- [ ] When is the sight checked? [After every completed player step and every NPC step while the player stands
  still; not on map entry and not when the player only turns.] If a step both enters a sight line and rolls a wild
  encounter? [The enemy wins; no encounter roll.]
- [ ] Does the Losing rule apply to wild battles too? [Yes: the rule only says "all team members are fainted".]
- [ ] The "!" bubble's look. [White box with a red "!" (`npc.alert` in `es.json`) above the NPC, until real art. An
  enemy 4 tiles above the player sits on the top screen row, so the bubble is lowered over its head there.]

### Raised in M7 (safe assumptions in brackets)

- [ ] Where does the catch choice appear? [On the battle screen after the win message, before fading out.] Does B
  mean Dejarlo? [Yes.] Is there a message after Dejarlo? [No.]
- [ ] Wording for a new flexymon joining the team or going to storage is not in the plan. [`catch.to_team` "¡{name}
  se une a tu equipo!", `catch.to_storage` "Tu equipo está lleno. {name} se ha enviado a la caja." in `es.json`.]
- [ ] Must an encounter rectangle's `mode` be set? [Yes, a missing or unknown mode stops the game at boot.]
- [ ] With encounters switched off in the debug menu, do safe steps still run down? [Yes; nothing rolls.]

### Raised in M6 (safe assumptions in brackets)

- [x] What happens after a loss before M8's Losing rule exists? **Resolved in M8:** the Losing rule runs.
- [x] Is there game state before M10 saves? **Resolved in M10:** the session state is saved and reloaded.
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
- [x] Talking to an enemy NPC before M8. **Resolved in M8:** a `ready` enemy starts its battle, a `cooldown` one
  says its `defeatDialogue`.

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
- [x] Until the Title scene (M11), how does the player get from the title to the game? [The Preload screen says
  "Pulsa START"; Start, A or a tap enters the overworld at `start.json › spawn`.] **Resolved in M11.**
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

- [x] The plan does not say what a "Preload-complete screen" looks like. [It still shows the "Flexymon" title
  until the Title scene exists (M11).] **Resolved in M11:** Preload only shows the loading bar, then the Title.
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
