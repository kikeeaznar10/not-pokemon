# tools — developer scripts run with tsx (not shipped in the game)

## `npm run placeholders` (`make-placeholders.ts`)

Scans every JSON file in `public/data/` for asset paths (`assets/….png|ogg|mp3`, relative to `public/`) and
creates any missing file. **Never overwrites** an existing file, so a second run creates nothing and real art
dropped at the same path is kept. `--dry-run` (`npm run placeholders -- --dry-run`) only lists what is missing.

- PNG: solid colour square (colour from the file name) with the file name in a pixel font.
  `*_front` / `*_back` → 64×64, `*_icon` and anything in `sprites/items/` → 16×16, everything else → 32×32.
- Audio: an `.ogg` or `.mp3` path creates both `<name>.ogg` and `<name>.mp3`, a 0.2 s 880 Hz beep made with
  `ffmpeg` (libvorbis / libmp3lame). If `ffmpeg` is not on the PATH, it copies the silent files in
  `tools/fallback/` instead and says how many audio files are silent.
