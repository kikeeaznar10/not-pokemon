# src/logic — pure game rules

NO Phaser imports (enforced by ESLint). Plain data in, plain data out; nothing is mutated (functions return new
objects). Randomness only through an `Rng` passed in (`src/core/rng.ts`), so tests fix every roll. Logging is the
caller's job (e.g. `parseSave` returns `warnings[]`). Tunable numbers: `constants.ts`. Tests: `tests/logic/`
(one file per module; `tests/logic/helpers.ts` has the shipped content as `GameData` and `scriptedRng()`, a fake
`Rng` that returns queued values so a test proves the exact RNG call order).

| Module | Rules (docs/PLAN.md › Game rules) |
| --- | --- |
| `constants.ts` | `DAMAGE_SCALE`, `DAMAGE_ROLL`, `MOD_MIN`, `MOD_MAX`, `MERGE_PERCENT`, `MERGE_CAP`, `TEAM_MAX`, `NPC_COOLDOWN_DISTANCE`, `SAFE_STEPS`, `EUROS_MAX`, `NPC_LOW_HP`, `ITEM_COUNT_MAX`, `SAVE_VERSION`. |
| `instance.ts` | Owned flexymon `{ uid, speciesId, bonus, currentHp }`: create, stat value, max HP, heal, full heal, revive, damage, fainted. |
| `modifiers.ts` | Buff/debuff list per active flexymon: effective stat (clamp 25–250 %, floor, min 1), same source replaces, tick per round. |
| `damage.ts` | Hit roll, damage roll and formula, heal-attack amount. |
| `ai.ts` | Opponent attack choice (wild random; NPC heal below 25 % / best `power × accuracy`). |
| `battle.ts` | The battle state machine: `createBattle`, `introEvents`, `chooseAction` → `{ state, events[] }`, plus `actionError`, `availableSwitches`, `battleItems` for the menus. Event list and RNG order are documented in the file. |
| `team.ts` | `Party { team, storage, teamSlots }`: add (team or storage), move to/from storage (last member stays), reorder, add slot (max 6), find owned, full heal. |
| `merge.ts` | `canCatch()` hook, `takeFlexymon()` (add new or merge: random open stat +`max(1, round(base × 10 %))`, cap 2× base). |
| `inventory.ts` | Bag `{ itemId: count }` 0–99: count, add (capped), remove. |
| `economy.ts` | Euro clamp, NPC reward roll, loss penalty, buy (money checked first), sell (`floor(price / 2)`, no keys / `price: null`). |
| `encounter.ts` | Encounter rectangles (`tiles` / `all`), rate roll + weighted pick, safe steps (`checkStep`). |
| `npc-state.ts` | `ready` / `cooldown`, sight line with blockers, approach path, cooldown end (Manhattan > 6 or other map), reset all. |
| `save.ts` | `GameState`, zod `saveSchema`, `serializeSave`, `parseSave` (validate + migrate; never throws). |
| `names.ts` | Name normalisation for secret names (M1). |

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
