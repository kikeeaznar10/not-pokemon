import { describe, expect, it } from 'vitest';
import { moveCursor, moveGridCursor } from '../../src/ui/cursor';

describe('moveCursor', () => {
  it('moves and wraps both ways', () => {
    expect(moveCursor(0, 1, 2)).toBe(1);
    expect(moveCursor(1, 1, 2)).toBe(0);
    expect(moveCursor(0, -1, 3)).toBe(2);
    expect(moveCursor(5, 0, 3)).toBe(2);
  });
  it('returns 0 with no options', () => {
    expect(moveCursor(3, 1, 0)).toBe(0);
  });
});

describe('moveGridCursor', () => {
  // 2 × 2: 0 1 / 2 3
  it('moves on the grid without wrapping', () => {
    expect(moveGridCursor(0, 1, 0, 2, 4)).toBe(1);
    expect(moveGridCursor(1, 1, 0, 2, 4)).toBe(1);
    expect(moveGridCursor(0, 0, 1, 2, 4)).toBe(2);
    expect(moveGridCursor(2, 0, 1, 2, 4)).toBe(2);
    expect(moveGridCursor(3, -1, 0, 2, 4)).toBe(2);
    expect(moveGridCursor(3, 0, -1, 2, 4)).toBe(1);
    expect(moveGridCursor(0, -1, 0, 2, 4)).toBe(0);
    expect(moveGridCursor(0, 0, -1, 2, 4)).toBe(0);
  });
  it('never lands past the last option', () => {
    expect(moveGridCursor(1, 0, 1, 2, 3)).toBe(1);
    expect(moveGridCursor(0, 0, 1, 1, 3)).toBe(1);
    expect(moveGridCursor(2, 0, 1, 1, 3)).toBe(2);
  });
  it('returns 0 with no options or columns', () => {
    expect(moveGridCursor(2, 1, 0, 2, 0)).toBe(0);
    expect(moveGridCursor(2, 1, 0, 0, 4)).toBe(0);
  });
});
