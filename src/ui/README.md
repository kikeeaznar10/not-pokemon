# src/ui — reusable UI widgets (presentation only; rules live in src/logic/)

| File | What it is |
| --- | --- |
| `dialog-box.ts` | `DialogBox` (M5): 512 × 80 box at the bottom, fixed to the camera. Text types out at `TEXT_CPS` (30/s); A shows the whole box, A again goes to the next; a blinking arrow when another box follows; word wrap and overflow onto extra boxes (`src/logic/dialogue.ts`); plays the speaker's `voice` every 3 characters. The owner calls `update(dt)` each frame while `isOpen`; the opening frame ignores input. |
| `choice-box.ts` | `ChoiceBox` (M5): framed option list with a cursor (Sí/No, Llevármelo/Dejarlo, shops). Up/Down wrap, A chooses, B cancels (`null`) unless `cancelable: false`. Sits at the right edge above the DialogBox by default. |
| `cursor.ts` | `moveCursor` (M5): wrap-around cursor movement; `moveGridCursor` (M6): grid movement without wrapping. Pure (unit-tested). |
| `grid-menu.ts` | `GridMenu` (M6): framed options in `cols` columns with a cursor (battle 2 × 2 menu, attack list, team list). Arrows move, A chooses an enabled option (disabled ones are greyed and ignore A), B cancels unless `cancelable: false`. Options may have an icon and a right-aligned text; optional title line; `onMove` for side panels. |
| `hp-bar.ts` | `HpBar` (M6): HP bar (green / yellow < 50 % / red < 20 %, `hpColor`), optionally with "PS 31/40". `set()` jumps, `animateTo()` moves over `HP_ANIM_MS` (400 ms). `shown` is the drawn value (E2E). |

Planned: Menu (M10), TouchControls and Minimap (M12). Text uses the browser's monospace font until a
pixel font asset exists (see `docs/PROGRESS.md` › Raised in M5). Widgets read controls only through `src/core/input.ts`.
