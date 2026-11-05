# src/data/schemas — one zod schema per file in public/data/ (M1).

`intro.ts` (M11) validates `intro.json`, the one content file not in the plan's list of nine: the title image, the
handover jingle, the intro coworker and the intro `steps` (`fade_in`, `wait`, `walk`, `face`, `say`, exactly one
`handover`). See `public/data/README.md` for the fields.
