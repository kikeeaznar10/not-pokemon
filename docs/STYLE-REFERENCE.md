# Art style reference (post-M15 restyle)

The user supplied four reference screenshots of handheld monster-collecting RPGs (Game Boy
Color / Game Boy Advance era, top-down overworld). The screenshots are third-party and are **not**
stored in this repo; this file describes the look to aim for. Draw **original** art in that style:
never copy, trace or recreate assets, characters, buildings or logos from those games (see
`CLAUDE.md` › Locked decisions: no Nintendo assets, never the word "Pokémon").

Task: once M15 is ticked in `docs/PROGRESS.md`, restyle the tilesets, sprites, UI boxes and Tiled
maps to this look while keeping every file path, tile id, map layer name, collision, warp, spawn
and encounter zone working (re-run all checks of the Definition of done).

## Overall look

- Top-down, slightly 3/4 view: roofs and tree crowns are seen from above, building fronts and
  doors from the front. Characters are ~1 tile wide and ~1.5 tiles tall, big head, short body.
- Bright, saturated but soft palette with light backgrounds; every object has a **dark outline**
  (near-black brown/navy, never pure black on large areas) and 2–3 shades of each hue (light,
  base, shadow). Light comes from the top-left.
- Ground tiles carry a subtle repeating texture (tiny dots, dashes or a herringbone/brick
  pattern) so large flat areas never look empty.
- Keep it crisp pixel art at the native 32 px tile (design at 16 px and scale ×2 if it helps the
  chunky GBC/GBA feel). No anti-aliasing, no gradients.

## Palette cues seen in the references

- Grass: mint/teal green (`#58c890`-ish) with lighter speckles; darker green tufts for tall
  grass (encounter tiles), drawn as small "V"/leaf clusters.
- Paths: sandy beige (`#e8d090`) with a darker beige edge; town plazas in pale cream
  (`#f0ecd0`) with a herringbone pattern; cobbled streets in grey-beige stones.
- Water: teal/cyan (`#38a8b8`) with white ripple lines, stone or dark-brown banks.
- Trees: rounded conical pines in 3 greens with a dark outline, packed in rows as walls.
- Roofs: tiled roofs in salmon/terracotta, blue, teal, or olive-yellow with scalloped/row
  shingles; walls in cream/white with brown timber trim, wooden double doors, small windows.
- Accents: small red/pink flowers on grass, wooden signposts (brown board on a post), wooden
  fences, ornate lampposts, hedges/round bushes.

## Valencia flavour (original content, same style)

Keep the cartoon Valencia theme from `docs/PLAN.md`: orange trees, terracotta roofs, blue/white
tiled domes, palm trees, the beach and the Turia gardens, office buildings for ahora/Flexygo.
Render them with the palette and outline rules above.

## UI

- Dialogue box: rounded rectangle, white/cream fill, 2-tone border (dark outline + coloured
  inner line), dark text. Battle screen: light green/teal background, coloured "platform"
  ellipses under each flexymon, HP bars in small rounded panels.

## Maps

- Fill map edges with tree rows, water or building walls instead of empty void.
- Mix ground variants (grass with flowers, paths, plazas) so no screen is a single flat tile.
- Put signposts by building doors and route entrances; use lampposts and fences to frame paths.
