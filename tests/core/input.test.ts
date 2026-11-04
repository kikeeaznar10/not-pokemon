import { describe, expect, it } from 'vitest';
import { bindKeyboard, Input, KEY_BINDINGS, type KeyboardTarget } from '../../src/core/input';

describe('Input service', () => {
  it('maps the locked keyboard layout', () => {
    expect(KEY_BINDINGS).toMatchObject({
      ArrowUp: 'up',
      KeyW: 'up',
      KeyS: 'down',
      KeyA: 'left',
      KeyD: 'right',
      KeyZ: 'a',
      KeyX: 'b',
      Enter: 'start',
      KeyM: 'map',
    });
  });

  it('isDown follows the key; justPressed lasts exactly one frame', () => {
    const i = new Input();
    expect(i.keyDown('KeyZ')).toBe(true);
    expect(i.isDown('a')).toBe(true);
    expect(i.justPressed('a')).toBe(false); // not before the frame starts
    i.beginFrame();
    expect(i.justPressed('a')).toBe(true);
    i.beginFrame();
    expect(i.justPressed('a')).toBe(false);
    expect(i.isDown('a')).toBe(true);
    i.keyUp('KeyZ');
    expect(i.isDown('a')).toBe(false);
    expect(i.keyDown('KeyQ')).toBe(false);
    expect(i.keyUp('KeyQ')).toBe(false);
  });

  it('an action stays down while any of its sources is down (arrow + WASD, keys + touch)', () => {
    const i = new Input();
    i.keyDown('ArrowUp');
    i.keyDown('KeyW');
    i.keyUp('ArrowUp');
    expect(i.isDown('up')).toBe(true);
    i.press('up', 'touch:dpad');
    i.keyUp('KeyW');
    expect(i.isDown('up')).toBe(true);
    i.release('up', 'touch:dpad');
    expect(i.isDown('up')).toBe(false);
    i.release('up', 'touch:dpad'); // releasing twice is harmless
  });

  it('a second source does not re-trigger justPressed', () => {
    const i = new Input();
    i.keyDown('ArrowUp');
    i.beginFrame();
    i.keyDown('KeyW');
    i.beginFrame();
    expect(i.justPressed('up')).toBe(false);
    i.keyDown('KeyW'); // same source again: ignored
    expect(i.isDown('up')).toBe(true);
  });

  it('the most recently pressed held direction wins', () => {
    const i = new Input();
    expect(i.direction()).toBeNull();
    i.keyDown('ArrowUp');
    i.keyDown('ArrowLeft');
    expect(i.direction()).toBe('left');
    i.keyUp('ArrowLeft');
    expect(i.direction()).toBe('up');
    i.keyUp('ArrowUp');
    i.beginFrame();
    i.beginFrame();
    expect(i.direction()).toBeNull();
  });

  it('a tap shorter than one frame still counts during that frame', () => {
    const i = new Input();
    i.keyDown('ArrowRight');
    i.keyUp('ArrowRight');
    expect(i.direction()).toBeNull();
    i.beginFrame();
    expect(i.direction()).toBe('right');
    i.beginFrame();
    expect(i.direction()).toBeNull();
  });

  it('two taps in one frame: the last one wins', () => {
    const i = new Input();
    i.keyDown('ArrowLeft');
    i.keyUp('ArrowLeft');
    i.keyDown('ArrowRight');
    i.keyUp('ArrowRight');
    i.beginFrame();
    expect(i.direction()).toBe('right');
  });

  it('releaseAll clears everything', () => {
    const i = new Input();
    i.keyDown('ArrowUp');
    i.keyDown('Enter');
    i.releaseAll();
    i.beginFrame();
    expect(i.isDown('up')).toBe(false);
    expect(i.justPressed('start')).toBe(false);
    expect(i.direction()).toBeNull();
  });

  it('bindKeyboard feeds DOM events, prevents default on bound keys and ignores repeats', () => {
    const handlers: Record<string, (e?: KeyboardEvent) => void> = {};
    const target = {
      addEventListener: (type: string, fn: (e?: KeyboardEvent) => void) => {
        handlers[type] = fn;
      },
    } as KeyboardTarget;
    const i = new Input();
    bindKeyboard(target, i);
    let prevented = 0;
    const ev = (code: string, repeat = false) =>
      ({ code, repeat, preventDefault: () => (prevented += 1) }) as unknown as KeyboardEvent;
    handlers.keydown!(ev('ArrowDown'));
    expect(i.isDown('down')).toBe(true);
    handlers.keydown!(ev('ArrowDown', true));
    handlers.keydown!(ev('KeyQ'));
    expect(prevented).toBe(2);
    handlers.keyup!(ev('ArrowDown'));
    expect(i.isDown('down')).toBe(false);
    handlers.keydown!(ev('KeyX'));
    handlers.blur!();
    expect(i.isDown('b')).toBe(false);
  });
});
