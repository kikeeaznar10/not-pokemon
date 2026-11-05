/**
 * The storage box screen (docs/GAME-RULES.md › Team and storage): two columns, *Equipo* (the team, at most
 * `teamSlots`) and *Caja* (storage, no limit). A on a flexymon moves it to the other column:
 * - Equipo → Caja is refused for the last team member (`last_member`): the team can never be empty.
 * - Caja → Equipo is refused when the team is full (`team_full`): it never exceeds its slots.
 * A moved flexymon goes to the end of the other column. The rules are `team.ts`; this module adds the
 * rows, the cursor after a move and the scrolling window, so the scene computes nothing.
 */
import type { Species } from '../data/schemas';
import { isFainted, maxHp } from './instance';
import { moveToStorage, moveToTeam, type Party, type TeamResult } from './team';

/** A column of the box. */
export type BoxColumn = 'team' | 'storage';

/** One row of a column. */
export interface BoxRow {
  uid: string;
  speciesId: string;
  name: string;
  icon: string;
  hp: number;
  maxHp: number;
  fainted: boolean;
}

/** The rows of `column`, in party order. Unknown species keep their id as the name. */
export function boxRows(party: Party, column: BoxColumn, flexymon: ReadonlyMap<string, Species>): BoxRow[] {
  return party[column].map((m) => {
    const species = flexymon.get(m.speciesId);
    return {
      uid: m.uid,
      speciesId: m.speciesId,
      name: species?.name ?? m.speciesId,
      icon: species?.sprite.icon ?? '',
      hp: m.currentHp,
      maxHp: species ? maxHp(species, m) : m.currentHp,
      fainted: isFainted(m),
    };
  });
}

/** Move the flexymon at `index` of `column` to the other column (see the module rules). */
export function boxMove(party: Party, column: BoxColumn, index: number): TeamResult {
  const inst = party[column][index];
  if (!inst) return { ok: false, reason: 'not_found' };
  return column === 'team' ? moveToStorage(party, inst.uid) : moveToTeam(party, inst.uid);
}

/** The other column. */
export function otherColumn(column: BoxColumn): BoxColumn {
  return column === 'team' ? 'storage' : 'team';
}

/** Keep a cursor inside a column of `count` rows (0 when empty). */
export function clampCursor(cursor: number, count: number): number {
  return count <= 0 ? 0 : Math.min(Math.max(0, cursor), count - 1);
}

/**
 * First visible row of a scrolling list showing `visible` rows, so that `cursor` is on screen: the
 * window only moves when the cursor would leave it.
 */
export function scrollTop(cursor: number, top: number, visible: number, count: number): number {
  if (count <= visible) return 0;
  let next = top;
  if (cursor < next) next = cursor;
  if (cursor >= next + visible) next = cursor - visible + 1;
  return Math.min(Math.max(0, next), count - visible);
}
