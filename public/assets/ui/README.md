# assets/ui — title image and minimaps

- `title.png`: the title screen picture, 512 × 288 (the whole screen), named in `data/intro.json › titleImage`. Drawn
  by `npm run art` (the office between pines, built from the world tiles, sky on top for the logo).
- `minimap_<zone>.png`: one per **outdoor** zone. `npm run placeholders` draws it from the map's collision data, 3 px
  per tile (solid dark blue, encounter tiles green, the rest sand). Real art may have any size: the game shrinks it to
  fit 128 × 96 base pixels and places the player's dot by tiles. Never overwritten: after changing a map, delete its
  minimap and run `npm run placeholders` again.
