# data — game content JSON

The nine files from docs/PLAN.md › Config specification, plus `intro.json` (M11, the title image and the
new-game intro script). Validated at boot by the zod schemas in
`src/data/schemas/` (one per file) plus cross-reference checks; any error shows the red ErrorScene as
`file › JSON path › message`. After adding asset paths, run `npm run placeholders`.

Validation rules beyond the plan's examples (all from the plan's rules unless marked *M1 decision*):

- Every object is strict: unknown keys are errors (*M1 decision*, catches typos).
- Ids are `snake_case`; ids are unique inside each file (*M1 decision*).
- Visible texts and dialogue lines must not be empty; dialogue lists need at least one line.
- Image paths match `assets/….png`; sound paths match `assets/….ogg` (or `.mp3`) and both an `.ogg`
  and an `.mp3` with the same name are loaded; zone `file` matches `maps/….tmj`.
- `flexymon.json`: stats whole 1–999, 1–3 attacks.
- `attacks.json`: accuracy 1–100; damage power 1–200; heal percent 1–100; buff/debuff stat
  attack|defense|speed, percent 1–100, turns 1–9; heal/buff target `self`, damage/debuff target `enemy`.
- `items.json`: `price` whole 0–999 999 or `null`; `usableIn` ⊂ {battle, field}, no duplicates; effects
  heal (`amount` 1–999), heal_full, revive (`percent` 1–100), buff, team_slot, key, catch. A shop may only list
  items whose price is not null (*M1 decision*: `null` means it cannot be bought).
- `npcs.json`: per-type fields (enemy: `sight` 1–16, `team` 1–6, `reward {min ≤ max}`, `defeatDialogue`;
  shopkeeper: `shop`); `wander.stepEveryMs` is `[min, max]` with min ≤ max; spawn inside the wander rectangle.
- `zones.json`: `encounters` is required (use `{}` for none); rate 1–100; weights whole ≥ 1.
- `start.json`: euros 0–999 999, `teamSlots` 1–6, item counts 1–99, spawn/respawn `{ map, x, y, facing }`.
- `secret-names.json`: names may not collide after normalising (case, accents, spaces; ñ is kept).
- `car.json`: at least one pair of two item ids. M13 added `sprite` (PNG: the Audi seen from the side, nose to the
  right, drawn by the trip scene; placeholder 96 × 40) and `sound` (the engine, looped during the trip). The cars
  themselves are drawn on the maps (see `public/maps/README.md`, warp property `car`).
- `intro.json` (M11): `titleImage` (PNG, 512 × 288), `jingle` (sound played at the handover), `coworker`
  `{ name, sprite, voice, x, y, facing }` (stands on the `start.json › spawn` map; exists only in the intro) and
  `steps`, run in order, the player starting on `start.json › spawn`:
  `{ "type": "fade_in", "ms" }`, `{ "type": "wait", "ms" }` (ms 0–10 000),
  `{ "type": "walk", "actor": "player" | "coworker", "path": ["up", …] }` (one tile per direction),
  `{ "type": "face", "actor", "facing" }`, `{ "type": "say", "lines": [...] }` (the coworker speaks; `{name}` = the
  player's name, `{starter}` = the starter's name) and exactly one `{ "type": "handover" }` (jingle + "¡Recibes a
  {starter}!", then the secret name's items and message). Boot checks: the coworker's tile and every tile walked
  onto are walkable, and no walk enters the other actor's tile. Control starts where the script leaves the player
  (the shipped script: two tiles up from the spawn, (15, 8) on `test`); walk the coworker out of view at the end.

Current content (M14, the real world): 12 flexymon, 24 attacks, 8 items, 25 NPCs (15 enemies, 6 shopkeepers, the
office healer and storage, 2 client talkers), 18 zones (8 outdoor: `alboraya`, `huerta_norte`, `valencia`, `playa`,
`pueblo_sur` on the Valencia side; `murcia`, `vinedos`, `poligono` on the Murcia side — plus 10 interiors), 6 shops
(one per town and one per bar). Map layouts and landmarks: `public/maps/README.md`. Every zone must have a loadable
map and every map point (NPC spawns, start spawn/respawn, car endpoints, warp targets) must be a walkable tile.

M14 decisions (also in docs/PROGRESS.md):

- **Audi items:** a new game starts with `llaves_audi` (`start.json › items`); `cafe_doble` is sold at Bar Las Rusas
  (300 €) and `carnet` at the south town's shop (600 €). Both stay key items (never sold back, never consumed); they
  now have a price so a shop can list them. `car.json › unlockPairs` is unchanged.
- **Music:** one loop per region, `assets/audio/music/valencia.ogg` and `murcia.ogg`; every interior plays
  `interior.ogg`.
- **Balance:** Valencia species total 60–100 stats, the Murcia species (`servidor`, `router`, `proyector`) 100–140
  (docs/PLAN.md › Content guide); enemy teams and rewards grow from Alboraya (60–100 €) to the Murcia side
  (250–420 €).

## The frozen test world (`public/test-world/data/`)

The content of M0–M13 (3 flexymon, the test maps `public/maps/test/*.tmj`…) is kept, unchanged, as a second content
set for tests and debugging. Dev and E2E builds load it instead of this folder with `?world=test` or
`localStorage['flexymon.e2e.world'] = 'test'` (`src/data/world.ts`); production builds always load `public/data/`.
The unit tests in `tests/logic/` and most of `tests/data/` and the browser specs written before M14 use it, so its
numbers must not change. Do not add real content there.
