import { describe, expect, it } from 'vitest';
import { DPAD_DEAD_ZONE } from '../../src/logic/constants';
import { TOUCH_BUTTONS, TOUCH_MIN_PX, dpadDirection, isTouchDevice } from '../../src/ui/touch-controls';
import { isPortrait } from '../../src/ui/rotate-screen';

describe('touch controls', () => {
  it('reads the direction from the dominant axis', () => {
    expect(dpadDirection(0, -40, 78)).toBe('up');
    expect(dpadDirection(0, 40, 78)).toBe('down');
    expect(dpadDirection(-40, 0, 78)).toBe('left');
    expect(dpadDirection(40, 0, 78)).toBe('right');
    expect(dpadDirection(30, -50, 78)).toBe('up');
    expect(dpadDirection(-50, 30, 78)).toBe('left');
    // A tie goes to left / right.
    expect(dpadDirection(30, 30, 78)).toBe('right');
  });

  it('presses nothing in the dead zone, and keeps working outside the pad (a thumb that slid off)', () => {
    const r = DPAD_DEAD_ZONE * 78;
    expect(dpadDirection(0, 0, 78)).toBeNull();
    expect(dpadDirection(r - 0.5, 0, 78)).toBeNull();
    expect(dpadDirection(r + 0.5, 0, 78)).toBe('right');
    expect(dpadDirection(0, 300, 78)).toBe('down');
  });

  it('shows only on coarse pointers', () => {
    expect(isTouchDevice({ matchMedia: (q) => ({ matches: q === '(pointer: coarse)' }) })).toBe(true);
    expect(isTouchDevice({ matchMedia: () => ({ matches: false }) })).toBe(false);
    expect(isTouchDevice({})).toBe(false);
  });

  it('has A, B, Start and Mapa buttons, with 48 px minimum targets', () => {
    expect(TOUCH_BUTTONS.map((b) => b.action)).toEqual(['a', 'b', 'start', 'map']);
    expect(TOUCH_MIN_PX).toBe(48);
  });

  it('treats a screen taller than wide as portrait', () => {
    expect(isPortrait(412, 915)).toBe(true);
    expect(isPortrait(915, 412)).toBe(false);
    expect(isPortrait(500, 500)).toBe(false);
  });
});
