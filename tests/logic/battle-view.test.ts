import { describe, expect, it } from 'vitest';
import { createT } from '../../src/i18n';
import es from '../../src/i18n/es.json';
import {
  chooseAction,
  createBattle,
  introEvents,
  type BattleEvent,
  type BattleState,
} from '../../src/logic/battle';
import {
  attackMenu,
  catchMessages,
  hpColor,
  mainMenu,
  teamMenu,
  viewSteps,
  type ViewContext,
} from '../../src/logic/battle-view';
import { gameData, inst, scriptedRng } from './helpers';

const data = gameData();
const t = createT(es);
const ctx = (state: BattleState): ViewContext => ({ data, kind: state.kind, state, t });
const texts = (steps: ReturnType<typeof viewSteps>) =>
  steps.flatMap((s) => (s.type === 'message' ? [s.text] : []));

describe('battle-view: intro', () => {
  it('shows the wild opponent, then sends out the player, with cries', () => {
    const s = createBattle([inst('portatil', 'p')], [inst('raton', 'w')], 'wild');
    const steps = viewSteps(introEvents(s), ctx(s));
    expect(steps).toEqual([
      {
        type: 'show',
        who: 'opponent',
        uid: 'w',
        speciesId: 'raton',
        name: 'Ratón salvaje',
        hp: 30,
        maxHp: 30,
      },
      { type: 'sound', key: 'assets/audio/sfx/cry_raton.ogg' },
      { type: 'message', text: '¡Un Ratón salvaje aparece!' },
      { type: 'show', who: 'player', uid: 'p', speciesId: 'portatil', name: 'Portátil', hp: 40, maxHp: 40 },
      { type: 'sound', key: 'assets/audio/sfx/cry_portatil.ogg' },
      { type: 'message', text: '¡Adelante, Portátil!' },
    ]);
  });

  it('names NPC flexymon "rival"', () => {
    const s = createBattle([inst('portatil', 'p')], [inst('raton', 'w')], 'npc');
    const steps = viewSteps(introEvents(s), ctx(s));
    expect(texts(steps)[0]).toBe('¡El rival saca a Ratón!');
    expect(steps[0]).toMatchObject({ name: 'Ratón rival' });
  });
});

describe('battle-view: a round', () => {
  it('plays attack message, sound, hit and HP from the events (no maths here)', () => {
    const s = createBattle([inst('portatil', 'p')], [inst('raton', 'w')], 'wild');
    // Ratón (faster) uses pulsacion: 10 damage; Portátil compila: 18 damage.
    const rng = scriptedRng({ pick: [0], int: [50, 50], float: [1, 1] });
    const step = chooseAction(s, { type: 'attack', attackId: 'compilar' }, { data, rng });
    expect(viewSteps(step.events, ctx(s))).toEqual([
      { type: 'message', text: '¡Ratón salvaje usa Pulsación!' },
      { type: 'sound', key: 'assets/audio/sfx/pulsacion.ogg' },
      { type: 'hit', who: 'player' },
      { type: 'hp', who: 'player', hp: 30, maxHp: 40 },
      { type: 'message', text: '¡Portátil usa Compilar!' },
      { type: 'sound', key: 'assets/audio/sfx/compilar.ogg' },
      { type: 'hit', who: 'opponent' },
      { type: 'hp', who: 'opponent', hp: 12, maxHp: 30 },
    ]);
  });

  it('a miss, a debuff and its end become messages', () => {
    const s = createBattle([inst('portatil', 'p')], [inst('raton', 'w')], 'wild');
    const evs: BattleEvent[] = [
      { type: 'miss', who: 'player', uid: 'p' },
      { type: 'modifier', who: 'opponent', uid: 'w', kind: 'debuff', stat: 'defense', percent: 25, turns: 3 },
      { type: 'modifier', who: 'player', uid: 'p', kind: 'buff', stat: 'attack', percent: 25, turns: 3 },
      { type: 'modifier_end', who: 'player', uid: 'p', kind: 'buff', stat: 'attack' },
    ];
    expect(texts(viewSteps(evs, ctx(s)))).toEqual([
      '¡Ha fallado!',
      '¡Defensa de Ratón salvaje baja!',
      '¡Ataque de Portátil sube!',
      'Ataque de Portátil vuelve a la normalidad.',
    ]);
  });

  it('heal, revive, item and flee messages', () => {
    const s = createBattle([inst('portatil', 'p')], [inst('raton', 'w')], 'wild');
    const evs: BattleEvent[] = [
      { type: 'item', who: 'player', itemId: 'cafe', targetUid: 'p' },
      { type: 'heal', who: 'player', uid: 'p', amount: 12, hp: 40, maxHp: 40 },
      { type: 'revive', who: 'player', uid: 'p', hp: 20, maxHp: 40 },
      { type: 'flee', who: 'player' },
      { type: 'end', result: 'fled' },
    ];
    const steps = viewSteps(evs, ctx(s));
    expect(texts(steps)).toEqual([
      'Usas Café con Portátil.',
      'Portátil recupera 12 PS.',
      '¡Portátil vuelve a estar en pie!',
      '¡Escapas sin problemas!',
    ]);
    expect(steps.filter((x) => x.type === 'hp')).toEqual([
      { type: 'hp', who: 'player', hp: 40, maxHp: 40 },
      { type: 'hp', who: 'player', hp: 20, maxHp: 40 },
    ]);
    expect(steps.at(-1)).toEqual({ type: 'end', result: 'fled' });
  });

  it('faint, win and lose', () => {
    const s = createBattle([inst('portatil', 'p')], [inst('raton', 'w')], 'wild');
    const win = viewSteps(
      [
        { type: 'faint', who: 'opponent', uid: 'w' },
        { type: 'end', result: 'win' },
      ],
      ctx(s),
    );
    expect(win).toEqual([
      { type: 'faint', who: 'opponent' },
      { type: 'message', text: '¡Ratón salvaje se ha debilitado!' },
      { type: 'message', text: '¡Has ganado el combate!' },
      { type: 'end', result: 'win' },
    ]);
    const lose = viewSteps([{ type: 'end', result: 'lose' }], ctx(s));
    expect(texts(lose)).toEqual(['No te quedan flexymon en pie...']);
  });
});

