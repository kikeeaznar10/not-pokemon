# assets/ui — boxes, buttons, cursor, fonts, title image and minimaps.

- `title.png` (M11): the title screen picture, 512 × 288 (the whole screen), named in `data/intro.json ›
  titleImage`. The placeholder (a pixel office front) is drawn by `npm run placeholders`; replace the file with
  the real art at the same path.
- `minimap_<zone>.png` (M12): one per **outdoor** zone (`zones.json › indoor: false`; indoor zones have none). The
  placeholder tool draws it from the map's collision data, 3 px per tile (`MINIMAP_TILE_PX`): solid dark blue,
  encounter tiles green, the rest sand. Real art may have any size and aspect ratio of the map: the game shrinks it
  to fit 128 × 96 base pixels and places the player's dot by tiles, not image pixels. The tool never overwrites:
  after changing a map, delete its minimap and run `npm run placeholders` again.
