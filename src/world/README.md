# src/world — overworld objects (presentation only; rules live in src/logic/)

| File | What it is |
| --- | --- |
| `music.ts` | `MusicPlayer` (M4): zone music; same file keeps playing, a different one crossfades over `MUSIC_FADE_MS`. Driven by the game loop in `main.ts` (`zone:entered` → `play`). M10: `setGain` (the music volume option, 0–1) scales every track at once. |
| `camera.ts` | `cameraBounds` (M4): map bounds, or a screen-sized range centred on maps smaller than the screen. |
| `zone-map.ts` | `drawZoneMap(scene, zone)` (M11, moved out of the Overworld): builds a zone's tilemap (layers `ground` 0, `deco` 1, `above` 3; `collision` hidden), sets the camera's black background and bounds, returns the map's `MapInfo`. Used by the Overworld and the Intro. |
| `player.ts` | `Player`: the player sprite, driven by `src/logic/movement.ts` (grid steps, tap-to-turn); `halt` (M7), `face` (M8: turn to an enemy that walked up). Sheet `assets/sprites/player.png`: 32 × 32 frames, columns stand/stride, rows down/left/right/up. |

| `npc.ts` | `NpcActor` (M5): one NPC from `npcs.json` on the current map, driven by `src/logic/npc-wander.ts`; `npcsOnMap`. A 64 × 128 sprite is used as a sheet (player layout: columns stand/stride, rows down/left/right/up); any other size is drawn as one still image. M8: the "!" bubble (`showAlert`, text `npc.alert`), `engage` / `stepTo` / `face` for an enemy walking up to the player. M11: the Intro draws its coworker with it (`engage` + `stepTo`). |

Planned: encounter zones (M7). Warp rules are pure and live in `src/logic/warp.ts`. Map reading (solid cells, spawn points) is
pure and lives in `src/data/tiled.ts`.
