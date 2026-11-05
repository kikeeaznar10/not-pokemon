# data — game content JSON

The nine files from docs/PLAN.md › Config specification. Validated at boot by the zod schemas in
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
- `car.json`: at least one pair of two item ids.

Current content (minimal): 3 flexymon, 6 attacks, 6 items, 5 NPCs (M9 added the office healer
`recepcionista_oficina`, the storage NPC `informatico_caja` and the shopkeeper `tendero_alboraya`, all in `test_house`), 3 zones (`test`, `test_house`, `test_east`;
the M4 test maps), 1 shop. Since M4 every zone must have a loadable map and every map point (NPC spawns, start
spawn/respawn, car endpoints, warp targets) must be a walkable tile; the real zones (`valencia`…) come in M14.
