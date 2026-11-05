import { afterEach, describe, expect, it } from 'vitest';
import { Autosave } from '../../src/core/autosave';
import { events } from '../../src/core/events';
import { SAVE_KEY, SaveStore } from '../../src/core/save-store';
import type { GameState } from '../../src/logic/save';
import { inst } from '../logic/helpers';
import { memoryStorage } from './memory-storage';

const start = (): GameState => ({
  player: { name: 'Rogelio', map: 'test', x: 4, y: 6, facing: 'down' },
  euros: 200,
  teamSlots: 2,
  team: [inst('portatil', 'p')],
  storage: [],
  items: {},
  npcs: {},
});

/** A fake page with listeners for `pagehide` and the document's `visibilitychange`. */
function fakePage() {
  const listeners = new Map<string, () => void>();
  const docListeners = new Map<string, () => void>();
  const document = {
    visibilityState: 'visible',
    addEventListener: (n: string, h: () => void) => void docListeners.set(n, h),
    removeEventListener: (n: string) => void docListeners.delete(n),
  };
  return {
    listeners,
    docListeners,
    document,
    addEventListener: (n: string, h: () => void) => void listeners.set(n, h),
    removeEventListener: (n: string) => void listeners.delete(n),
  };
}

let stop: (() => void) | null = null;
afterEach(() => {
  stop?.();
  stop = null;
});

function setup() {
  const mem = memoryStorage();
  let state = start();
  const done: string[] = [];
  const offDone = events.on('save:done', ({ reason }) => done.push(reason));
  const auto = new Autosave({
    store: new SaveStore(mem),
    getState: () => state,
    setState: (s) => {
      state = s;
    },
    now: () => new Date('2026-11-05T10:00:00Z'),
  });
  const page = fakePage();
  const off = auto.start(page as unknown as Window & { document: Document });
  stop = () => {
    off();
    offDone();
  };
  return {
    mem,
    auto,
    done,
    page,
    state: () => state,
    saved: () => JSON.parse(mem.map.get(SAVE_KEY) ?? 'null'),
  };
}

describe('Autosave', () => {
  it('saves nothing before the overworld was entered', () => {
    const s = setup();
    events.emit('save:request', { reason: 'menu' });
    s.page.listeners.get('pagehide')?.();
    expect(s.mem.map.has(SAVE_KEY)).toBe(false);
    expect(s.done).toEqual([]);
  });

  it('saves at every save point and announces it', () => {
    const s = setup();
    events.emit('zone:entered', { zone: 'test' });
    for (const reason of ['map', 'battle', 'shop', 'healer', 'menu'] as const) {
      events.emit('save:request', { reason });
    }
    expect(s.done).toEqual(['map', 'battle', 'shop', 'healer', 'menu']);
    expect(s.auto.written).toEqual(['map', 'battle', 'shop', 'healer', 'menu']);
    expect(s.saved()).toMatchObject({ version: 1, euros: 200, savedAt: '2026-11-05T10:00:00.000Z' });
  });

  it('keeps the player position in the state and the save', () => {
    const s = setup();
    events.emit('zone:entered', { zone: 'test_house' });
    events.emit('player:moved', { map: 'test_house', x: 2, y: 3, facing: 'up' });
    expect(s.state().player).toEqual({ name: 'Rogelio', map: 'test_house', x: 2, y: 3, facing: 'up' });
    events.emit('save:request', { reason: 'map' });
    expect(s.saved().player).toEqual({ name: 'Rogelio', map: 'test_house', x: 2, y: 3, facing: 'up' });
  });

  it('saves quietly when the page is hidden or closed', () => {
    const s = setup();
    events.emit('zone:entered', { zone: 'test' });
    s.page.document.visibilityState = 'visible';
    s.page.docListeners.get('visibilitychange')?.();
    expect(s.mem.map.has(SAVE_KEY)).toBe(false);
    s.page.document.visibilityState = 'hidden';
    s.page.docListeners.get('visibilitychange')?.();
    s.page.listeners.get('pagehide')?.();
    expect(s.auto.written).toEqual(['quiet', 'quiet']);
    expect(s.done).toEqual([]);
    expect(s.mem.map.has(SAVE_KEY)).toBe(true);
  });

  it('the quiet save never overwrites a slot changed outside the game (devtools, another tab)', () => {
    const s = setup();
    events.emit('zone:entered', { zone: 'test' });
    events.emit('save:request', { reason: 'map' });
    s.mem.map.set(SAVE_KEY, 'garbage');
    s.page.listeners.get('pagehide')?.();
    expect(s.mem.map.get(SAVE_KEY)).toBe('garbage');
    expect(s.auto.written).toEqual(['map']);
    // A real save point still writes.
    events.emit('save:request', { reason: 'menu' });
    expect(s.saved()).toMatchObject({ version: 1 });
    s.page.listeners.get('pagehide')?.();
    expect(s.auto.written).toEqual(['map', 'menu', 'quiet']);
  });

  it('disable stops every save', () => {
    const s = setup();
    events.emit('zone:entered', { zone: 'test' });
    s.auto.disable();
    expect(s.auto.saving).toBe(false);
    events.emit('save:request', { reason: 'menu' });
    s.page.listeners.get('pagehide')?.();
    expect(s.mem.map.has(SAVE_KEY)).toBe(false);
  });

  it('unsubscribes', () => {
    const s = setup();
    stop?.();
    stop = null;
    events.emit('zone:entered', { zone: 'test' });
    events.emit('save:request', { reason: 'menu' });
    expect(s.mem.map.has(SAVE_KEY)).toBe(false);
    expect(s.page.listeners.size).toBe(0);
  });
});
