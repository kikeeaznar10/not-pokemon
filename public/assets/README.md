# assets — art and sound

Most images are drawn by code (`tools/art/`): the world tileset by `npm run world`, the sprites and the title by
`npm run art`. `npm run placeholders` fills any other missing path (sounds, minimaps). Replace any file with real art
at the same path and size. Sizes, style guide and pipeline: [docs/ART.md](../../docs/ART.md).

`buildings/<id>.png` (optional, created when you add one) are building skins, one picture per building, listed in
`public/data/zones.json › buildings` ([docs/MAPS.md](../../docs/MAPS.md) › Building skins).
