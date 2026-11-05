# Maps: editing and expanding the world

The world is a set of **zones**. Each zone is one map file `public/maps/<zone>.tmj` (Tiled JSON, 32 × 32 px tiles)
plus one entry in `public/data/zones.json`. Zones are joined by **warps**: doors, map edges and the Audi.

## Two ways to edit maps

| | Text layouts (recommended) | Tiled |
| --- | --- | --- |
| Source | `tools/world/<zone>.txt` + `tools/world/world.json` | `public/maps/<zone>.tmj` |
| Tool | any text editor, then `npm run world -- --force` | the [Tiled](https://www.mapeditor.org/) desktop app |
| Doors, edges, way back | generated for you | drawn by hand, both directions |
| Tile variants (roof edges, shores…) | picked automatically | placed by hand |
| Diff-friendly / reviewable | yes | large JSON diffs |

The shipped world is built from the text layouts. `npm run world -- --force` **regenerates every map and the
tileset**, so a map edited in Tiled is overwritten the next time someone runs it. Pick one source per map: if you
switch a map to Tiled for good, say so in its PR and stop regenerating it (or remove it from `world.json`).

Either way, after changing an outdoor map delete its minimap (`public/assets/ui/minimap_<zone>.png`) and run
`npm run placeholders` to redraw it, then `npm run dev` and fix anything the red error screen reports.

## The current world

Mountains close the north, the west and the south; the sea is on the east. An impassable range splits the map:
the Valencia side above it, the Murcia side below it, joined only by the Audi (a unit test walks the whole world and
checks that). Zones and landmarks (coordinates are tiles):

| Zone | Size | Links | Contains |
| --- | --- | --- | --- |
| `alboraya` (village) | 32 × 24 | south x 14–16 → `huerta_norte` | The office where the game starts (door (7, 8) → `oficina`), two bars (16, 7) → `bar_centro` and (24, 7) → `bar_este`, shop (21, 17) → `tienda_alboraya`, the office Audi on (9–10, 10), tall grass `campo_alboraya`, enemy `becario_alboraya`. Spawn (7, 9). |
| `huerta_norte` (fields) | 32 × 24 | north → `alboraya`, south x 14–16 → `valencia` | Three tall-grass fields (`huerta`), irrigation channels with bridges, a barraca; two enemies. |
| `valencia` (city) | 48 × 36 | north → `huerta_norte`, south x 14–16 → `pueblo_sur`, east y 16–18 → `playa` | Turia river park (tall grass `jardin_turia`, rows 8–13), Torres de Serranos and Mercado, shop (37, 5) → `tienda_valencia`, Plaza del Ayuntamiento (crowd `plaza_ayuntamiento`), Plaza de la Virgen (crowd `plaza_virgen`), the CAC / Àgora (door (39, 27) → `agora`) and its esplanade (crowd `explanada_cac`); 4 enemies. |
| `playa` (beach) | 20 × 36 | west y 16–18 → `valencia` | Sand, dunes (`dunas`), the sea; two enemies. |
| `pueblo_sur` (south town) | 32 × 24 | north → `valencia` | a client company (door (7, 8) → `empresa_sur`), shop (21, 8) → `tienda_sur`, tall grass `campos_sur`, the range from row 18 down; one enemy. |
| `murcia` (desert town) | 32 × 24 | east y 10–12 → `vinedos`, south x 14–16 → `poligono` | The arrival Audi on (14–15, 5), shop (6, 6) → `tienda_murcia`, houses, cacti, dunes (`desierto`); one enemy. |
| `vinedos` (vineyards) | 32 × 24 | west → `murcia` | Vineyard rows (`vinas`), a bodega; one enemy. |
| `poligono` (industrial estate) | 32 × 24 | north → `murcia` | Warehouses, a client company (door (7, 18) → `empresa_poligono`), loading yard (crowd `muelle_carga`); one enemy. |

Interiors (smaller than the screen, centred on black): `oficina` 14 × 13 (desks; the new game starts on its
doormat (7, 12); healer at (5, 9), storage at (11, 8)), `bar_centro` and `bar_este` 10 × 8 (counter and shopkeeper), the four shops 8 × 7
(shopkeeper at (5, 3)), `agora` 16 × 10 (two enemies), `empresa_sur` and `empresa_poligono` 10 × 8 (a client who talks).

## Editing with text layouts

### Layout files (`tools/world/<zone>.txt`)

One character per tile, one line per row, all rows the same width. For example `tools/world/oficina.txt`:

```
##############
##############
#H==========H#
#=KK=KK==KK==#
#============#
...
#CCCC======HH#
#============#
#######_######
```

Ground characters:

| Char | Tile | | Char | Tile |
| --- | --- | --- | --- | --- |
| `.` | grass | | `d` | desert ground |
| `:` | path | | `r` | road |
| `~` | water (solid) | | `p` | plaza paving |
| `,` | tall grass (encounter) | | `b` | bridge |
| `s` | sand | | `=` | wooden floor |
| `S` | dune grass (encounter) | | `_` | doormat (an interior's exit, on its bottom row) |
| `v` | vineyard (encounter) | | | |

Objects, drawn over the map's base ground (`world.json › ground`). All of them block, except `f` and `D`:

| Char | Object | | Char | Object |
| --- | --- | --- | --- | --- |
| `T` | tree (its crown is drawn on the tile above, over the player) | | `*` | bush |
| `#` | wall | | `F` | fence |
| `^` | roof | | `f` | flowers (walkable) |
| `W` | white wall (emblematic buildings) | | `c` | cactus |
| `D` | door (walkable; needs a `doors` entry) | | `L` | fountain |
| `M` | mountain | | `C` | counter |
| `R` | rock | | `K` | desk |
| `A` `a` | the Audi (rear, front; needs a `car` entry) | | `H` | shelf |

The tool picks the right look-alike **variant** of each tile from its neighbours (roof ridges and eaves, one of four
roof colours per building, facade windows, cliff faces, grass borders, shore foam…). Variants keep their base tile's
`solid` / `encounter` property, so only the picture changes.

### `tools/world/world.json`

`maps.<zone>` describes everything that is not a tile:

| Field | Meaning |
| --- | --- |
| `ground` | Base ground under the object characters: `grass`, `sand`, `desert`, `road` or `floor`. |
| `indoor` | `true` for interiors (needs a `_` doormat on the bottom row; the exit warp is generated). |
| `spawn` | `[x, y]` of the zone's `default` spawn point (debug teleport target). Interiors use the doormat. |
| `doors` | `[{ "x", "y", "to" }]`: a `D` tile at (x, y) leading to interior `to`. The way back is generated. |
| `edges` | `[{ "side", "from", "to", "map" }]`: walking off `side` (`north` / `south` / `east` / `west`) over columns (or rows) `from`–`to` enters `map`, keeping the column (or row). The reverse warp on `map` is generated. |
| `car` | `{ "x", "y", "to" }`: the Audi (`Aa` at (x, y)) with an action warp; `to` is `murcia` or `valencia`. |
| `encounters` | `[{ "name", "x", "y", "width", "height", "group", "mode" }]`: encounter rectangles (see below). |

Example (Alboraya):

```json
"alboraya": {
  "ground": "grass",
  "spawn": [7, 9],
  "doors": [{ "x": 7, "y": 8, "to": "oficina" }, { "x": 21, "y": 17, "to": "tienda_alboraya" }],
  "edges": [{ "side": "south", "from": 14, "to": 16, "map": "huerta_norte" }],
  "car": { "x": 9, "y": 10, "to": "murcia" },
  "encounters": [{ "name": "campo", "x": 3, "y": 15, "width": 8, "height": 6, "group": "campo_alboraya", "mode": "tiles" }]
}
```

Then run:

```bash
npm run world -- --force
```

It checks the layouts (equal row widths, known characters, doors on `D`, cars on `Aa`) and writes
`public/assets/tilesets/world.png` and every `public/maps/<zone>.tmj` listed in `world.json`. Without `--force` it
writes only missing files.

### Recipe: change an existing map

1. Edit `tools/world/<zone>.txt` (keep every row the same width).
2. If you moved a door, edge, car or encounter area, update `world.json`.
3. If anything that stood on a tile now blocked is in the content (an NPC spawn, `start.json`, `car.json` arrival
   points, the intro), move it in the JSON.
4. `npm run world -- --force`, delete `public/assets/ui/minimap_<zone>.png`, `npm run placeholders`.
5. `npm run dev`, walk it, then run the tests (`npm test` includes a full walkability check of the real world).

### Recipe: add an outdoor zone

1. Create `tools/world/<zone>.txt`, surrounded by blocking tiles (trees, mountains, water) except where it connects.
2. Add `maps.<zone>` to `world.json` with `ground`, `spawn`, and an `edges` entry joining it to a neighbour (the
   neighbour gets the reverse warp automatically; leave a walkable gap on both maps along that edge).
3. Add the zone to `public/data/zones.json`:

   ```json
   { "id": "huerta_sur", "name": "Huerta Sur", "file": "maps/huerta_sur.tmj", "region": "valencia",
     "music": "assets/audio/music/valencia.ogg", "indoor": false, "encounters": {} }
   ```

   `region` says which side of the range it is on (`valencia` or `murcia`); the game itself does not read it, the
   world test does. `name` is a readable name (not shown in the game yet).
4. `npm run world -- --force` and `npm run placeholders` (draws the new minimap).
5. Add NPCs (`npcs.json › map`), encounter groups and areas (below).
6. Add the zone id to the zone lists at the top of `tests/data/world.test.ts` (`VALENCIA_SIDE`, `MURCIA_SIDE` or
   `INTERIORS`): that test pins the set of shipped zones and walks the world to prove every zone is reachable.

### Recipe: add a building with an interior

1. On the outdoor layout, draw the building with `^` roof and `#` (or `W`) walls, and a `D` where the door goes.
2. Create the interior layout `tools/world/<interior>.txt`: walls `#` around, floor `=`, furniture (`C` counter,
   `K` desk, `H` shelf), and exactly one `_` doormat on the bottom row.
3. In `world.json`: add `{ "x", "y", "to": "<interior>" }` to the outdoor map's `doors` and
   `"<interior>": { "ground": "floor", "indoor": true }` to `maps`.
4. Add the interior to `zones.json` with `"indoor": true`, `"music": "assets/audio/music/interior.ogg"` and
   `"encounters": {}`.
5. `npm run world -- --force`. Entering the door puts the player on the doormat facing up; stepping down off the
   doormat puts them below the door facing down.
6. Add NPCs inside (e.g. a `shopkeeper` behind the counter, with a new shop in `shops.json`). Add the interior to
   `INTERIORS` in `tests/data/world.test.ts`.

## Encounter areas

Wild battles happen only inside encounter rectangles. Each rectangle has:

- `group`: a key of the zone's `encounters` in `zones.json` (which species, how often; see
  [CONTENT.md](CONTENT.md) › Wild encounters);
- `mode`: `tiles` (only encounter tiles roll: tall grass `,`, dune grass `S`, vineyard `v`) or `all` (every tile
  rolls, for city crowds on paving).

Draw the grass in the layout, add the rectangle to `world.json › maps.<zone>.encounters`, add the group to
`zones.json`, and regenerate. Overlapping rectangles: the first one containing the tile wins.

## Placing NPCs and points

NPCs, the start and respawn points, the car arrival points and the intro are placed in the JSON by tile
coordinates, not in the map. Find a tile with **F2** in the game (`Casilla: x, y`) or by counting characters in the
layout (column = x, line = y, both from 0). Every such point must be walkable; NPC wander rectangles must contain the
spawn. See [CONTENT.md](CONTENT.md) › Add an NPC.

## The Audi

A car is two solid tiles (`A` rear, `a` front) with an `action` warp (press A facing it) carrying the property
`car` = `murcia` (the office car) or `valencia` (the car in Murcia). Its arrival points are not on the map but in
`car.json › toMurcia` / `toValencia`: put each next to the *other* car. In the text layouts, draw `Aa` and add
`"car": { "x", "y", "to" }` to `world.json`.

## Editing in Tiled

Open `public/maps/<zone>.tmj` in Tiled. The format the game reads (`src/data/tiled.ts`):

- Orthogonal, 32 × 32 px tiles, **tile layer format CSV**, tilesets **embedded** in the map. Tileset image paths are
  relative to the map (`../assets/tilesets/world.png`).
- Tile layers: `ground`, `deco`, `above` (drawn over the player: tree crowns, roof edges) and `collision` (never
  drawn). A cell blocks if **any** tile layer has a tile with the tileset property `solid = true`; the map edge also
  blocks. Tiles with `encounter = true` are encounter tiles.
- Object layer `spawns`: point objects; the one named `default` is the zone's spawn point. Its tile is
  `floor(x / 32), floor(y / 32)`.
- Object layer `warps`: rectangles with properties `toMap` (zone id), `toX` / `toY` (ints; leave one out to keep the
  player's column or row, as edge warps do), `toFacing` (optional) and `trigger` (`step`: fires when a step ends
  inside it, for doors and edges; `action`: press A facing it). A step warp may sit one tile outside the map: those
  off-map tiles become walkable, so walking off the edge enters it. Every door needs a matching warp back on the
  other map. A car warp has the string property `car` and `trigger = action`, and no `toMap` / `toX` / `toY`.
- Object layer `encounters`: rectangles with string properties `group` and `mode`.

Boot checks (any error stops on the red screen): every warp targets an existing zone and only walkable tiles; every
encounter `group` exists in that zone's `zones.json` entry; every spawn and content point is walkable. A group in
`zones.json` that no rectangle uses is a warning.

To make a brand-new map in Tiled: create it with the settings above, add the tileset `world.png` (or copy the
tileset from an existing map so the tile properties come along), save it as `public/maps/<zone>.tmj`, then add the
zone to `zones.json`. Don't add it to `tools/world/world.json`, or `npm run world -- --force` will overwrite it.

## The world tileset

`public/assets/tilesets/world.png`: 8 columns of 32 px tiles, drawn by `npm run world` from `tools/art/tiles.ts`.
Ids 0–31 are the base tiles; ids 32 and up are look-alike variants with their base tile's properties (order:
`tools/art/tiles.ts › VARIANT_TILES`).

