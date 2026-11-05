# Flexymon — Content guide

How to add or change game content: flexymon, attacks, items, NPCs, shops, maps, sounds and the new-game intro.
This is the plan's *Content guide* (docs/PLAN.md), kept up to date with what the game really does (M15). Adding
content means editing JSON and maps only; no TypeScript change is needed.

**After any change:** run `npm run placeholders` (art and sound for any new path), then `npm run dev` and fix whatever
the red error screen reports (`file › JSON path › message`). With the dev server running, F2 twice opens the debug
menu; *Recargar datos* reloads every JSON and map without reloading the page (an error is shown and the old data
kept). Before sharing, run the checks in `CLAUDE.md` › Definition of done.

## Where things live

| What | Where | Details |
| --- | --- | --- |
| Content (11 files) | `public/data/*.json` | Rules per file: `public/data/README.md`; schemas: `src/data/schemas/` |
| Maps | `public/maps/<zone>.tmj` | Layers, properties, the world layout: `public/maps/README.md` |
| Map sources (cloud sessions) | `tools/world/<zone>.txt` + `world.json` | `npm run world`, legend in `tools/README.md` |
| Sprites | `public/assets/sprites/…` (PNG) | Sizes below |
| Sounds | `public/assets/audio/sfx/…`, `…/music/…` | OGG + MP3 with the same name |
| Interface texts | `src/i18n/es.json` | Menu labels, battle messages… (content texts stay in the JSON) |
| Tunable rule numbers | `src/logic/constants.ts` | Damage scale, cooldown distance, text speeds, timings |

The content files are the plan's nine — `flexymon.json`, `attacks.json`, `items.json`, `npcs.json`, `zones.json`,
`shops.json`, `start.json`, `secret-names.json`, `car.json` — plus `intro.json` (M11: title image and new-game
intro) and `sounds.json` (M15: interface sounds). All visible content text is written in Spanish directly in them.

`public/test-world/data/` is a frozen copy of the M0–M13 content used by the tests (`?world=test` in dev builds).
**Do not add real content there**; its numbers must not change.

## Add a flexymon

1. Add its attacks to `attacks.json` first (new ids, or reuse existing ones). Effects: `damage` (`power` 1–200,
   target `enemy`), `heal` (`percent` of max HP, target `self`), `buff` / `debuff` (`stat` attack / defense / speed,
   `percent` 1–100, `turns` 1–9; buff on `self`, debuff on `enemy`). `accuracy` 1–100, and a `sound`.
2. Add an entry to `flexymon.json` with a new `snake_case` id, the Spanish name, `sprite` (`front`, `back`, `icon`),
   `cry`, the four `stats` (whole numbers 1–999) and 1–3 attack ids.
3. Run `npm run placeholders` for placeholder images and sounds, or drop real files at those paths: front / back
   64 × 64 PNG, icon 16 × 16 PNG, sounds as OGG + MP3 with the same name.
4. Make it appear: add `{ "id": "...", "weight": n }` to an encounter group in `zones.json`, or put it in an enemy
   NPC's `team`.
5. Balance: total stats 60–100 for the Valencia side, 100–140 for the Murcia side. `tests/data/world.test.ts` checks
   the content counts and the balance guide, so update it when the roster changes on purpose.

## Add an NPC

1. Find the tile: in Tiled, hover it and read x / y in the status bar; with `npm run dev`, stand on it and press F2
   (`Casilla: x, y`). The tile must be walkable (checked at boot).
