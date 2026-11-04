import { describe, expect, it } from 'vitest';
import { moveCursor } from '../../src/ui/cursor';

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
