import { describe, expect, it } from 'vitest';
import { boxMove, boxRows, clampCursor, otherColumn, scrollTop } from '../../src/logic/storage-box';
import type { Party } from '../../src/logic/team';
import { gameData, inst } from './helpers';

const data = gameData();
const party = (over: Partial<Party> = {}): Party => ({
  team: [inst('portatil', 'p')],
  storage: [inst('raton', 'r', { currentHp: 0 }), inst('teclado', 't')],
  teamSlots: 2,
  ...over,
});

describe('storage box', () => {
  it('rows show name, icon and HP; fainted marked', () => {
    const rows = boxRows(party(), 'storage', data.flexymon);
    expect(rows.map((r) => [r.uid, r.name, r.hp, r.maxHp, r.fainted])).toEqual([
      ['r', 'Ratón', 0, data.flexymon.get('raton')!.stats.hp, true],
      ['t', 'Teclado', 38, 38, false],
    ]);
    expect(rows[0]!.icon).toBe(data.flexymon.get('raton')!.sprite.icon);
    const unknown = boxRows(
      { ...party(), team: [inst('portatil', 'x', { speciesId: 'zzz', currentHp: 5 })] },
      'team',
      data.flexymon,
    );
    expect(unknown[0]).toMatchObject({ name: 'zzz', icon: '', maxHp: 5 });
  });

  it('moves between columns; the team never becomes empty or exceeds its slots', () => {
    expect(boxMove(party(), 'team', 0)).toEqual({ ok: false, reason: 'last_member' });
    const in1 = boxMove(party(), 'storage', 1);
    expect(in1.ok && in1.party.team.map((m) => m.uid)).toEqual(['p', 't']);
    expect(in1.ok && in1.party.storage.map((m) => m.uid)).toEqual(['r']);
    if (!in1.ok) return;
    expect(boxMove(in1.party, 'storage', 0)).toEqual({ ok: false, reason: 'team_full' });
    const out = boxMove(in1.party, 'team', 0);
    expect(out.ok && out.party.team.map((m) => m.uid)).toEqual(['t']);
    expect(out.ok && out.party.storage.map((m) => m.uid)).toEqual(['r', 'p']);
    expect(boxMove(party(), 'storage', 9)).toEqual({ ok: false, reason: 'not_found' });
  });

  it('cursor and scrolling helpers', () => {
    expect(otherColumn('team')).toBe('storage');
    expect(otherColumn('storage')).toBe('team');
    expect(clampCursor(5, 3)).toBe(2);
    expect(clampCursor(-1, 3)).toBe(0);
    expect(clampCursor(4, 0)).toBe(0);
    expect(scrollTop(3, 0, 9, 5)).toBe(0); // everything fits
    expect(scrollTop(9, 0, 9, 20)).toBe(1); // one past the window
    expect(scrollTop(4, 3, 9, 20)).toBe(3); // still inside
    expect(scrollTop(2, 3, 9, 20)).toBe(2); // above the window
    expect(scrollTop(19, 0, 9, 20)).toBe(11);
    expect(scrollTop(5, 15, 9, 12)).toBe(3); // list shrank
  });
});
