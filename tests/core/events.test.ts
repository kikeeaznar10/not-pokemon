import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/core/events';

interface TestEvents {
  ping: void;
  score: { n: number };
}

describe('EventBus', () => {
  it('delivers typed payloads to subscribers', () => {
    const bus = new EventBus<TestEvents>();
    const h = vi.fn();
    bus.on('score', h);
    bus.emit('score', { n: 3 });
    expect(h).toHaveBeenCalledWith({ n: 3 });
  });

  it('unsubscribes via the returned function and off()', () => {
    const bus = new EventBus<TestEvents>();
    const a = vi.fn();
    const b = vi.fn();
    const offA = bus.on('ping', a);
    bus.on('ping', b);
    offA();
    bus.off('ping', b);
    bus.emit('ping');
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });

  it('once fires a single time', () => {
    const bus = new EventBus<TestEvents>();
    const h = vi.fn();
    bus.once('ping', h);
    bus.emit('ping');
    bus.emit('ping');
    expect(h).toHaveBeenCalledTimes(1);
  });

  it('clear removes handlers', () => {
    const bus = new EventBus<TestEvents>();
    const h = vi.fn();
    bus.on('ping', h);
    bus.on('score', h);
    bus.clear('ping');
    bus.emit('ping');
    expect(h).not.toHaveBeenCalled();
    bus.clear();
    bus.emit('score', { n: 1 });
    expect(h).not.toHaveBeenCalled();
  });
});
