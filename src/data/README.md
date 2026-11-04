# src/data — content loading and validation

| File | What it does |
| --- | --- |
| `schemas/` | One zod schema per content file (`flexymon.ts`, `attacks.ts`, …) plus shared pieces in `common.ts`. `schemas/index.ts` maps each file name to its schema (`FILE_SCHEMAS`, `DATA_FILES`). All objects are **strict**: an unknown or misspelled field is an error. |
| `loader.ts` | `loadGameData(baseUrl)` fetches the nine files, parses JSON, runs `validateGameData()` (schemas, then cross-references) and returns `{ ok: true, data }` or `{ ok: false, errors }`. Never throws. |
| `cross-refs.ts` | `checkCrossRefs()`: every referenced id exists (attacks in flexymon; flexymon in NPC teams, start and encounters; items in shops, start, secret names and car; shops in shopkeepers; maps in NPCs, start, car), ids are unique per file, shops only sell items with a price, no two secret names normalise to the same name. Only runs when every schema passed. Map-dependent checks come in M4. |
| `game-data.ts` | `GameData`: deeply frozen content with lookup maps (`data.flexymon.get('portatil')`). `setGameData` / `getGameData` / `hasGameData` hold the loaded instance. |
| `errors.ts` | `DataError { file, path, message }` and `formatDataError()` → `npcs.json › [3].team[0] › unknown flexymon "teclado"`. A file that cannot be fetched or parsed reports path `(root)`. |
| `assets.ts` | `collectAssets(data)`: every image and sound path in the data, for Preload. |

Boot flow: `BootScene` → `loadGameData('./data/')` → success: `setGameData`, launch `PreloadScene` (loads every
asset with its JSON path as the Phaser key; sounds try `.ogg` then `.mp3`) → failure: `ErrorScene` (red, one line
per error, scroll with arrows / wheel / drag).

Messages are in English on purpose: they are developer diagnostics, not game text.
