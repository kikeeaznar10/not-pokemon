# src/scenes — Phaser scenes (presentation and input only; rules live in src/logic/)

| Scene (key) | File | What it does |
| --- | --- | --- |
| `Boot` | `boot-scene.ts` | Loads and validates the content JSON; then Preload, or Error. |
| `Preload` | `preload-scene.ts` | Loads every asset in the data, every map tileset image and the player sheet; shows "Flexymon" + "Pulsa START". Start / A / tap → Overworld at `start.json › spawn` (Title replaces this in M11). Launches Debug when enabled. |
| `Error` | `error-scene.ts` | Red list of content/map errors; scroll with up/down (Input service), wheel or drag. |
| `Overworld` | `overworld-scene.ts` | Draws a zone's map (loaded at boot) and moves the player on the grid; camera follows, clamped (interiors centred on black). Warps: lock, fade out 200 ms, restart on the target, fade in, unlock. Start with `{ map, x?, y?, facing?, fadeIn? }`. Emits `zone:entered`, `player:moved`; listens to `debug:teleport`, `debug:menu`. NPCs (M5): spawns the zone's NPCs, which wander and block; A facing an NPC → it turns to the player and its lines show in the DialogBox, the player frozen until the last box. Owns one DialogBox and one ChoiceBox. |
| `Debug` | `debug-scene.ts` | Dev-only overlay (dev builds or `?debug=1`). F2 cycles hidden → info (map, tile, FPS) → teleport menu (up/down, A = go to the zone's `default` spawn, B = close) → hidden. Last in the scene list so it draws on top. |

Scenes read controls only through `src/core/input.ts` (Phaser's keyboard plugin is turned off in `src/config/game.ts`).
