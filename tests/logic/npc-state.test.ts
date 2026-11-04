import { describe, expect, it } from 'vitest';
import {
  approachPath,
  canSee,
  cooldownEnds,
  manhattan,
  markDefeated,
  npcState,
  resetAllNpcs,
  sightDistance,
  talkOutcome,
  updateCooldowns,
  type Watcher,
} from '../../src/logic/npc-state';

const npc: Watcher = { x: 10, y: 5, facing: 'left', sight: 4 };
const open = () => false;

describe('enemy NPC state', () => {
  it('sees the player 4 tiles away in a straight line in front, not 5', () => {
    expect(sightDistance(npc, { x: 6, y: 5 }, open)).toBe(4);
    expect(sightDistance(npc, { x: 9, y: 5 }, open)).toBe(1);
    expect(sightDistance(npc, { x: 5, y: 5 }, open)).toBeNull();
  });

  it('does not see behind, beside or diagonally', () => {
    expect(sightDistance(npc, { x: 12, y: 5 }, open)).toBeNull();
    expect(sightDistance(npc, { x: 9, y: 6 }, open)).toBeNull();
    expect(sightDistance({ ...npc, facing: 'down' }, { x: 10, y: 8 }, open)).toBe(3);
    expect(sightDistance({ ...npc, facing: 'up' }, { x: 10, y: 1 }, open)).toBe(4);
    expect(sightDistance({ ...npc, facing: 'right' }, { x: 11, y: 5 }, open)).toBe(1);
  });

  it('a wall or NPC between them blocks the view', () => {
    const wallAt8 = (x: number, y: number) => x === 8 && y === 5;
    expect(sightDistance(npc, { x: 6, y: 5 }, wallAt8)).toBeNull();
    expect(sightDistance(npc, { x: 9, y: 5 }, wallAt8)).toBe(1);
  });

  it('only a ready NPC spots the player', () => {
    expect(canSee('ready', npc, { x: 7, y: 5 }, open)).toBe(true);
    expect(canSee('cooldown', npc, { x: 7, y: 5 }, open)).toBe(false);
  });

  it('walks until adjacent', () => {
    expect(approachPath(npc, { x: 6, y: 5 })).toEqual([
      { x: 9, y: 5 },
      { x: 8, y: 5 },
      { x: 7, y: 5 },
    ]);
    expect(approachPath(npc, { x: 9, y: 5 })).toEqual([]);
  });

  it('cooldown ends at Manhattan distance > 6 or on another map', () => {
    expect(manhattan({ x: 0, y: 0 }, { x: 3, y: -4 })).toBe(7);
    expect(cooldownEnds({ x: 0, y: 0 }, { x: 3, y: 3 }, true)).toBe(false);
    expect(cooldownEnds({ x: 0, y: 0 }, { x: 4, y: 3 }, true)).toBe(true);
    expect(cooldownEnds({ x: 0, y: 0 }, { x: 0, y: 0 }, false)).toBe(true);
  });

  it('beaten NPCs talk with defeatDialogue, return to ready when far, and all reset on a loss', () => {
    let states = markDefeated({}, 'becario');
    expect(npcState(states, 'becario')).toBe('cooldown');
    expect(npcState(states, 'otro')).toBe('ready');
    expect(talkOutcome('cooldown')).toBe('defeat_dialogue');
    expect(talkOutcome('ready')).toBe('battle');
    const placed = [{ id: 'becario', map: 'valencia', x: 40, y: 22 }];
    expect(updateCooldowns(states, placed, { map: 'valencia', x: 43, y: 22 }).becario).toBe('cooldown');
    expect(updateCooldowns(states, placed, { map: 'valencia', x: 47, y: 22 }).becario).toBe('ready');
    expect(updateCooldowns(states, placed, { map: 'murcia', x: 40, y: 22 }).becario).toBe('ready');
    states = { a: 'cooldown', b: 'ready' };
    expect(resetAllNpcs(states)).toEqual({ a: 'ready', b: 'ready' });
  });
});
