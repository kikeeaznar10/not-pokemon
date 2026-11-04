# src/scenes — Phaser scenes (presentation and input only; rules live in src/logic/)

| Scene (key) | File | What it does |
| --- | --- | --- |
| `Boot` | `boot-scene.ts` | Loads and validates the content JSON; then Preload, or Error. |
| `Preload` | `preload-scene.ts` | Loads every asset in the data; shows "Flexymon" + "Pulsa START". Start / A / tap → Overworld at `start.json › spawn` (Title replaces this in M11). Launches Debug when enabled. |
| `Error` | `error-scene.ts` | Red list of content/map errors; scroll with up/down (Input service), wheel or drag. |
| `Overworld` | `overworld-scene.ts` | Draws a zone's Tiled map and moves the player on the grid; camera follows, clamped to the map. Start with `{ map, x?, y?, facing? }`. Emits `zone:entered`, `player:moved`. |
| `Debug` | `debug-scene.ts` | Dev-only overlay (dev builds or `?debug=1`), toggled with F2: map id, tile x/y, FPS. Last in the scene list so it draws on top. |

Scenes read controls only through `src/core/input.ts` (Phaser's keyboard plugin is turned off in `src/config/game.ts`).
