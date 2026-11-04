# src/world — overworld objects (presentation only; rules live in src/logic/)

| File | What it is |
| --- | --- |
| `music.ts` | `MusicPlayer` (M4): zone music; same file keeps playing, a different one crossfades over `MUSIC_FADE_MS`. Driven by the game loop in `main.ts` (`zone:entered` → `play`). |
| `camera.ts` | `cameraBounds` (M4): map bounds, or a screen-sized range centred on maps smaller than the screen. |
| `player.ts` | `Player`: the player sprite, driven by `src/logic/movement.ts` (grid steps, tap-to-turn). Sheet `assets/sprites/player.png`: 32 × 32 frames, columns stand/stride, rows down/left/right/up. |

Planned: `npc.ts` (M5), encounter zones (M7). Warp rules are pure and live in `src/logic/warp.ts`. Map reading (solid cells, spawn points) is
pure and lives in `src/data/tiled.ts`.
