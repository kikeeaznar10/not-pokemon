# maps — one Tiled map (`.tmj`) per zone

The real world's maps are **generated** from the text layouts in `tools/world/` by `npm run world -- --force`; edit
those, not these files (or the next regeneration overwrites your change). How to edit and expand the world, the map
format, warps, encounter areas, the tileset ids and the current layout: [docs/MAPS.md](../../docs/MAPS.md).

`test/` holds the frozen test world's maps (see `test/README.md` and `docs/TESTING.md`).
