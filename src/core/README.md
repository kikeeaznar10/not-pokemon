# src/core — infrastructure (no game rules here)

| File | What it is |
| --- | --- |
| `log.ts` | `log` / `warn` / `error`: the only place allowed to use `console` (silent in production builds). |
| `rng.ts` | Seedable random generator (`int`, `float`, `chance`, `pick`, `weighted`, `id`). |
| `events.ts` | Typed event bus (`data:loaded`, `data:error`, `game:ready`, `zone:entered`, `player:moved`, `debug:menu`, `debug:teleport`, `debug:battle`, `battle:ended`). |
| `input.ts` | The Input service (M3): `isDown` / `justPressed` / `direction()` for `up/down/left/right/a/b/start/map` (+ `debug` = F2). Keyboard via `bindKeyboard(window)` in `main.ts`; touch (M12) calls `press/release`. `beginFrame()` runs on Phaser's `prestep`. |

| `debug-flags.ts` | Page-session debug switches (M7): `debugFlags.encounters` (wild encounters on/off), set by the F2 menu and the E2E hooks. |
| `session.ts` | The live game state (M6): `gameState()` (a new game from `start.json` on first use, via `src/logic/new-game.ts`), `setGameState()`, `resetGameState()`. The battle writes the team and bag back here. M10 loads/saves it. |

Planned: save store (M10).
