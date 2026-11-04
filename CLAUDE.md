# Flexymon — rules for Claude Code sessions

Flexymon is a browser game (desktop + mobile, landscape) in the style of the Game Boy Color
monster-collecting RPGs, set in a cartoon Valencia region. It is built milestone by milestone
(M0–M15) by separate, unrelated Claude Code sessions.

**`docs/PLAN.md` is the source of truth.** If anything in this file disagrees with the plan,
the plan wins; record the disagreement under "Open questions" in `docs/PROGRESS.md`.

## How to work (every session)

1. Before writing any code, read this file, `docs/PLAN.md` and `docs/PROGRESS.md`.
2. Work on **exactly one milestone**: the first unticked one in `docs/PROGRESS.md` (or the one
   the user names). Do not start the next one, even if there is time left.
3. Branch: `m<number>-<short-name>` (e.g. `m4-dialogue`), PR into `main`. If the session was
   assigned a different branch name by the harness, use that branch and put the milestone in the
   PR title (`M4 — Dialogue and talking NPCs`).
4. Only change files listed in the milestone, plus tests. If you must touch another file,
   explain why in the PR description.
5. Never hard-code game content (creature names, numbers, dialogue, prices) in TypeScript.
   Content lives in `public/data/*.json`; UI strings live in `src/i18n/es.json`. Code reads them.
   Tunable rule numbers live in `src/logic/constants.ts`.
6. If the plan is unclear or wrong, stop, write the question in `docs/PROGRESS.md` under
   "Open questions", and finish the milestone with the safest assumption. Never silently invent rules.
7. When finished, tick the milestone in `docs/PROGRESS.md` and add a 3–5 line summary: what was
   built, any deviation, anything the next session must know.

### Definition of done (every milestone)

- `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` pass with zero errors.
- Every item of the milestone's "Done when" list was checked in the running game. In a cloud
  session with no human at the browser, check it with Playwright (via the `window.__E2E__` hooks)
  and look at screenshots; say in the PR which items were verified that way.
- `npx playwright test` passes (from M0 on, at least the smoke test).
- No `console.log` except through `log()` in `src/core/log.ts`.
- No new hard-coded content; no Spanish text inside `.ts` files.
- `docs/PROGRESS.md` updated; PR opened.

## Locked decisions (summary — full table in `docs/PLAN.md`)

- Spanish only. The creatures are called **flexymon** (singular and plural). Never use the word
  "Pokémon" or any Nintendo asset in the game.
- Stats HP / Ataque / Defensa / Velocidad. No types, no levels, no XP. Max 3 attacks.
- Controls: desktop arrows/WASD, Z = A, X = B, Enter = Start, M = minimap. Mobile: on-screen
  D-pad, A, B, Start, Mapa; landscape only. **No gamepad.**
- Saving: `localStorage`, one slot, key `flexymon.save.v1`. No backend.
- Static site only.

## Stack

| Tool | Notes |
| --- | --- |
| Node.js LTS + npm | Version in `.nvmrc` (M0). |
| TypeScript, `strict: true` | No `any` without a comment explaining why. |
| Vite | Vanilla TS template; output `dist/`, fully static. |
| Phaser (latest stable, currently the 4.x line) | Pinned to an exact version, no `^`. |
| Zod | One schema per JSON file in `src/data/schemas/`. |
| Vitest | Unit tests; required for everything in `src/logic/`. |
| Playwright | Browser tests in `tests/e2e/` (already set up, see below). |
| ESLint + Prettier | `npm run lint`. |
| Tiled | Maps as `.tmj` (Tiled JSON, CSV layers, embedded tilesets). |

Screen: base resolution **512 × 288** (16 × 9 tiles of 32 px), `pixelArt: true`,
`roundPixels: true`, scale `FIT` + `CENTER_BOTH`. Position everything in tile/base-pixel units.

## Repo layout

