# src/ui — reusable UI widgets (presentation only; rules live in src/logic/)

| File | What it is |
| --- | --- |
| `dialog-box.ts` | `DialogBox` (M5): 512 × 80 box at the bottom, fixed to the camera. Text types out at `TEXT_CPS` (30/s); A shows the whole box, A again goes to the next; a blinking arrow when another box follows; word wrap and overflow onto extra boxes (`src/logic/dialogue.ts`); plays the speaker's `voice` every 3 characters. The owner calls `update(dt)` each frame while `isOpen`; the opening frame ignores input. |
| `choice-box.ts` | `ChoiceBox` (M5): framed option list with a cursor (Sí/No, Llevármelo/Dejarlo, shops). Up/Down wrap, A chooses, B cancels (`null`) unless `cancelable: false`. Sits at the right edge above the DialogBox by default. |
| `cursor.ts` | `moveCursor` (M5): wrap-around cursor movement, pure (unit-tested). |

Planned: Menu (M10), HpBar (M6), TouchControls and Minimap (M12). Text uses the browser's monospace font until a
pixel font asset exists (see `docs/PROGRESS.md` › Raised in M5). Widgets read controls only through `src/core/input.ts`.
