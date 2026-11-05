import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng';
import { WALK_MS } from '../../src/logic/constants';
import { createMoveState, updateMovement, type MoveState } from '../../src/logic/movement';
import {
  arrivalTile,
  createNpcMove,
  distanceToArea,
  endTalk,
  engage,
  faceTo,
  forceStep,
  inWanderArea,
  nextWait,
  occupiedTiles,
  oppositeFacing,
  startTalk,
  updateNpcMove,
  wanderChoices,
  type NpcMove,
  type WanderArea,
} from '../../src/logic/npc-wander';
import { scriptedRng } from './helpers';

const area: WanderArea = { x: 2, y: 3, width: 4, height: 3, stepEveryMs: [100, 300] };
const open = () => false;

describe('helpers', () => {
  it('opposite facings', () => {
    expect(oppositeFacing('up')).toBe('down');
    expect(oppositeFacing('down')).toBe('up');
    expect(oppositeFacing('left')).toBe('right');
    expect(oppositeFacing('right')).toBe('left');
  });
  it('wander area bounds are inclusive at the start and exclusive at the end', () => {
    expect(inWanderArea(area, 2, 3)).toBe(true);
    expect(inWanderArea(area, 5, 5)).toBe(true);
    expect(inWanderArea(area, 6, 5)).toBe(false);
    expect(inWanderArea(area, 2, 2)).toBe(false);
  });
  it('a still NPC waits forever', () => {
    expect(nextWait(null, createRng(1))).toBe(Infinity);
    const s = createNpcMove(1, 1, 'down', null, createRng(1));
    const r = updateNpcMove(s, null, 1_000_000, open, createRng(1));
    expect(r.state).toEqual(s);
    expect(r.events).toEqual([]);
  });
  it('choices stay inside the area and skip blocked tiles', () => {
    expect(wanderChoices({ x: 2, y: 3 }, area, open)).toEqual(['down', 'right']);
    expect(wanderChoices({ x: 2, y: 3 }, area, (x) => x === 3)).toEqual(['down']);
  });
});

describe('updateNpcMove', () => {
  it('waits, then steps one tile in a picked direction and stops on the grid', () => {
    const rng = scriptedRng({ int: [200, 150], pick: [1] });
    let s = createNpcMove(3, 4, 'down', area, rng);
    expect(s.waitMs).toBe(200);
    let r = updateNpcMove(s, area, 199, open, rng);
    expect(r.events).toEqual([]);
    r = updateNpcMove(r.state, area, 1, open, rng);
    // choices from (3,4): up, down, left, right → pick index 1 = down
    expect(r.events).toEqual([{ type: 'step_start', from: { x: 3, y: 4 }, to: { x: 3, y: 5 } }]);
    s = r.state;
    expect(occupiedTiles(s)).toEqual([
      { x: 3, y: 4 },
      { x: 3, y: 5 },
    ]);
    expect(arrivalTile(s)).toEqual({ x: 3, y: 5 });
    r = updateNpcMove(s, area, WALK_MS, open, rng);
    expect(r.events).toEqual([{ type: 'step_end', x: 3, y: 5 }]);
    expect(r.state).toMatchObject({ x: 3, y: 5, step: null, waitMs: 150 });
  });

  it('turns when stepping in a new direction', () => {
    const rng = scriptedRng({ int: [0], pick: [0] });
    const s = createNpcMove(3, 4, 'down', area, rng);
    const r = updateNpcMove(s, area, 1, open, rng);
    expect(r.events[0]).toEqual({ type: 'turn', facing: 'up' });
    expect(r.state.facing).toBe('up');
  });

  it('waits again when boxed in', () => {
    const rng = scriptedRng({ int: [0, 250] });
    const s = createNpcMove(3, 4, 'down', area, rng);
    const r = updateNpcMove(s, area, 1, () => true, rng);
    expect(r.events).toEqual([]);
    expect(r.state.waitMs).toBe(250);
  });

  it('never leaves its rectangle or enters a blocked tile (long seeded run)', () => {
    const rng = createRng(2026);
    const wall = (x: number, y: number) => x === 4 && y === 4;
    let s = createNpcMove(2, 3, 'down', area, rng);
    const visited = new Set<string>();
    for (let i = 0; i < 20_000; i += 1) {
      s = updateNpcMove(s, area, 16, wall, rng).state;
      for (const p of occupiedTiles(s)) {
        expect(inWanderArea(area, p.x, p.y)).toBe(true);
        expect(wall(p.x, p.y)).toBe(false);
      }
      visited.add(`${s.x},${s.y}`);
    }
    expect(visited.size).toBe(11); // every tile of the 4 × 3 area but the wall
  });
});

