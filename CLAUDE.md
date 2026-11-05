# Flexymon — rules for Claude Code sessions

Flexymon is a browser game (desktop + mobile, landscape) in the style of the Game Boy Color
monster-collecting RPGs, set in a cartoon Valencia region. It is built milestone by milestone
(M0–M15) by separate, unrelated Claude Code sessions.

**`docs/PLAN.md` is the source of truth for the game** (rules, content format, milestones). If
anything in this file disagrees with the plan, the plan wins; record the disagreement under
"Open questions" in `docs/PROGRESS.md`. **Exception:** the workflow rules in "How to work" below
(testing, documentation, pushing to `main`) replace the plan's branch/PR rules.

## How to work (every session)

1. Before writing any code, read this file, `docs/PLAN.md` and `docs/PROGRESS.md`.
2. Work on **exactly one milestone**: the first unticked one in `docs/PROGRESS.md` (or the one
   the user names). Do not start the next one, even if there is time left.
3. Branch: develop on `m<number>-<short-name>` (e.g. `m4-dialogue`), or on the branch the
   harness assigned to the session. Commit there while working.
4. Only change files listed in the milestone, plus tests. If you must touch another file,
   explain why in the milestone summary in `docs/PROGRESS.md`.
5. Never hard-code game content (creature names, numbers, dialogue, prices) in TypeScript.
   Content lives in `public/data/*.json`; UI strings live in `src/i18n/es.json`. Code reads them.
   Tunable rule numbers live in `src/logic/constants.ts`.
6. If the plan is unclear or wrong, stop, write the question in `docs/PROGRESS.md` under
   "Open questions", and finish the milestone with the safest assumption. Never silently invent rules.
7. When finished, tick the milestone in `docs/PROGRESS.md` and add a 3–5 line summary: what was
   built, any deviation, anything the next session must know.
8. **Document everything.** Every feature ships with its documentation in the same commit:
   - a short doc comment (`/** ... */`) on every exported function, class, type and scene,
     saying what it does and any non-obvious rule it follows;
   - every new JSON field, map property, debug command, `__E2E__` helper or npm script described
     in the relevant doc (`docs/PROGRESS.md` summary, the folder's `README.md`, and from M15
     `docs/CONTENT.md`);
   - any decision or deviation from the plan written in `docs/PROGRESS.md`.
   Undocumented work is not done.
9. **Test before pushing to `main`.** A milestone may only reach `main` when every check of the
   Definition of done below passes: lint, typecheck, unit tests, build, Playwright, and every
   "Done when" item verified in the running game. If anything fails, fix it first; never push a
   red build to `main`, and never skip, disable or weaken a test to get green.
10. **When a feature (milestone) is finished and tested, push it to `main`.** Bring the branch
    up to date with `origin/main` first (`git fetch origin main` then rebase or merge), re-run the
    checks if anything changed, then push: `git push origin HEAD:main`. Also push the working
    branch. `main` must always contain only finished, tested, documented milestones.

### Definition of done (every milestone)

- `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` pass with zero errors.
- Every item of the milestone's "Done when" list was checked in the running game. In a cloud
  session with no human at the browser, check it with Playwright (via the `window.__E2E__` hooks)
  and look at screenshots; say in the milestone summary which items were verified that way.
- `npx playwright test` passes (from M0 on, at least the smoke test).
- No `console.log` except through `log()` in `src/core/log.ts`.
- No new hard-coded content; no Spanish text inside `.ts` files.
- Everything documented (rule 8); `docs/PROGRESS.md` updated.
- Pushed to `main` (rule 10).

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
| Node.js LTS + npm | Node 22 (`.nvmrc`). |
| TypeScript 6.0, `strict: true` | No `any` without a comment explaining why. Stay on 6.0 until `typescript-eslint` supports 7. |
| Vite | Vanilla TS template; output `dist/`, fully static. |
| Phaser | Pinned exactly (`4.2.1`, no `^`); all dependencies are pinned with `npm install -E`. |
| Zod | One schema per JSON file in `src/data/schemas/`. |
| Vitest | Unit tests; required for everything in `src/logic/`. |
| Playwright (`@playwright/test` 1.64.1) | Browser tests in `tests/e2e/`. The version matches the browsers pre-installed in cloud sessions. |
| ESLint (flat config, `eslint.config.js`) + Prettier | `npm run lint` runs both; `npm run format` fixes formatting. |
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
- Do not add dependencies beyond the plan's stack without saying why in the milestone summary.

## Commands (scripts are created in M0)

- `npm run dev` — dev server
- `npm run build` — typecheck + production build to `dist/`
- `npm run preview` — serve `dist/`
- `npm start` — install dependencies, build (typecheck + production build), then serve `dist/` with `vite preview`
- `npm run lint` (ESLint + `prettier --check`) / `npm run format` (Prettier write)
- `npm run typecheck` / `npm test` (Vitest, `vitest run`) / `npm run coverage` (Vitest + v8 coverage)
- `npm run placeholders` — generate missing placeholder assets (never overwrites; `-- --dry-run` lists them; see `tools/README.md`)
- `npm run world` — build the real world's maps from `tools/world/` (M14; never overwrites, `-- --force` regenerates)
- `npm run dev` then `?world=test` in the URL — the frozen M0–M13 test world (dev / E2E builds only, `src/data/world.ts`)
- `npx playwright test` — browser tests (builds with `VITE_E2E=1` and serves `dist/` automatically)
- `npx playwright test --project=iphone` — a single device profile

Vitest only runs `tests/**/*.test.ts` and excludes `tests/e2e/**` (in `vite.config.ts`).

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
