import { describe, expect, it } from 'vitest';
import {
  addFlexymon,
  addTeamSlot,
  findOwned,
  healParty,
  moveToStorage,
  moveToTeam,
  reorderTeam,
  replaceInstance,
  type Party,
} from '../../src/logic/team';
import { gameData, inst } from './helpers';

const party = (over: Partial<Party> = {}): Party => ({
  team: [inst('portatil', 'p')],
  storage: [],
  teamSlots: 2,
  ...over,
});

describe('team and storage', () => {
  it('adds to the team while there is a free slot, then to storage', () => {
    const a = addFlexymon(party(), inst('raton', 'r'));
    expect(a.to).toBe('team');
    const b = addFlexymon(a.party, inst('teclado', 't'));
    expect(b.to).toBe('storage');
    expect(b.party.team.map((m) => m.uid)).toEqual(['p', 'r']);
    expect(b.party.storage.map((m) => m.uid)).toEqual(['t']);
  });

  it('the last team member cannot go to storage', () => {
    expect(moveToStorage(party(), 'p')).toEqual({ ok: false, reason: 'last_member' });
    expect(moveToStorage(party(), 'x')).toEqual({ ok: false, reason: 'not_found' });
    const r = moveToStorage(party({ team: [inst('portatil', 'p'), inst('raton', 'r')] }), 'p');
    expect(r.ok && r.party.team.map((m) => m.uid)).toEqual(['r']);
    expect(r.ok && r.party.storage.map((m) => m.uid)).toEqual(['p']);
  });

  it('a stored flexymon can only join a team with a free slot', () => {
    const full = party({
      team: [inst('portatil', 'p'), inst('raton', 'r')],
      storage: [inst('teclado', 't')],
    });
    expect(moveToTeam(full, 't')).toEqual({ ok: false, reason: 'team_full' });
    expect(moveToTeam(full, 'x')).toEqual({ ok: false, reason: 'not_found' });
    const r = moveToTeam({ ...full, teamSlots: 3 }, 't');
    expect(r.ok && r.party.team.map((m) => m.uid)).toEqual(['p', 'r', 't']);
    expect(r.ok && r.party.storage).toEqual([]);
  });

  it('slots grow by one up to 6', () => {
    const r = addTeamSlot(party());
    expect(r.ok && r.party.teamSlots).toBe(3);
    expect(addTeamSlot(party({ teamSlots: 6 }))).toEqual({ ok: false, reason: 'max_slots' });
  });

  it('reorders the team (first = first into battle)', () => {
    const p = party({
      team: [inst('portatil', 'a'), inst('raton', 'b'), inst('teclado', 'c')],
      teamSlots: 3,
    });
    const r = reorderTeam(p, 'c', 0);
    expect(r.ok && r.party.team.map((m) => m.uid)).toEqual(['c', 'a', 'b']);
    const r2 = reorderTeam(p, 'a', 99);
    expect(r2.ok && r2.party.team.map((m) => m.uid)).toEqual(['b', 'c', 'a']);
    expect(reorderTeam(p, 'x', 0)).toEqual({ ok: false, reason: 'not_found' });
  });

  it('finds the first owned instance, team first then storage', () => {
    const p = party({ team: [inst('portatil', 'p')], storage: [inst('raton', 's1'), inst('raton', 's2')] });
    expect(findOwned(p, 'raton')).toMatchObject({ where: 'storage', index: 0, instance: { uid: 's1' } });
    expect(findOwned({ ...p, team: [inst('portatil', 'p'), inst('raton', 't1')] }, 'raton')).toMatchObject({
      where: 'team',
      instance: { uid: 't1' },
    });
    expect(findOwned(p, 'teclado')).toBeNull();
  });

  it('replaces an instance by uid and fully heals team and storage', () => {
    const p = party({
      team: [inst('portatil', 'p', { currentHp: 0 })],
      storage: [inst('raton', 'r', { currentHp: 3 })],
    });
    expect(replaceInstance(p, inst('raton', 'r', { currentHp: 7 })).storage[0]?.currentHp).toBe(7);
    const healed = healParty(p, gameData().flexymon);
    expect(healed.team[0]?.currentHp).toBe(40);
    expect(healed.storage[0]?.currentHp).toBe(30);
    expect(
      healParty(
        party({ team: [inst('portatil', 'p', { speciesId: 'gone', currentHp: 1 })] }),
        gameData().flexymon,
      ).team[0]?.currentHp,
    ).toBe(1);
  });
});
