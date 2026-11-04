import { describe, expect, it } from 'vitest';
import { chooseOpponentAttack } from '../../src/logic/ai';
import type { Attack } from '../../src/data/schemas';
import { gameData, scriptedRng } from './helpers';

const data = gameData();
const atk = (id: string): Attack => data.attacks.get(id) as Attack;
const portatilAttacks = ['compilar', 'pantallazo_azul', 'actualizacion'].map(atk);
const none = scriptedRng({});

describe('opponent AI', () => {
  it('wild: a random attack with rng.pick (equal chance)', () => {
    const input = { kind: 'wild' as const, attacks: portatilAttacks, currentHp: 1, maxHp: 40 };
    expect(chooseOpponentAttack(input, scriptedRng({ pick: [1] }))).toBe('pantallazo_azul');
    expect(chooseOpponentAttack(input, scriptedRng({ pick: [2] }))).toBe('actualizacion');
  });

  it('NPC below 25% HP with a heal attack heals', () => {
    expect(
      chooseOpponentAttack({ kind: 'npc', attacks: portatilAttacks, currentHp: 9, maxHp: 40 }, none),
    ).toBe('actualizacion');
  });

  it('NPC at exactly 25% does not heal; uses the best power × accuracy damage attack', () => {
    expect(
      chooseOpponentAttack({ kind: 'npc', attacks: portatilAttacks, currentHp: 10, maxHp: 40 }, none),
    ).toBe('compilar');
    // compilar 40 × 95 = 3800 vs pulsacion 35 × 100 = 3500
    expect(
      chooseOpponentAttack(
        { kind: 'npc', attacks: [atk('pulsacion'), atk('compilar')], currentHp: 40, maxHp: 40 },
        none,
      ),
    ).toBe('compilar');
  });

  it('NPC low on HP without a heal attack still attacks', () => {
    expect(
      chooseOpponentAttack(
        { kind: 'npc', attacks: [atk('rueda_scroll'), atk('pulsacion')], currentHp: 1, maxHp: 30 },
        none,
      ),
    ).toBe('pulsacion');
  });

  it('NPC with no damage attack picks a random one', () => {
    const attacks = [atk('rueda_scroll'), atk('atajo_teclado')];
    expect(
      chooseOpponentAttack({ kind: 'npc', attacks, currentHp: 30, maxHp: 30 }, scriptedRng({ pick: [1] })),
    ).toBe('atajo_teclado');
  });

  it('throws without attacks', () => {
    expect(() => chooseOpponentAttack({ kind: 'wild', attacks: [], currentHp: 1, maxHp: 1 }, none)).toThrow();
  });
});
