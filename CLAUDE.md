# Project: Pokémon-like browser game (Phaser 4 + TypeScript)

A 2D, tile-based, turn-based monster-collecting RPG that runs in desktop and mobile browsers.

## Stack
- Phaser 4, TypeScript (strict), Vite
- Maps: Tiled (`.tmj` JSON) in `public/assets/maps/`
- Unit tests: Vitest. Browser tests: Playwright (Chromium + WebKit)

## Commands
- `npm run dev`: dev server
- `npm run build`: production build to `dist/`
- `npx vitest run`: unit tests
- `npx playwright test`: browser tests (builds and serves `dist/` automatically)
- `npx playwright test --project=iphone`: run a single device profile

If the Phaser template has `*-nolog` scripts (`dev-nolog`, `build-nolog`), prefer them. The plain scripts send a usage ping to phaser.io.

## Architecture rules
- **The game logic is plain TypeScript, with no Phaser imports.** This covers battle resolution, damage formula, type chart, stats/leveling, inventory, party, save data and encounter tables. It lives in `src/core/` and is fully unit-tested with Vitest.
- **Phaser code is presentation and input only.** It lives in `src/scenes/`, `src/ui/` and `src/input/`. Scenes call into `src/core/` and render the result.
- **Content is data.** Monsters, moves, types, items, NPC dialogue and trainers live as JSON in `src/data/`, validated by a schema (zod) at load time. Do not hard-code content in scenes.
- **Determinism.** All randomness goes through an injectable seeded RNG (`src/core/rng.ts`), so battles are reproducible in tests.
- **Saves** go to `localStorage` behind a `SaveStore` interface, with a version field and a migration function.

## Rendering and mobile
- Use a fixed low internal resolution (for example 320×180 or 240×160), `pixelArt: true`, and `Phaser.Scale.FIT` with `autoCenter`.
- Use one input abstraction (`src/input/controls.ts`) that maps keyboard, gamepad and on-screen touch controls (D-pad + A/B + Start) to the same actions. Show touch controls only when the device has touch.
- Handle orientation changes and `visibilitychange`: pause audio and the game loop when the tab is hidden.
- Start audio only after the first user gesture, because mobile browsers require that.

## Test hooks
- When `import.meta.env.DEV` is true or `VITE_E2E=1`, expose `window.__GAME__` (the `Phaser.Game` instance) and `window.__E2E__` helpers. Helpers include `currentScene()`, `playerTile()` and `startBattle(seed)`.
- Playwright tests must read state through these hooks. They must not rely on pixel-guessing. Screenshots are for visual review, not for assertions, unless a test is explicitly a visual snapshot.
- Headless Chromium uses software WebGL (SwiftShader, already set in `playwright.config.ts`). A black canvas usually means a WebGL init failure, so check the console first.

## Working style
- After any gameplay change, run `npx vitest run`. Before finishing a task, run `npx playwright test`.
- When changing visuals, take a screenshot with Playwright (desktop + `iphone` projects) and look at it before calling the task done.
- Keep commits small and focused. Do not add dependencies without saying why.
