import { describe, expect, it, vi } from 'vitest';
import { UNLOCK_EVENTS, unlockAudioOnFirstInput } from '../../src/core/audio-unlock';

describe('unlockAudioOnFirstInput', () => {
  it('unlocks once on the first gesture and removes every listener', () => {
    const target = new EventTarget();
    const unlock = vi.fn();
    unlockAudioOnFirstInput(target, unlock);
    expect(unlock).not.toHaveBeenCalled();
    target.dispatchEvent(new Event('pointerdown'));
    target.dispatchEvent(new Event('keydown'));
    expect(unlock).toHaveBeenCalledTimes(1);
  });

  it('listens for every unlock event; the returned function stops listening', () => {
    for (const name of UNLOCK_EVENTS) {
      const target = new EventTarget();
      const unlock = vi.fn();
      unlockAudioOnFirstInput(target, unlock);
      target.dispatchEvent(new Event(name));
      expect(unlock).toHaveBeenCalledTimes(1);
    }
    const target = new EventTarget();
    const unlock = vi.fn();
    unlockAudioOnFirstInput(target, unlock)();
    target.dispatchEvent(new Event('keydown'));
    expect(unlock).not.toHaveBeenCalled();
  });
});
