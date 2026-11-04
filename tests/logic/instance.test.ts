import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng';
import {
  createInstance,
  heal,
  healFull,
  isFainted,
  maxHp,
  revive,
  statValue,
  takeDamage,
} from '../../src/logic/instance';
import { inst, species } from './helpers';

const portatil = species('portatil'); // hp 40, attack 12, defense 10, speed 11

describe('instance', () => {
  it('creates a fresh instance with zero bonus, full HP and an rng uid', () => {
    const a = createInstance(portatil, createRng(1));
    const b = createInstance(portatil, createRng(1));
    expect(a).toEqual({
      uid: b.uid,
      speciesId: 'portatil',
      bonus: { hp: 0, attack: 0, defense: 0, speed: 0 },
      currentHp: 40,
    });
    expect(a.uid.length).toBeGreaterThan(0);
  });

  it('stat value is base + bonus; max HP is base.hp + bonus.hp', () => {
    const i = inst('portatil', 'a', { bonus: { hp: 4, attack: 2, defense: 0, speed: 1 } });
    expect(statValue(portatil, i, 'attack')).toBe(14);
    expect(statValue(portatil, i, 'speed')).toBe(12);
    expect(maxHp(portatil, i)).toBe(44);
  });

  it('heal never goes above max HP and never heals a fainted one', () => {
    const hurt = inst('portatil', 'a', { currentHp: 30 });
    expect(heal(portatil, hurt, 20)).toEqual({ instance: { ...hurt, currentHp: 40 }, healed: 10 });
    expect(heal(portatil, hurt, 5).healed).toBe(5);
    expect(hurt.currentHp).toBe(30); // input untouched
    const down = inst('portatil', 'a', { currentHp: 0 });
    expect(heal(portatil, down, 20)).toEqual({ instance: down, healed: 0 });
  });

  it('healFull restores max HP (also when fainted)', () => {
    expect(healFull(portatil, inst('portatil', 'a', { currentHp: 0 })).currentHp).toBe(40);
  });

  it('revive only works on a fainted one: floor(maxHp × percent / 100), at least 1', () => {
    const down = inst('portatil', 'a', { currentHp: 0 });
    expect(revive(portatil, down, 50)).toEqual({ instance: { ...down, currentHp: 20 }, healed: 20 });
    expect(revive(portatil, down, 1).instance.currentHp).toBe(1);
    const up = inst('portatil', 'a', { currentHp: 5 });
    expect(revive(portatil, up, 50)).toEqual({ instance: up, healed: 0 });
  });

  it('damage never takes HP below 0; 0 HP is fainted', () => {
    const i = inst('portatil');
    expect(isFainted(i)).toBe(false);
    const d = takeDamage(i, 100);
    expect(d.currentHp).toBe(0);
    expect(isFainted(d)).toBe(true);
    expect(takeDamage(i, 14).currentHp).toBe(26);
  });
});
