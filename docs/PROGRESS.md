# Flexymon — Progress

Work through the milestones in order, one per session (see `CLAUDE.md` and `docs/PLAN.md`).
When a milestone is merged, tick it here and add a 3–5 line summary under "Milestone notes".

## Milestones

- [x] M0 — Project skeleton and placeholders
- [ ] M1 — Config loading and validation
- [ ] M2 — Battle and rules logic (no graphics)
- [ ] M3 — Overworld: one map, movement, input
- [ ] M4 — Maps, warps and interiors
- [ ] M5 — Dialogue and talking NPCs
- [ ] M6 — Battle scene
- [ ] M7 — Wild encounters, catching and merging
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

## Open questions

### From the plan (none block M0–M12)

- [ ] What is the catch item that replaces the 100% catch? (Hook: `canCatch()` and item effect `catch`.)
- [ ] Which item pairs unlock the Audi, and where does the player get each item? (Placeholders: `llaves_audi`, `carnet`, `cafe_doble`; decide by M13.)
- [ ] Final list of secret names and their rewards. Keep the real list out of public repos if the names refer to coworkers.
- [ ] Final roster of flexymon, enemies and dialogue (M14 target: 12 flexymon, 15 enemy NPCs).
- [ ] Is it fine to use the names Isaval, Ciruelo and the bars in a game shared internally? Check with the relevant people before M14.
- [ ] Which static host, and does the link need a password? (Decide by M15.)
- [ ] Who draws the real art and sound, and in what order? Suggested: title office, player, Portátil, tilesets, then flexymon.

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
