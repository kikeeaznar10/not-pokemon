import { describe, expect, it } from 'vitest';
import { canCatch, maxBonus, mergeGain, mergeInto, takeFlexymon } from '../../src/logic/merge';
import type { Party } from '../../src/logic/team';
import { inst, scriptedRng, species } from './helpers';

const portatil = species('portatil'); // hp 40, attack 12, defense 10, speed 11
const raton = species('raton');

describe('catching and merging', () => {
  it('canCatch is always true for now', () => {
    expect(canCatch()).toBe(true);
  });

  it('gain is max(1, round(base × 10%)); base attack 12 → +1, cap 24 after 12 merges', () => {
    expect(mergeGain(portatil, 'attack')).toBe(1);
    expect(mergeGain(portatil, 'hp')).toBe(4);
    expect(maxBonus(portatil, 'attack')).toBe(12);
    let i = inst('portatil', 'p');
    const atk = 1; // index of 'attack' in [hp, attack, defense, speed]
    for (let n = 0; n < 12; n += 1) {
      const r = mergeInto(portatil, i, scriptedRng({ pick: [atk] }));
      expect(r).toMatchObject({ stat: 'attack', amount: 1 });
      i = r!.instance;
    }
    expect(portatil.stats.attack + i.bonus.attack).toBe(24);
    // Attack is now full, so it is no longer among the choices: pick index 1 is now 'defense'.
    expect(mergeInto(portatil, i, scriptedRng({ pick: [1] }))?.stat).toBe('defense');
  });

  it('never passes the cap (partial last gain)', () => {
    const i = inst('portatil', 'p', { bonus: { hp: 38, attack: 12, defense: 10, speed: 11 }, currentHp: 70 });
    const r = mergeInto(portatil, i, scriptedRng({ pick: [0] }));
    expect(r).toMatchObject({ stat: 'hp', amount: 2 });
    expect(r?.instance.bonus.hp).toBe(40);
    expect(r?.instance.currentHp).toBe(72); // HP gain also raises current HP
  });

  it('a fully merged flexymon is at its maximum', () => {
    const i = inst('portatil', 'p', { bonus: { hp: 40, attack: 12, defense: 10, speed: 11 } });
    expect(mergeInto(portatil, i, scriptedRng({}))).toBeNull();
    const party: Party = { team: [i], storage: [], teamSlots: 2 };
    expect(takeFlexymon(party, portatil, scriptedRng({})).outcome).toEqual({ type: 'maxed', uid: 'p' });
  });

  it('a new species goes to the team, or storage with a full team', () => {
    const party: Party = { team: [inst('portatil', 'p')], storage: [], teamSlots: 2 };
    const a = takeFlexymon(party, raton, scriptedRng({}));
    expect(a.outcome).toEqual({ type: 'added', to: 'team', uid: 'id1' });
    expect(a.party.team[1]).toEqual({
      uid: 'id1',
      speciesId: 'raton',
      bonus: { hp: 0, attack: 0, defense: 0, speed: 0 },
      currentHp: 30,
    });
    const full: Party = { ...party, teamSlots: 1 };
    expect(takeFlexymon(full, raton, scriptedRng({})).outcome).toEqual({
      type: 'added',
      to: 'storage',
      uid: 'id1',
    });
  });

  it('an owned species merges into the first instance (team first, then storage)', () => {
    const party: Party = {
      team: [inst('portatil', 'p')],
      storage: [inst('raton', 's1'), inst('raton', 's2')],
      teamSlots: 2,
    };
    const r = takeFlexymon(party, raton, scriptedRng({ pick: [3] }));
    expect(r.outcome).toEqual({ type: 'merged', uid: 's1', stat: 'speed', amount: 1 });
    expect(r.party.storage[0]?.bonus.speed).toBe(1);
    expect(r.party.storage[1]?.bonus.speed).toBe(0);
  });
});
