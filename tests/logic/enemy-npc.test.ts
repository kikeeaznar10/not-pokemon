import { describe, expect, it } from 'vitest';
import {
  findSpotter,
  isEnemy,
  loseBattle,
  npcTeam,
  placedEnemies,
  refreshCooldowns,
  winAgainstNpc,
  type Lookout,
} from '../../src/logic/enemy-npc';
import { newGameState } from '../../src/logic/new-game';
import type { GameState } from '../../src/logic/save';
import { EUROS_MAX } from '../../src/logic/constants';
import { gameData, inst, scriptedRng } from './helpers';

const open = () => false;
const becario = (over: Partial<Lookout> = {}): Lookout => ({
  id: 'becario',
  x: 10,
  y: 5,
  facing: 'left',
  sight: 4,
  free: true,
  ...over,
});

function state(over: Partial<GameState> = {}): GameState {
  return { ...newGameState(gameData(), scriptedRng({}), 'Ana'), ...over };
}

describe('findSpotter', () => {
  it('a ready NPC 4 tiles away in a straight line sees the player, 5 tiles away does not', () => {
    expect(findSpotter([becario()], {}, { x: 6, y: 5 }, open)).toEqual({
      id: 'becario',
      distance: 4,
      path: [
        { x: 9, y: 5 },
        { x: 8, y: 5 },
        { x: 7, y: 5 },
      ],
    });
    expect(findSpotter([becario()], {}, { x: 5, y: 5 }, open)).toBeNull();
  });

  it('a wall (or NPC) between them hides the player', () => {
    const wall = (x: number, y: number) => x === 8 && y === 5;
    expect(findSpotter([becario()], {}, { x: 6, y: 5 }, wall)).toBeNull();
  });

  it('an adjacent NPC needs no path', () => {
    expect(findSpotter([becario()], {}, { x: 9, y: 5 }, open)).toEqual({
      id: 'becario',
      distance: 1,
      path: [],
    });
  });

  it('cooldown or busy NPCs never look; the first that sees wins', () => {
    const p = { x: 8, y: 5 };
    expect(findSpotter([becario()], { becario: 'cooldown' }, p, open)).toBeNull();
    expect(findSpotter([becario({ free: false })], {}, p, open)).toBeNull();
    const other = becario({ id: 'otro', x: 8, y: 2, facing: 'down' });
    expect(findSpotter([becario({ free: false }), other], {}, p, open)?.id).toBe('otro');
    expect(findSpotter([becario(), other], {}, p, open)?.id).toBe('becario');
  });
});

describe('npcTeam', () => {
  it('makes fresh full-HP instances of the team, in order', () => {
    const team = npcTeam({ id: 'b', team: ['raton', 'teclado'] }, gameData().flexymon, scriptedRng({}));
    expect(team.map((m) => [m.speciesId, m.currentHp, m.bonus])).toEqual([
      ['raton', 30, { hp: 0, attack: 0, defense: 0, speed: 0 }],
      ['teclado', gameData().flexymon.get('teclado')!.stats.hp, { hp: 0, attack: 0, defense: 0, speed: 0 }],
    ]);
    expect(new Set(team.map((m) => m.uid)).size).toBe(2);
  });

  it('throws on an unknown species', () => {
    expect(() => npcTeam({ id: 'b', team: ['nadie'] }, gameData().flexymon, scriptedRng({}))).toThrow(
      /nadie/,
    );
  });
});

describe('winAgainstNpc', () => {
  it('pays rng.int(min, max) and puts the NPC in cooldown', () => {
    const rng = scriptedRng({ int: [112] });
    const r = winAgainstNpc(state({ euros: 200 }), { id: 'becario', reward: { min: 80, max: 140 } }, rng);
    expect(r.reward).toBe(112);
    expect(r.state.euros).toBe(312);
    expect(r.state.npcs).toEqual({ becario: 'cooldown' });
    expect(rng.remaining().int).toEqual([]);
  });

  it('never goes past the euro maximum', () => {
    const r = winAgainstNpc(
      state({ euros: EUROS_MAX - 10 }),
      { id: 'b', reward: { min: 50, max: 50 } },
      scriptedRng({ int: [50] }),
    );
    expect(r.state.euros).toBe(EUROS_MAX);
  });
});

describe('loseBattle (Losing rule)', () => {
  it('halves the euros (floor), heals team and storage, resets every NPC, moves to the respawn', () => {
    const before = state({
      euros: 341,
      player: { name: 'Ana', map: 'test_east', x: 3, y: 4, facing: 'left' },
      team: [inst('portatil', 'a', { currentHp: 0 }), inst('raton', 'b', { currentHp: 7 })],
      storage: [inst('teclado', 'c', { currentHp: 1 })],
      npcs: { becario: 'cooldown', otro: 'ready' },
    });
    const after = loseBattle(before, gameData());
    expect(after.euros).toBe(170);
    expect(after.team.map((m) => m.currentHp)).toEqual([40, 30]);
    expect(after.storage[0]!.currentHp).toBe(gameData().flexymon.get('teclado')!.stats.hp);
    expect(after.npcs).toEqual({ becario: 'ready', otro: 'ready' });
    expect(after.player).toEqual({ name: 'Ana', ...gameData().start.respawn });
    expect(before.euros).toBe(341); // not mutated
  });
});

describe('cooldowns', () => {
  const data = gameData();
  it('placedEnemies uses live positions on this map and spawns elsewhere; talkers are left out', () => {
    const list = placedEnemies(data.npcs.values(), 'test_east', new Map([['becario_rio', { x: 3, y: 3 }]]));
    expect(list).toEqual([{ id: 'becario_rio', map: 'test_east', x: 3, y: 3 }]);
    const elsewhere = placedEnemies(data.npcs.values(), 'test', new Map());
    expect(elsewhere).toEqual([{ id: 'becario_rio', map: 'test_east', x: 10, y: 13 }]);
  });

  it('a beaten NPC is ready again more than 6 tiles away or on another map', () => {
    const npcs = [{ id: 'b', map: 'm', x: 10, y: 10 }];
    const states = { b: 'cooldown' as const };
    expect(refreshCooldowns(states, npcs, { map: 'm', x: 13, y: 13 })).toBe(states); // 6: unchanged object
    expect(refreshCooldowns(states, npcs, { map: 'm', x: 14, y: 13 })).toEqual({ b: 'ready' }); // 7
    expect(refreshCooldowns(states, npcs, { map: 'otro', x: 10, y: 11 })).toEqual({ b: 'ready' });
  });

  it('isEnemy narrows the NPC union', () => {
    expect([...data.npcs.values()].filter(isEnemy).map((n) => n.id)).toEqual(['becario_rio']);
  });
});
