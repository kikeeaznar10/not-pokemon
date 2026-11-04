# src/world — overworld objects (presentation only; rules live in src/logic/)

| File | What it is |
| --- | --- |
| `player.ts` | `Player`: the player sprite, driven by `src/logic/movement.ts` (grid steps, tap-to-turn). Sheet `assets/sprites/player.png`: 32 × 32 frames, columns stand/stride, rows down/left/right/up. |

Planned: `npc.ts` (M5), map loading / warps (M4), encounter zones (M7). Map reading (solid cells, spawn points) is
pure and lives in `src/data/tiled.ts`.
