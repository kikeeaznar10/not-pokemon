import { describe, expect, it } from 'vitest';
import { createT } from '../../src/i18n';
import es from '../../src/i18n/es.json';
import { useFieldItem } from '../../src/logic/field-items';
import {
  bagRows,
  bagTargetRows,
  fieldErrorMessage,
  fieldUsable,
  fieldUseMessages,
  flexymonDetail,
  START_MENU,
  teamRows,
} from '../../src/logic/menu';
import type { GameState } from '../../src/logic/save';
import { gameData, inst } from './helpers';

const data = gameData();
const t = createT(es);

function state(over: Partial<GameState> = {}): GameState {
  return {
    player: { name: 'Rogelio', map: 'test', x: 1, y: 1, facing: 'down' },
    euros: 200,
    teamSlots: 2,
    team: [inst('portatil', 'p', { currentHp: 30 }), inst('raton', 'r', { currentHp: 0 })],
    storage: [],
    items: { cafe: 3, redbull: 1, regleta: 1, llaves_audi: 1, carnet: 0 },
    npcs: {},
    ...over,
  };
}

describe('start menu', () => {
  it('lists Equipo, Mochila, Mapa, Opciones, Cerrar with labels in es.json', () => {
    expect(START_MENU).toEqual(['team', 'bag', 'map', 'options', 'close']);
    expect(START_MENU.map((e) => t(`menu.${e}`))).toEqual([
      'Equipo',
      'Mochila',
      'Mapa',
      'Opciones',
      'Cerrar',
    ]);
  });

  it('team rows follow battle order with HP and fainted', () => {
    const rows = teamRows(state(), data);
    expect(rows.map((r) => [r.uid, r.name, r.hp, r.maxHp, r.fainted])).toEqual([
      ['p', 'Portátil', 30, 40, false],
      ['r', 'Ratón', 0, 30, true],
    ]);
  });

  it('detail shows every stat as base + bonus, and the attacks', () => {
    const p = inst('portatil', 'p', { bonus: { hp: 4, attack: 1, defense: 0, speed: 2 }, currentHp: 31 });
    const d = flexymonDetail(p, data);
    expect(d).not.toBeNull();
    expect(d?.stats).toEqual([
      { stat: 'hp', base: 40, bonus: 4, value: 44 },
      { stat: 'attack', base: 12, bonus: 1, value: 13 },
      { stat: 'defense', base: 10, bonus: 0, value: 10 },
      { stat: 'speed', base: 11, bonus: 2, value: 13 },
    ]);
    expect(d?.hp).toBe(31);
    expect(d?.maxHp).toBe(44);
    expect(d?.attacks.map((a) => a.id)).toEqual(['compilar', 'pantallazo_azul', 'actualizacion']);
    expect(d?.attacks[0]).toEqual({ id: 'compilar', name: 'Compilar', accuracy: 95 });
    expect(flexymonDetail(inst('portatil', 'x', { speciesId: 'nadie' }), data)).toBeNull();
  });

  it('bag rows list counts above 0 in bag order; only field items with a field effect are usable', () => {
    const rows = bagRows(state({ items: { ...state().items, desconocido: 2 } }), data);
    expect(rows.map((r) => [r.itemId, r.count, r.usable])).toEqual([
      ['cafe', 3, true],
      ['redbull', 1, false],
      ['regleta', 1, true],
      ['llaves_audi', 1, false],
    ]);
    expect(rows[0]?.description).toBe(data.items.get('cafe')?.description);
    const fieldBuff = { ...data.items.get('redbull')!, usableIn: ['field' as const] };
    expect(fieldUsable(fieldBuff)).toBe(false);
  });

  it('targets are greyed when the item would do nothing', () => {
    const rows = bagTargetRows(state(), data, 'cafe');
    expect(rows.map((r) => [r.uid, r.enabled])).toEqual([
      ['p', true],
      ['r', false],
    ]);
    const full = state({ team: [inst('portatil', 'p')] });
    expect(bagTargetRows(full, data, 'cafe')[0]?.enabled).toBe(false);
  });

  it('words a heal and a Regleta', () => {
    const s = state();
    const healed = useFieldItem(s, data, 'cafe', 'p');
    expect(healed.ok).toBe(true);
    if (!healed.ok) return;
    expect(fieldUseMessages(healed.use, 'Café', healed.state, data, t)).toEqual([
      'Usas Café con Portátil.',
      'Portátil recupera 10 PS.',
    ]);
    const slot = useFieldItem(s, data, 'regleta');
    expect(slot.ok).toBe(true);
    if (!slot.ok) return;
    expect(slot.state.teamSlots).toBe(3);
    expect(fieldUseMessages(slot.use, 'Regleta', slot.state, data, t)).toEqual([
      'Usas Regleta.',
      'Tu equipo tiene ahora 3 plazas.',
    ]);
  });

  it('words a revive', () => {
    const msgs = fieldUseMessages(
      { type: 'revive', uid: 'r', hp: 15, maxHp: 30 },
      'Reinicio',
      state(),
      data,
      t,
    );
    expect(msgs).toEqual(['Usas Reinicio con Ratón.', '¡Ratón vuelve a estar en pie!']);
  });

  it('words a refusal', () => {
    expect(fieldErrorMessage('max_slots', t)).toBe(t('bag.max_slots'));
    expect(fieldErrorMessage('no_effect', t)).toBe(t('bag.no_effect'));
    expect(fieldErrorMessage('not_usable_in_field', t)).toBe(t('bag.cannot_use'));
    const atMax = useFieldItem(state({ teamSlots: 6 }), data, 'regleta');
    expect(atMax).toEqual({ ok: false, reason: 'max_slots' });
  });
});