| Id | Tile | | Id | Tile |
| --- | --- | --- | --- | --- |
| 0 | grass | | 16 | mountain (solid) |
| 1 | path | | 17 | vineyard (encounter) |
| 2 | wall (solid) | | 18 | road |
| 3 | water (solid) | | 19 | plaza paving |
| 4 | tree trunk | | 20 | roof (solid) |
| 5 | tree crown | | 21 | counter (solid) |
| 6 | flowers | | 22 | desk (solid) |
| 7 | tall grass (encounter) | | 23 | cactus (solid) |
| 8 | collision marker (solid, hidden layer) | | 24 | fence (solid) |
| 9 | door | | 25 | bridge |
| 10 | wooden floor | | 26 | desert ground |
| 11 | doormat | | 27 | shelf (solid) |
| 12–13 | the Audi from above, rear / front (solid) | | 28 | rock (solid) |
| 14 | sand | | 29 | bush (solid) |
| 15 | dune grass (encounter) | | 30 | fountain (solid) |
| | | | 31 | white wall (solid) |

Changing how tiles look: [ART.md](ART.md).

## Minimaps

Every outdoor zone has `public/assets/ui/minimap_<zone>.png`, drawn by `npm run placeholders` from the map's
collision data (3 px per tile: solid dark blue, encounter tiles green, the rest sand). It is never overwritten:
delete it after editing the map. Real art may replace it at any size; the game shrinks it to fit 128 × 96 base pixels
and places the player's dot by tiles. Indoor zones have no minimap.
