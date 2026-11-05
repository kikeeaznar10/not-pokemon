/**
 * Save format (docs/GAME-RULES.md › Saving): serialize the game state, and parse + validate + migrate a saved
 * JSON string. Pure: no `localStorage` here (the save store wrapper lives in `src/core/`) and no
 * logging (warnings are returned for the caller to log).
 *
 * Migration on load (each change adds a warning; nothing throws):
 * - flexymon of an unknown species, unknown item ids and unknown NPC ids are dropped;
 * - a bonus outside 0 … `(MERGE_CAP − 1) × base` and HP above max HP (content changed) are clamped;
 * - an unknown map puts the player at `start.json › respawn`;
 * - team members beyond `teamSlots` move to storage; an empty team takes the first storage flexymon.
 * A save left with no flexymon at all fails with `empty_team`.
 */
import { z } from 'zod';
import { facingSchema, idSchema, type MapPoint, type Species } from '../data/schemas';
import { EUROS_MAX, ITEM_COUNT_MAX, SAVE_VERSION, TEAM_MAX } from './constants';
import { maxHp, STAT_KEYS, type FlexymonInstance } from './instance';
import { maxBonus } from './merge';
import type { Inventory } from './inventory';
import type { NpcStates } from './npc-state';

const bonusSchema = z.object({
  hp: z.int().min(0),
  attack: z.int().min(0),
  defense: z.int().min(0),
  speed: z.int().min(0),
});

/** One saved flexymon instance. */
export const instanceSaveSchema = z.object({
  uid: z.string().min(1),
  speciesId: idSchema,
  bonus: bonusSchema,
  currentHp: z.int().min(0),
});

/** The whole save (`flexymon.save.v1`). */
export const saveSchema = z.object({
  version: z.literal(SAVE_VERSION),
  savedAt: z.string(),
  player: z.object({
    name: z.string().min(1),
    map: idSchema,
    x: z.int().min(0),
    y: z.int().min(0),
    facing: facingSchema,
  }),
  euros: z.int().min(0).max(EUROS_MAX),
  teamSlots: z.int().min(1).max(TEAM_MAX),
  team: z.array(instanceSaveSchema),
  storage: z.array(instanceSaveSchema),
  items: z.record(z.string(), z.int().min(0).max(ITEM_COUNT_MAX)),
  npcs: z.record(z.string(), z.enum(['ready', 'cooldown'])),
});

/** The full saved document. */
export type SaveData = z.infer<typeof saveSchema>;

/** Everything a save holds except `version` and `savedAt`: the live game state. */
export interface GameState {
  player: { name: string } & MapPoint;
  euros: number;
  teamSlots: number;
  team: FlexymonInstance[];
  storage: FlexymonInstance[];
  items: Inventory;
  npcs: NpcStates;
}

/** The content a save is checked against. `GameData` satisfies it. */
export interface SaveCheckData {
  readonly flexymon: ReadonlyMap<string, Species>;
  readonly items: ReadonlyMap<string, unknown>;
  readonly npcs: ReadonlyMap<string, unknown>;
  readonly zones: ReadonlyMap<string, unknown>;
  readonly start: { readonly respawn: MapPoint };
}

/** Why a save could not be loaded (the caller copies it to `flexymon.save.broken`). */
export type SaveError = 'invalid_json' | 'invalid_schema' | 'empty_team';

/** Result of {@link parseSave}. */
export type ParseSaveResult =
  | { ok: true; state: GameState; savedAt: string; warnings: string[] }
  | { ok: false; reason: SaveError; detail: string };

/** Turn the game state into the saved JSON string (version + ISO `savedAt`). */
export function serializeSave(state: GameState, now: Date): string {
  const data: SaveData = { version: SAVE_VERSION, savedAt: now.toISOString(), ...structuredClone(state) };
  return JSON.stringify(data);
}

/** Drop unknown species and clamp bonus/HP to the current content. */
function migrateInstances(list: FlexymonInstance[], data: SaveCheckData, where: string, warnings: string[]) {
  const out: FlexymonInstance[] = [];
  for (const inst of list) {
    const species = data.flexymon.get(inst.speciesId);
    if (!species) {
      warnings.push(`${where}: dropped flexymon "${inst.uid}" of unknown species "${inst.speciesId}"`);
      continue;
    }
    const bonus = { ...inst.bonus };
    for (const s of STAT_KEYS) {
      const cap = maxBonus(species, s);
      if (bonus[s] > cap) {
        warnings.push(`${where}: "${inst.uid}" ${s} bonus ${bonus[s]} clamped to ${cap}`);
        bonus[s] = cap;
      }
    }
    const fixed = { ...inst, bonus };
    const max = maxHp(species, fixed);
    if (fixed.currentHp > max) {
      warnings.push(`${where}: "${inst.uid}" HP ${fixed.currentHp} clamped to ${max}`);
      fixed.currentHp = max;
    }
    out.push(fixed);
  }
  return out;
}

/** Keep only record keys that exist in `known`. */
function knownKeys<V>(
  record: Record<string, V>,
  known: ReadonlyMap<string, unknown>,
  what: string,
  warnings: string[],
) {
  const out: Record<string, V> = {};
  for (const [id, v] of Object.entries(record)) {
    if (known.has(id)) out[id] = v;
    else warnings.push(`dropped unknown ${what} "${id}"`);
  }
  return out;
}

/** Parse, validate and migrate a saved JSON string against the current content. Never throws. */
export function parseSave(text: string, data: SaveCheckData): ParseSaveResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, reason: 'invalid_json', detail: e instanceof Error ? e.message : String(e) };
  }
  const parsed = saveSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const detail = issue ? `${issue.path.join('.') || '(root)'}: ${issue.message}` : 'invalid';
    return { ok: false, reason: 'invalid_schema', detail };
  }
  const save = parsed.data;
  const warnings: string[] = [];

  let team = migrateInstances(save.team, data, 'team', warnings);
  let storage = migrateInstances(save.storage, data, 'storage', warnings);
  if (team.length > save.teamSlots) {
    warnings.push(`team has ${team.length} flexymon for ${save.teamSlots} slots; extras moved to storage`);
    storage = [...team.slice(save.teamSlots), ...storage];
    team = team.slice(0, save.teamSlots);
  }
  if (team.length === 0 && storage.length > 0) {
    warnings.push('team was empty; first storage flexymon moved to the team');
    team = [storage[0] as FlexymonInstance];
    storage = storage.slice(1);
  }
  if (team.length === 0)
    return { ok: false, reason: 'empty_team', detail: 'no flexymon left after migration' };

  let player = save.player;
  if (!data.zones.has(player.map)) {
    warnings.push(`unknown map "${player.map}"; player moved to the respawn point`);
    player = { name: player.name, ...data.start.respawn };
  }
  const items = Object.fromEntries(
    Object.entries(knownKeys(save.items, data.items, 'item', warnings)).filter(([, n]) => n > 0),
  );

  return {
    ok: true,
    savedAt: save.savedAt,
    warnings,
    state: {
      player,
      euros: save.euros,
      teamSlots: save.teamSlots,
      team,
      storage,
      items,
      npcs: knownKeys(save.npcs, data.npcs, 'NPC', warnings),
    },
  };
}
