# src/data — content loading and validation

| File | What it does |
| --- | --- |
| `schemas/` | One zod schema per content file (`flexymon.ts`, `attacks.ts`, …) plus shared pieces in `common.ts`. `schemas/index.ts` maps each file name to its schema (`FILE_SCHEMAS`, `DATA_FILES`). All objects are **strict**: an unknown or misspelled field is an error. |
| `loader.ts` | `loadGameData(baseUrl, fetcher?, { mapsBaseUrl? })` fetches every content file (`DATA_FILES`: the nine plus `intro.json`, M11), parses JSON, runs `validateGameData()` (schemas, then cross-references), then with `mapsBaseUrl` `loadMaps()` (fetch + parse every zone's `.tmj`, then `checkMaps`) and returns `{ ok: true, data }` (with `data.maps`) or `{ ok: false, errors }`. Never throws. A broken map reports `maps/x.tmj › (root) › …`. |
| `cross-refs.ts` | `checkCrossRefs()`: every referenced id exists (attacks in flexymon; flexymon in NPC teams, start and encounters; items in shops, start, secret names and car; shops in shopkeepers; maps in NPCs, start, car), ids are unique per file, shops only sell items with a price, no two secret names normalise to the same name. Only runs when every schema passed. Map-dependent checks live in `map-checks.ts`. |
| `game-data.ts` | `GameData`: deeply frozen content with lookup maps (`data.flexymon.get('portatil')`). `setGameData` / `getGameData` / `hasGameData` hold the loaded instance. |
| `errors.ts` | `DataError { file, path, message }` and `formatDataError()` → `npcs.json › [3].team[0] › unknown flexymon "teclado"`. A file that cannot be fetched or parsed reports path `(root)`. |
| `tiled.ts` | `parseTiledMap(json, file)` → `MapInfo` (size, solid / encounter cells, spawn points, warps, encounter rectangles (M7), tileset image paths); `isBlocked`, `isWalkable`, `findSpawn`. Map rules: `public/maps/README.md`. |
| `map-checks.ts` | `checkMaps()` (M4): NPC spawns, start spawn/respawn, car endpoints and map spawn points are walkable; every warp targets an existing zone and only walkable tiles; every encounter rectangle's `group` exists in its zone's `encounters` (M7); the intro's coworker tile and every tile the script walks onto are walkable, and no walk enters the other actor's tile (M11). `mapWarnings()` (M7): groups in zones.json that no rectangle uses (warnings, logged by Boot; `LoadResult.warnings`). |
| `assets.ts` | `collectAssets(data)`: every image and sound path in the data, for Preload (M11: the title image, the intro coworker's sprite and voice, the jingle). |

Boot flow: `BootScene` → `loadGameData('./' + dataDir())` (`./data/`, or the test world, see below) → success: `setGameData`, launch `PreloadScene` (loads every
asset with its JSON path as the Phaser key; sounds try `.ogg` then `.mp3`) → failure: `ErrorScene` (red, one line
per error, scroll with arrows / wheel / drag).

Messages are in English on purpose: they are developer diagnostics, not game text.

`world.ts` (M14): which content folder Boot loads — `data/` (the real world), or in dev / E2E builds the frozen
  test world `test-world/data/` with `?world=test` or `localStorage['flexymon.e2e.world'] = 'test'`
  (`chooseDataDir`, `dataDir`).
