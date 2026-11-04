/** Test helpers for src/logic: the shipped content as GameData, and a scripted fake Rng. */
import type { Rng } from '../../src/core/rng';
import type { GameData } from '../../src/data/game-data';
import { validateGameData } from '../../src/data/loader';
import type { Species } from '../../src/data/schemas';
import type { FlexymonInstance } from '../../src/logic/instance';
import { validFiles } from '../data/fixture';

/** The shipped `public/data/` content, validated. */
export function gameData(): GameData {
  const result = validateGameData(validFiles());
  if (!result.ok) throw new Error('fixture data is invalid');
  return result.data;
}

/** A species from the shipped content. */
export function species(id: string): Species {
  const sp = gameData().flexymon.get(id);
  if (!sp) throw new Error(`no species ${id}`);
  return sp;
}

/** A fresh instance (zero bonus, full HP) with a fixed uid. */
export function inst(
  speciesId: string,
  uid = speciesId,
  over: Partial<FlexymonInstance> = {},
): FlexymonInstance {
  return {
    uid,
    speciesId,
    bonus: { hp: 0, attack: 0, defense: 0, speed: 0 },
    currentHp: species(speciesId).stats.hp,
    ...over,
  };
}

/** Queued answers for {@link scriptedRng}. Each call consumes the next value; running out throws. */
export interface Script {
  int?: number[];
  float?: number[];
  chance?: boolean[];
  /** Index into the array given to `pick`. */
  pick?: number[];
  /** Index into the array given to `weighted`. */
  weighted?: number[];
}

/** A fake Rng that returns scripted values, so tests control every roll exactly. */
export function scriptedRng(script: Script): Rng & { remaining(): Required<Script> } {
  const q: Required<Script> = {
    int: [...(script.int ?? [])],
    float: [...(script.float ?? [])],
    chance: [...(script.chance ?? [])],
    pick: [...(script.pick ?? [])],
    weighted: [...(script.weighted ?? [])],
  };
  let ids = 0;
  const take = <K extends keyof Script>(k: K): Required<Script>[K][number] => {
    if (q[k].length === 0) throw new Error(`scriptedRng: no ${k} value left`);
    return q[k].shift() as Required<Script>[K][number];
  };
  return {
    seed: () => undefined,
    next: () => {
      throw new Error('scriptedRng: next() not scripted');
    },
    int: () => take('int'),
    float: () => take('float'),
    chance: () => take('chance'),
    pick: <T>(items: readonly T[]) => items[take('pick')] as T,
    weighted: <T>(items: readonly T[]) => items[take('weighted')] as T,
    id: () => `id${(ids += 1)}`,
    remaining: () => q,
  };
}
