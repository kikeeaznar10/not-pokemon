# tools — developer scripts run with tsx (not shipped in the game)

## `npm run placeholders` (`make-placeholders.ts`)

Scans every JSON file in `public/data/` for asset paths (`assets/….png|ogg|mp3`, relative to `public/`) and
creates any missing file. **Never overwrites** an existing file, so a second run creates nothing and real art
dropped at the same path is kept. `--dry-run` (`npm run placeholders -- --dry-run`) only lists what is missing.

- PNG: solid colour square (colour from the file name) with the file name in a pixel font.
  `*_front` / `*_back` → 64×64, `*_icon` and anything in `sprites/items/` → 16×16, everything else → 32×32.
  Exception (M11): `assets/ui/title.png` (the title image named in `intro.json`) is a 512×288 pixel office front
  (sky, building with windows and a door, path, grass) so the title screen has a picture until real art exists.
- Audio: an `.ogg` or `.mp3` path creates both `<name>.ogg` and `<name>.mp3`, a 0.2 s 880 Hz beep made with
  `ffmpeg` (libvorbis / libmp3lame). If `ffmpeg` is not on the PATH, it copies the silent files in
  `tools/fallback/` instead and says how many audio files are silent.
- Minimaps (M12): every outdoor zone in `zones.json` gets `assets/ui/minimap_<zone>.png`, drawn from its `.tmj`
  (`parseTiledMap` → `minimapCells`): 3 px per tile (`MINIMAP_TILE_PX`), solid tiles dark blue, `encounter` tiles
  green, the rest sand. These paths are not in the JSON (they follow the zone id), so `--dry-run` lists them too.
  Not overwritten either: delete a minimap after editing its map to redraw it.

## `npm run test-map` (`make-test-map.ts`)

Writes the test maps and the art they need (no one can draw in Tiled in a cloud session):
`public/maps/test.tmj`, `test_house.tmj` and `test_east.tmj` (layouts, warps and, from M7, tall grass and encounter rectangles in `public/maps/README.md`), the
placeholder tileset `public/assets/tilesets/test.png`
(8 × 2 tiles of 32 px, with `solid` / `encounter` tile properties) and the placeholder player sheet
`public/assets/sprites/player.png` (2 columns stand/stride × 4 rows down/left/right/up, 32 × 32 frames).
Never overwrites existing files (so maps edited in Tiled are safe); `npm run test-map -- --force` regenerates all
all five files. A unit test checks that the shipped maps still equal the generator's output — after editing a map
in Tiled, update the generator too or drop that comparison.