```
CLAUDE.md                  this file
docs/PLAN.md               the milestone plan (source of truth)
docs/PROGRESS.md           milestone checklist, summaries, open questions
public/
  assets/sprites/          flexymon, characters, NPCs, items (PNG)
  assets/tilesets/         tileset PNGs used by Tiled
  assets/ui/               boxes, buttons, cursor, fonts, title, minimaps
  assets/audio/sfx/        attack and UI sounds (OGG + MP3)
  assets/audio/music/      one loop per region
  maps/                    Tiled maps (.tmj), one per zone
  data/                    game content JSON (nine files, see PLAN "Config specification")
src/
  main.ts                  creates the Phaser game
  config/game.ts           resolution, scene list
  core/                    log, save store, input, event bus, rng (infrastructure)
  data/                    loader + schemas/ (zod)
  logic/                   pure game rules, NO Phaser imports, 100% unit-tested
  scenes/                  Boot, Preload, Error, Title, Name, Intro, Overworld, Battle, Menu, Shop, Car, Debug
  ui/                      DialogBox, ChoiceBox, Menu, HpBar, TouchControls, Minimap
  world/                   Player, Npc, MapLoader, Warp, EncounterZone
  i18n/es.json             every visible UI string
tools/make-placeholders.ts generates placeholder art and sounds
tests/
  logic/ (etc.)            Vitest unit tests mirroring src/logic (and src/core, src/data)
  e2e/                     Playwright browser tests
playwright.config.ts       Playwright projects: desktop, android, android-landscape, iphone
```

## Architecture rules

- **Game rules are plain TypeScript in `src/logic/`, with no Phaser imports.** They take plain
  data and return plain data (battle resolution returns an `events[]` list the scene animates).
  Scenes never compute rules.
- **Phaser code is presentation and input only** (`src/scenes/`, `src/ui/`, `src/world/`).
- **Content is data**, validated with zod at boot, plus cross-reference checks. Any error stops the
  game on the red ErrorScene listing file › JSON path › message.
- **Randomness only through `src/core/rng.ts`** (seedable: `int`, `float`, `chance`, `pick`,
  `weighted`, `id`), so tests can fix the seed.
- **Input**: one service in `src/core/input.ts` (`isDown`, `justPressed` for
  `up/down/left/right/a/b/start/map`). Keyboard and touch both feed it; no scene reads the
  keyboard directly.
- **Scenes talk through `src/core/events.ts`** (typed event bus), not by reaching into each other.
- **Saves** go through a small save-store wrapper over `localStorage`, with a `version` field,
  schema validation and migration (drop unknown ids with a warning; broken JSON is copied to
  `flexymon.save.broken`).
- **Text**: `t('battle.wild_appeared', { name })` reads `src/i18n/es.json`; a missing key shows
  `⟦key⟧` and logs a warning.
- Browser hygiene: start audio only after the first user gesture; pause audio and the game loop on
  `visibilitychange` (hidden).

## Conventions

- Files `kebab-case.ts`, classes `PascalCase`, functions/variables `camelCase`, content ids
  `snake_case` (`portatil`, `bar_pacos`).
- Commits in English, imperative, small and focused ("Add dialogue box").
- Do not add dependencies beyond the plan's stack without saying why in the PR.

## Commands (scripts are created in M0)

- `npm run dev` — dev server
- `npm run build` — production build to `dist/`
- `npm run preview` — serve `dist/`
- `npm run lint` / `npm run typecheck` / `npm test` (Vitest, `vitest run`)
- `npm run placeholders` — generate missing placeholder assets (never overwrites)
- `npx playwright test` — browser tests (builds with `VITE_E2E=1` and serves `dist/` automatically)
- `npx playwright test --project=iphone` — a single device profile

Vitest must not pick up `tests/e2e/**` (configure `exclude` in M0).

## Test hooks and Playwright

- When `import.meta.env.DEV` is true or `VITE_E2E=1`, expose `window.__GAME__` (the
  `Phaser.Game` instance) and `window.__E2E__` helpers. Helpers grow with the milestones; at least
  `currentScene()`, `playerTile()` and `startBattle(seed)` once those systems exist.
- Playwright tests read state through these hooks, never by pixel-guessing. Screenshots are for
  visual review, not assertions, unless a test is explicitly a visual snapshot.
- Headless Chromium uses software WebGL (SwiftShader, set in `playwright.config.ts`). A black
  canvas usually means a WebGL init failure; check the console first.
- In cloud sessions Chromium is pre-installed: do not run `playwright install`. If the pinned
  `@playwright/test` version cannot find the browser, launch with
  `executablePath: '/opt/pw-browsers/chromium'`.
- When changing visuals, take a Playwright screenshot (desktop + `iphone` projects) and look at it
  before calling the task done.