2. Add an entry to `npcs.json`: `id`, `type`, `name`, `sprite` (32 × 32 PNG, or a 64 × 128 walk sheet like the
   player's to show facing), `voice` (a short sound played while it speaks), `map`, `spawn`, `facing`, `wander`
   (`null` to stand still, or a rectangle `{ x, y, width, height, stepEveryMs: [min, max] }` containing the spawn)
   and `dialogue` (a list of short strings, one text box each; long ones continue on more boxes).
3. Per type:
   - `talker`: nothing more.
   - `enemy`: `sight` (tiles, 1–16; the plan uses 4), `team` (1–6 flexymon ids), `reward` `{ min, max }` euros and
     `defeatDialogue` (said after you win, and when you talk to it before it is ready again).
   - `shopkeeper`: `shop` (a key of `shops.json`); the shop opens after its dialogue.
   - `healer`: heals the team and storage, then says its dialogue (the office has one).
   - `storage`: says its dialogue, then opens the storage box.

## Add an item

An entry in `items.json` (`id`, `name`, `description`, `sprite` 16 × 16 PNG, `price` whole euros or `null` = cannot
be bought or sold, `usableIn` ⊂ `["battle", "field"]`, `effect`), then list it in a shop (`shops.json`) or give it at
the start (`start.json › items`) or through a secret name. Effects: `heal` (`amount` HP), `heal_full`, `revive`
(`percent` of max HP), `buff` (as attacks, on the active flexymon), `team_slot` (+1 team slot, consumed, refused at
6), `key` (never consumed or sold; only checked, e.g. by the Audi), `catch` (reserved). Selling pays half the
price, rounded down.

## Shops, the start, secret names, the Audi

- `shops.json`: shop id → item ids it sells (only items with a price). One per town plus the two bars.
- `start.json`: starter, euros, team slots, starting items, `spawn` (new game) and `respawn` (after losing). Moving
  `spawn` means updating `intro.json` too (its walks are checked against the spawn's map).
- `secret-names.json`: `{ name, items, message }`; matching ignores case, accents and surrounding spaces. Keep real
  coworkers' names out of public repositories (open question in docs/PROGRESS.md).
- `car.json`: `unlockPairs` (owning both items of any pair opens the office Audi; items are not consumed),
  `lockedDialogue`, the trip `sprite` (side view, nose right) and engine `sound`, the arrival points `toMurcia` /
  `toValencia`. The cars on the maps are action warps with the property `car` (see `public/maps/README.md`).

## The new-game intro and the title (`intro.json`)

`titleImage` (512 × 288 PNG behind the title), `jingle` (the handover sound), `coworker` (name, sprite, voice, start
tile and facing — it only exists during the intro) and `steps`: `fade_in`, `wait`, `walk` (`player` or `coworker`,
one tile per direction), `face`, `say` (`{name}` = the player's name, `{starter}` = the starter's name) and exactly
one `handover`. Control starts where the script leaves the player; walk the coworker out of view at the end. Field
rules: `public/data/README.md`.

## Sounds and music

- Every sound path in the JSON is an OGG; an MP3 with the same name is the fallback (both are loaded by path).
- Zone music: `zones.json › music` per zone (one loop per region; interiors share `interior.ogg`). It crossfades
  when the next zone uses another file.
- Interface sounds (M15): `sounds.json` holds `cursor` (a menu cursor moved), `confirm` (an option chosen), `cancel`
  (B backed out), `error` (a refused action: greyed option, not enough money, the storage box refusing) and `money`
  (a purchase, a sale, an enemy's reward). Every key is required.
- Volumes are the player's options (Start › Opciones: Música, Efectos 0–10); every sound effect uses the effects
  volume. Audio starts only after the first key press, click or touch (browser rule).
- Placeholders: `npm run placeholders` makes a short beep per sound (distinct tones for the interface sounds, a hum
  for the car engine) when `ffmpeg` is installed, silent files otherwise.

## Maps

Tiled works as the plan describes (orthogonal, 32 × 32 tiles, CSV layers, tilesets embedded, saved as
`public/maps/<zone_id>.tmj`), with the layers `spawns`, `encounters`, `warps` (objects), `above`, `collision`,
`deco`, `ground` (tiles). Tile properties: `solid = true` blocks (on any layer), `encounter = true` makes tall grass,
sand and vineyard roll encounters. Encounter rectangles have `group` (a key of the zone's `encounters` in
`zones.json`) and `mode` (`tiles` or `all` for city crowds). Warps have `toMap`, `toX`, `toY`, `toFacing`, `trigger`
(`step` or `action`); every door needs a matching warp back. Then add the zone to `zones.json` (file, name, region,
music, `indoor`, encounter groups).

In a cloud session, where Tiled cannot be used, the real world is built from text: edit `tools/world/<zone>.txt`
(one character per tile) and `tools/world/world.json` (doors, edges, the Audi, metro / train links, encounter
rectangles, spawn), then
`npm run world -- --force`. Legend and fields: `tools/README.md` › `npm run world`; the current layout, landmarks and
tile ids: `public/maps/README.md`. After changing an outdoor map, delete its `assets/ui/minimap_<zone>.png` and run
`npm run placeholders` to redraw the minimap.

## Real art

Replace any placeholder by dropping a file with the same path and size; nothing else changes. Sizes: flexymon
front / back 64 × 64, icons and items 16 × 16, NPCs 32 × 32 (or a 64 × 128 walk sheet: 2 columns stand / stride × 4
rows down / left / right / up), the player sheet `assets/sprites/player.png` (same layout), the trip car (any size,
side view), the title 512 × 288, tilesets 32 px tiles, minimaps any size (they are scaled to fit). There is no pixel
font yet: texts use the browser's monospace font.

`npm run build` packs every sprite of the content up to 128 × 128 into one texture atlas
(`public/assets/atlas/`, made by `npm run atlas`, not committed) so phones download one image instead of ~70; the
game still uses each sprite by its own path. Nothing to do by hand: the atlas is rebuilt on every build.