describe('talking', () => {
  it('a standing NPC turns at once and stops wandering until the talk ends', () => {
    const rng = scriptedRng({ int: [0, 500] });
    let s: NpcMove = startTalk(createNpcMove(3, 4, 'down', area, rng), 'left');
    expect(s).toMatchObject({ facing: 'right', talking: true });
    const r = updateNpcMove(s, area, 10_000, open, rng);
    expect(r.events).toEqual([]);
    s = endTalk(r.state, area, rng);
    expect(s).toMatchObject({ talking: false, waitMs: 500 });
  });

  it('a stepping NPC finishes its step, then turns', () => {
    const rng = scriptedRng({ int: [0, 999], pick: [3] });
    let s = updateNpcMove(createNpcMove(3, 4, 'down', area, rng), area, 1, open, rng).state;
    expect(s.step?.to).toEqual({ x: 4, y: 4 });
    s = startTalk(s, 'up');
    expect(s.facing).toBe('right');
    const r = updateNpcMove(s, area, WALK_MS, open, rng);
    expect(r.events).toEqual([
      { type: 'step_end', x: 4, y: 4 },
      { type: 'turn', facing: 'down' },
    ]);
    expect(r.state).toMatchObject({ x: 4, y: 4, facing: 'down', turnTo: null, talking: true });
  });
});

describe('player and NPC never share a tile', () => {
  it('holds over a long random run where both walk into each other', () => {
    const rng = createRng(7);
    const playerRng = createRng(99);
    const box: WanderArea = { x: 0, y: 0, width: 3, height: 3, stepEveryMs: [0, 50] };
    const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < 3 && y < 3;
    let npc = createNpcMove(1, 1, 'down', box, rng);
    let player: MoveState = createMoveState(0, 0, 'down');
    const playerTiles = (p: MoveState) => (p.step ? [{ x: p.x, y: p.y }, p.step.to] : [{ x: p.x, y: p.y }]);
    const dirs = ['up', 'down', 'left', 'right'] as const;
    let dir: (typeof dirs)[number] = 'right';
    for (let i = 0; i < 20_000; i += 1) {
      npc = updateNpcMove(
        npc,
        box,
        16,
        (x, y) => playerTiles(player).some((p) => p.x === x && p.y === y),
        rng,
      ).state;
      if (i % 20 === 0) dir = playerRng.pick(dirs);
      player = updateMovement(
        player,
        dir,
        16,
        (x, y) => !inside(x, y) || occupiedTiles(npc).some((p) => p.x === x && p.y === y),
      ).state;
      const taken = occupiedTiles(npc);
      for (const p of playerTiles(player)) expect(taken.some((q) => q.x === p.x && q.y === p.y)).toBe(false);
    }
  });
});

describe('enemy approach (M8)', () => {
  it('engage pauses wandering without turning; endTalk resumes', () => {
    const s = engage(createNpcMove(3, 4, 'left', area, scriptedRng({ int: [100] })));
    expect(s).toMatchObject({ talking: true, facing: 'left', turnTo: null });
    const r = updateNpcMove(s, area, 1000, open, scriptedRng({}));
    expect(r.events).toEqual([]);
    expect(r.state.step).toBeNull();
    expect(endTalk(s, area, scriptedRng({ int: [150] }))).toMatchObject({ talking: false, waitMs: 150 });
  });

  it('forceStep walks one adjacent tile (even out of the rectangle), facing it', () => {
    const s = engage(createNpcMove(2, 4, 'down', area, scriptedRng({ int: [100] })));
    const stepping = forceStep(s, { x: 1, y: 4 });
    expect(stepping).toMatchObject({
      facing: 'left',
      step: { from: { x: 2, y: 4 }, to: { x: 1, y: 4 }, elapsed: 0 },
    });
    expect(forceStep(stepping, { x: 0, y: 4 })).toBe(stepping); // busy: unchanged
    const done = updateNpcMove(stepping, area, WALK_MS, open, scriptedRng({ int: [100] }));
    expect(done.state).toMatchObject({ x: 1, y: 4, step: null, talking: true });
    expect(() => forceStep(s, { x: 4, y: 4 })).toThrow(/not next to/);
  });

  it('faceTo turns at once when standing, after the step otherwise', () => {
    const s = createNpcMove(3, 4, 'left', null, scriptedRng({}));
    expect(faceTo(s, 'up')).toMatchObject({ facing: 'up', turnTo: null });
    const stepping = forceStep(s, { x: 3, y: 5 });
    expect(faceTo(stepping, 'up')).toMatchObject({ facing: 'down', turnTo: 'up' });
  });

  it('outside its rectangle an NPC only steps back towards it', () => {
    expect(distanceToArea(area, 3, 4)).toBe(0);
    expect(distanceToArea(area, 0, 4)).toBe(2);
    expect(distanceToArea(area, 7, 7)).toBe(4); // dx 2 (past x 5) + dy 2 (past y 5)
    expect(wanderChoices({ x: 0, y: 4 }, area, open)).toEqual(['right']);
    expect(wanderChoices({ x: 7, y: 7 }, area, open)).toEqual(['up', 'left']);
    expect(wanderChoices({ x: 7, y: 7 }, area, (x) => x === 6)).toEqual(['up']);
  });
});
