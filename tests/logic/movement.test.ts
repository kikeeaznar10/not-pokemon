import { describe, expect, it } from 'vitest';
import { TURN_TAP_MS, WALK_MS } from '../../src/logic/constants';
import {
  createMoveState,
  renderPosition,
  updateMovement,
  walkFrame,
  type BlockedFn,
  type MoveState,
} from '../../src/logic/movement';
import type { Facing } from '../../src/data/schemas';

const open = () => false;
const wallAt = (wx: number, wy: number) => (x: number, y: number) => x === wx && y === wy;

/** Run `frames` updates of `dt` ms with `dir` held. */
function run(s: MoveState, dir: Facing | null, frames: number, dt = 16, blocked: BlockedFn = open) {
  const events = [];
  for (let i = 0; i < frames; i += 1) {
    const r = updateMovement(s, dir, dt, blocked);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}

describe('grid movement', () => {
  it('constants: 200 ms per tile, 100 ms tap', () => {
    expect(WALK_MS).toBe(200);
    expect(TURN_TAP_MS).toBe(100);
  });

  it('pressing the faced direction steps at once and always finishes exactly one tile', () => {
    let s = createMoveState(5, 5, 'down');
    const first = updateMovement(s, 'down', 16, open);
    expect(first.events).toEqual([{ type: 'step_start', from: { x: 5, y: 5 }, to: { x: 5, y: 6 } }]);
    // Released after one frame: the step still completes.
    s = run(first.state, null, 20).state;
    expect(s).toMatchObject({ x: 5, y: 6, step: null });
  });

  it('a short tap in a new direction only turns', () => {
    let s = createMoveState(5, 5, 'down');
    const r = updateMovement(s, 'left', 16, open);
    expect(r.events).toEqual([{ type: 'turn', facing: 'left' }]);
    s = run(r.state, 'left', 5).state; // 80 ms held in total
    s = run(s, null, 10).state;
    expect(s).toMatchObject({ x: 5, y: 5, facing: 'left', step: null });
  });

  it('holding a new direction for 100 ms starts walking', () => {
    let s = updateMovement(createMoveState(5, 5, 'down'), 'left', 16, open).state;
    s = run(s, 'left', 6, 16).state; // 96 ms
    expect(s.step).toBeNull();
    const r = updateMovement(s, 'left', 16, open); // 112 ms
    expect(r.events[0]).toMatchObject({ type: 'step_start', to: { x: 4, y: 5 } });
  });

  it('holding walks continuously: the next step starts in the same frame, carrying leftover time', () => {
    let s = updateMovement(createMoveState(0, 0, 'right'), 'right', 0, open).state;
    s = run(s, 'right', 1, 150).state;
    const r = updateMovement(s, 'right', 100, open); // 250 ms: step ends with 50 ms left over
    expect(r.events).toEqual([
      { type: 'step_end', x: 1, y: 0 },
      { type: 'step_start', from: { x: 1, y: 0 }, to: { x: 2, y: 0 } },
    ]);
    expect(r.state.step?.elapsed).toBe(50);
    s = run(r.state, 'right', 10, 100).state; // 1000 ms more = 5 tiles
    expect(s.x + (s.step ? 0 : 0)).toBe(6);
  });

  it('changing direction while walking needs no turn delay', () => {
    let s = updateMovement(createMoveState(0, 0, 'right'), 'right', 0, open).state;
    const r = updateMovement(s, 'down', WALK_MS, open);
    expect(r.events).toEqual([
      { type: 'step_end', x: 1, y: 0 },
      { type: 'turn', facing: 'down' },
      { type: 'step_start', from: { x: 1, y: 0 }, to: { x: 1, y: 1 } },
    ]);
    s = r.state;
    expect(s.facing).toBe('down');
  });

  it('a blocked tile only turns the player; holding against it never moves', () => {
    const blocked = wallAt(4, 5);
    let s = createMoveState(5, 5, 'left');
    s = run(s, 'left', 30, 16, blocked).state;
    expect(s).toMatchObject({ x: 5, y: 5, facing: 'left', step: null });
    // Walking into a wall mid-walk stops on the grid, facing it.
    s = updateMovement(createMoveState(7, 5, 'left'), 'left', 0, open).state;
    s = run(s, 'left', 40, 16, blocked).state;
    expect(s).toMatchObject({ x: 5, y: 5, step: null });
    // Turning towards a wall after a step.
    s = updateMovement(createMoveState(5, 4, 'down'), 'down', 0, open).state;
    const r = updateMovement(s, 'left', WALK_MS, blocked);
    expect(r.state).toMatchObject({ x: 5, y: 5, facing: 'left', step: null });
  });

  it('a fresh press always counts as a new press (a quick second tap is not one long hold)', () => {
    // Tap 1 turns; its release and tap 2 happen between frames, so `dir` looks held throughout.
    let s = updateMovement(createMoveState(5, 5, 'down'), 'up', 16, open).state;
    expect(s.facing).toBe('up');
    const held = updateMovement(s, 'up', 16, open);
    expect(held.state.step).toBeNull(); // without freshPress: still the turn-hold
    s = updateMovement(s, 'up', 16, open, true).state;
    expect(s.step?.to).toEqual({ x: 5, y: 4 });
    // While stepping, freshPress changes nothing.
    expect(updateMovement(s, 'up', 16, open, true).state.step?.elapsed).toBe(16);
  });

  it('render position interpolates between tiles; frame 1 in the first half of a step', () => {
    let s = updateMovement(createMoveState(2, 3, 'right'), 'right', 0, open).state;
    expect(walkFrame(s)).toBe(1);
    s = updateMovement(s, 'right', 150, open).state;
    expect(renderPosition(s)).toEqual({ x: 2.75, y: 3 });
    expect(walkFrame(s)).toBe(0);
    s = updateMovement(s, null, 100, open).state;
    expect(renderPosition(s)).toEqual({ x: 3, y: 3 });
    expect(walkFrame(s)).toBe(0);
  });
});