describe('battle-view: switches', () => {
  it('a voluntary switch calls the old one back and shows the new one with the HP it has then', () => {
    const s = createBattle(
      [inst('portatil', 'p'), inst('teclado', 'k', { currentHp: 20 })],
      [inst('raton', 'w')],
      'wild',
    );
    // Teclado comes in, then Ratón hits it for 7 (35×10/12×0.3 = 8.75 → 8 at r = 1.0).
    const rng = scriptedRng({ pick: [0], int: [50], float: [1] });
    const step = chooseAction(s, { type: 'switch', uid: 'k' }, { data, rng });
    const steps = viewSteps(step.events, ctx(s));
    expect(steps.slice(0, 5)).toEqual([
      { type: 'message', text: '¡Vuelve, Portátil!' },
      { type: 'withdraw', who: 'player' },
      { type: 'show', who: 'player', uid: 'k', speciesId: 'teclado', name: 'Teclado', hp: 20, maxHp: 38 },
      { type: 'sound', key: 'assets/audio/sfx/cry_teclado.ogg' },
      { type: 'message', text: '¡Adelante, Teclado!' },
    ]);
    const hp = steps.find((x) => x.type === 'hp');
    expect(hp).toEqual({ type: 'hp', who: 'player', hp: 12, maxHp: 38 });
  });

  it('after a faint: need_switch, and the free switch does not call back the fainted one', () => {
    const s = createBattle(
      [inst('portatil', 'p', { currentHp: 5 }), inst('teclado', 'k')],
      [inst('raton', 'w')],
      'wild',
    );
    // Ratón first: pulsacion, 10 damage → Portátil faints.
    const r1 = chooseAction(
      s,
      { type: 'attack', attackId: 'compilar' },
      { data, rng: scriptedRng({ pick: [0], int: [50], float: [1] }) },
    );
    const steps = viewSteps(r1.events, ctx(s));
    expect(steps.slice(-3)).toEqual([
      { type: 'faint', who: 'player' },
      { type: 'message', text: '¡Portátil se ha debilitado!' },
      { type: 'need_switch' },
    ]);
    const r2 = chooseAction(r1.state, { type: 'switch', uid: 'k' }, { data, rng: scriptedRng({}) });
    expect(texts(viewSteps(r2.events, ctx(r1.state)))).toEqual(['¡Adelante, Teclado!']);
  });

  it("an NPC's next flexymon comes in with a message", () => {
    const s = createBattle(
      [inst('portatil', 'p')],
      [inst('raton', 'w', { currentHp: 1 }), inst('teclado', 'k')],
      'npc',
    );
    const evs: BattleEvent[] = [{ type: 'switch', who: 'opponent', fromUid: 'w', toUid: 'k' }];
    const steps = viewSteps(evs, ctx(s));
    expect(steps[0]).toMatchObject({ type: 'show', who: 'opponent', name: 'Teclado rival', hp: 38 });
    expect(texts(steps)).toEqual(['¡El rival saca a Teclado!']);
  });

  it('throws on an unknown uid', () => {
    const s = createBattle([inst('portatil', 'p')], [inst('raton', 'w')], 'wild');
    expect(() => viewSteps([{ type: 'faint', who: 'player', uid: 'nobody' }], ctx(s))).toThrow();
  });
});

