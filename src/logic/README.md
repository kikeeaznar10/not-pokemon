# src/logic — pure game rules

NO Phaser imports (enforced by ESLint). Plain data in, plain data out; nothing is mutated (functions return new
objects). Randomness only through an `Rng` passed in (`src/core/rng.ts`), so tests fix every roll. Logging is the
caller's job (e.g. `parseSave` returns `warnings[]`). Tunable numbers: `constants.ts`. Tests: `tests/logic/`
(one file per module; `tests/logic/helpers.ts` has the shipped content as `GameData` and `scriptedRng()`, a fake
`Rng` that returns queued values so a test proves the exact RNG call order).

| Module | Rules (docs/PLAN.md › Game rules) |
| --- | --- |
| `constants.ts` | `DAMAGE_SCALE`, `DAMAGE_ROLL`, `MOD_MIN`, `MOD_MAX`, `MERGE_PERCENT`, `MERGE_CAP`, `TEAM_MAX`, `NPC_COOLDOWN_DISTANCE`, `SAFE_STEPS`, `EUROS_MAX`, `NPC_LOW_HP`, `ITEM_COUNT_MAX`, `SAVE_VERSION`; M3–M5 add `WALK_MS`, `TURN_TAP_MS`, `WARP_FADE_MS`, `MUSIC_FADE_MS`, `TEXT_CPS`, `VOICE_EVERY_CHARS`; M6 adds `BATTLE_FLASH_MS`, `HP_ANIM_MS`, `HP_YELLOW_BELOW`, `HP_RED_BELOW`; M8 adds `NPC_ALERT_MS`; M9 adds `QTY_BIG_STEP`; M10 adds `TEXT_SPEED_CPS`, `VOLUME_STEPS`, `SAVE_ICON_MS`. |
| `instance.ts` | Owned flexymon `{ uid, speciesId, bonus, currentHp }`: create, stat value, max HP, heal, full heal, revive, damage, fainted. |
| `modifiers.ts` | Buff/debuff list per active flexymon: effective stat (clamp 25–250 %, floor, min 1), same source replaces, tick per round. |
| `damage.ts` | Hit roll, damage roll and formula, heal-attack amount. |
| `ai.ts` | Opponent attack choice (wild random; NPC heal below 25 % / best `power × accuracy`). |
| `battle.ts` | The battle state machine: `createBattle`, `introEvents`, `chooseAction` → `{ state, events[] }`, plus `actionError`, `availableSwitches`, `battleItems` for the menus. Event list and RNG order are documented in the file. |
| `team.ts` | `Party { team, storage, teamSlots }`: add (team or storage), move to/from storage (last member stays), reorder, add slot (max 6), find owned, full heal. |
| `merge.ts` | `canCatch()` hook, `takeFlexymon()` (add new or merge: random open stat +`max(1, round(base × 10 %))`, cap 2× base). |
| `inventory.ts` | Bag `{ itemId: count }` 0–99: count, add (capped), remove. |
| `economy.ts` | Euro clamp, NPC reward roll, loss penalty, buy (money checked first), sell (`floor(price / 2)`, no keys / `price: null`). |
| `encounter.ts` | Encounter rectangles (`tiles` / `all`), rate roll + weighted pick, safe steps (`checkStep`). Used by the overworld from M7. |
| `npc-state.ts` | `ready` / `cooldown`, sight line with blockers, approach path, cooldown end (Manhattan > 6 or other map), reset all. |
| `save.ts` | `GameState`, zod `saveSchema`, `serializeSave`, `parseSave` (validate + migrate; never throws). |
| `names.ts` | Name normalisation for secret names (M1). |
| `name-entry.ts` | Name entry (M11): `typeChar` (letters and spaces only, max `NAME_MAX_LENGTH` 10, no leading / double space), `deleteChar`, `canConfirm` (needs a letter), `finalName` (trimmed), `nameGrid(letters)` (letter cells, space, Borrar, OK). |
| `intro.ts` | New-game intro (M11): `fillIntroText` (`{name}`, `{starter}`), `findSecretName` (case / accent / space-insensitive, via `normalizeName`), `applySecretName` (items into the bag, capped per item), `traceIntro` (every tile both actors walk on, for the boot checks). |
| `dialogue.ts` | Dialogue box rules (M5): word wrap, strings → pages (a string too long for one box continues on the next), typing at `TEXT_CPS` (M10: `typeTick(…, cps)` takes the text speed option's rate), voice every `VOICE_EVERY_CHARS` characters (1st, 4th, 7th…), A = reveal / next. |
| `npc-wander.ts` | NPC movement (M5): random wait in `stepEveryMs`, one random tile inside the wander rectangle, never onto a blocked tile; both tiles count as taken during a step; talking pauses the NPC and turns it to the player. M8: `engage` / `forceStep` / `faceTo` walk an enemy up to the player; outside its rectangle an NPC only steps towards it (`distanceToArea`). RNG order documented in the file. |
| `new-game.ts` | New-game state from `start.json` (M6): starter alone at full HP, euros, slots, items, spawn, no NPC states. |
| `battle-view.ts` | Battle presentation rules (M6): `viewSteps(events, ctx)` → message / sound / show / hit / hp / faint / withdraw / need_switch / end steps (HP only from the events), opponent names "{name} salvaje" / "{name} rival", `mainMenu` / `attackMenu` / `teamMenu` (enabled via `actionError`), `hpColor`; `catchMessages(outcome, name, t)` (M7) words a catch: joins the team / sent to storage / merged "{stat} +{n}" / already at the maximum; M9: `itemMenu` (battle items "x{n}", greyed with no valid target), `itemTargetMenu`, `itemNeedsTarget`. |
| `talk.ts` | What an NPC says by type (M5): dialogue; enemy (M8) = dialogue while `ready`, only `defeatDialogue` in `cooldown`; M9: healer = "Tus flexymon están como nuevos." then dialogue; `talkAction` says what happens around the talk (`heal` before, `storage` / `shop` after). |
| `field-items.ts` | Items outside battle (M9): `useFieldItem(state, data, itemId, targetUid?)` (heal / heal_full / revive on a team member, Regleta +1 slot up to 6, one consumed per use; buff / key / catch refused), `fieldItemError`, `fieldItemNeedsTarget`. Used by M10's Mochila. |
| `shop.ts` | Shop screen rules (M9): `shopStock`, `buyRows` (price, limit by money / bag room / 99), `sellRows` (bag order, half price, key and `price: null` items listed but unsellable), `rowError`, `stepQuantity` (1 … limit, no wrap), `totalPrice`. |
| `storage-box.ts` | Storage box rules (M9): `boxRows`, `boxMove` (via `team.ts`: last member stays, slot limit), `otherColumn`, `clampCursor`, `scrollTop` (scrolling window). |
| `options.ts` | Player options (M10): `Options { music, sfx (0–VOLUME_STEPS), textSpeed (slow / normal / fast) }`, `defaultOptions` (full volumes, normal), `parseOptions` (never throws; each bad field falls back alone, with a warning), `serializeOptions`, `stepOption` (Left / Right one step, no wrap), `textCps`, `volumeGain`. |
| `menu.ts` | Start menu rules (M10): `START_MENU` (Equipo, Mochila, Mapa, Opciones, Cerrar), `teamRows`, `flexymonDetail` (stats as `base + bonus`, attacks with accuracy), `bagRows` (count > 0, bag order; `usable` = `fieldUsable`: `"field"` and a heal / heal_full / revive / team_slot effect), `bagTargetRows` (greyed when the item does nothing), `fieldUseMessages`, `fieldErrorMessage`. |
| `enemy-npc.ts` | Enemy NPC battles (M8): `findSpotter` (first free `ready` enemy that sees the player + its approach path), `npcTeam` (fresh instances of its team), `winAgainstNpc` (reward `rng.int(min, max)` + `cooldown`), `loseBattle` (Losing rule: half the euros, heal team and storage, every NPC `ready`, respawn), `placedEnemies` / `refreshCooldowns` (cooldown ends > 6 tiles away or on another map). |

## Battle events (`battle.ts`)

`who` is the attacker for `attack` / `miss`, otherwise the side whose flexymon is affected. `damage.amount` is
the HP actually lost (overkill is not reported).

| Event | Fields |
| --- | --- |
| `appear` | `who, uid, speciesId` (from `introEvents`) |
| `attack` / `miss` | `who, uid` (+ `attackId`) |
| `damage` / `heal` | `who, uid, amount, hp, maxHp` |
| `revive` | `who, uid, hp, maxHp` |
| `modifier` / `modifier_end` | `who, uid, kind, stat` (+ `percent, turns`) |
| `faint` | `who, uid` |
| `switch` | `who, fromUid, toUid` (player choice, or an NPC's next flexymon) |
| `item` | `itemId, targetUid` |
| `flee`, `need_switch`, `end` | `end.result`: `win` / `lose` / `fled` |
