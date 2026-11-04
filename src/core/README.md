# src/core — infrastructure (no game rules here)

| File | What it is |
| --- | --- |
| `log.ts` | `log` / `warn` / `error`: the only place allowed to use `console` (silent in production builds). |
| `rng.ts` | Seedable random generator (`int`, `float`, `chance`, `pick`, `weighted`, `id`). |
| `events.ts` | Typed event bus (`data:loaded`, `data:error`, `game:ready`, `zone:entered`, `player:moved`). |
| `input.ts` | The Input service (M3): `isDown` / `justPressed` / `direction()` for `up/down/left/right/a/b/start/map` (+ `debug` = F2). Keyboard via `bindKeyboard(window)` in `main.ts`; touch (M12) calls `press/release`. `beginFrame()` runs on Phaser's `prestep`. |

Planned: save store (M10).