describe('battle-view: menus', () => {
  it('main menu: Huir only against wild flexymon', () => {
    const wild = createBattle([inst('portatil')], [inst('raton')], 'wild');
    const npc = createBattle([inst('portatil')], [inst('raton')], 'npc');
    expect(mainMenu(wild, data, t)).toEqual([
      { id: 'attack', label: 'Atacar', enabled: true },
      { id: 'item', label: 'Objeto', enabled: true },
      { id: 'switch', label: 'Cambiar', enabled: true },
      { id: 'flee', label: 'Huir', enabled: true },
    ]);
    expect(mainMenu(npc, data, t)[3]).toMatchObject({ id: 'flee', enabled: false });
  });

  it('attack menu lists the species attacks with accuracy', () => {
    const s = createBattle([inst('portatil')], [inst('raton')], 'wild');
    expect(attackMenu(s, data, t)).toEqual([
      { id: 'compilar', label: 'Compilar', enabled: true, accuracy: 'Precisión 95 %' },
      { id: 'pantallazo_azul', label: 'Pantallazo azul', enabled: true, accuracy: 'Precisión 80 %' },
      { id: 'actualizacion', label: 'Actualización', enabled: true, accuracy: 'Precisión 100 %' },
    ]);
  });

  it('team menu greys out the active and fainted members', () => {
    const s = createBattle(
      [inst('portatil', 'p', { currentHp: 31 }), inst('teclado', 'k', { currentHp: 0 }), inst('raton', 'r')],
      [inst('raton')],
      'wild',
    );
    const rows = teamMenu(s, data, t);
    expect(rows.map((r) => [r.id, r.enabled, r.active, r.fainted, r.hpText])).toEqual([
      ['p', false, true, false, 'PS 31/40'],
      ['k', false, false, true, 'PS 0/38'],
      ['r', true, false, false, 'PS 30/30'],
    ]);
    expect(rows[0]?.icon).toBe('assets/sprites/flexymon/portatil_icon.png');
  });
});

describe('battle-view: hpColor', () => {
  it('green from 50 %, yellow from 20 %, red below', () => {
    expect(hpColor(40, 40)).toBe('green');
    expect(hpColor(20, 40)).toBe('green');
    expect(hpColor(19, 40)).toBe('yellow');
    expect(hpColor(8, 40)).toBe('yellow');
    expect(hpColor(7, 40)).toBe('red');
    expect(hpColor(0, 40)).toBe('red');
    expect(hpColor(0, 0)).toBe('red');
  });
});

describe('battle-view: catching (M7)', () => {
  it('words every outcome of taking a wild flexymon', () => {
    expect(catchMessages({ type: 'added', to: 'team', uid: 'u' }, 'Ratón', t)).toEqual([
      '¡Ratón se une a tu equipo!',
    ]);
    expect(catchMessages({ type: 'added', to: 'storage', uid: 'u' }, 'Ratón', t)).toEqual([
      'Tu equipo está lleno. Ratón se ha enviado a la caja.',
    ]);
    expect(catchMessages({ type: 'merged', uid: 'u', stat: 'attack', amount: 1 }, 'Ratón', t)).toEqual([
      '¡Ratón se ha fusionado! Ataque +1',
    ]);
    expect(catchMessages({ type: 'merged', uid: 'u', stat: 'hp', amount: 3 }, 'Ratón', t)).toEqual([
      '¡Ratón se ha fusionado! PS +3',
    ]);
    expect(catchMessages({ type: 'maxed', uid: 'u' }, 'Ratón', t)).toEqual(['Ratón ya está al máximo']);
  });
});
