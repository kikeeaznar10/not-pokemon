# src/data/schemas — one zod schema per file in public/data/

`index.ts` maps each content file name to its schema (`FILE_SCHEMAS`, `DATA_FILES`); `common.ts` holds the shared
pieces (ids, asset paths, points, dialogue). Every object is strict. Adding a field to the content means adding it
here first, then documenting it in `docs/CONTENT.md` and `public/data/README.md`.
