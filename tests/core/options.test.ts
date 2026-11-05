import { afterEach, describe, expect, it } from 'vitest';
import { events } from '../../src/core/events';
import { getOptions, loadOptions, OPTIONS_KEY, setOptions, sfxVolume } from '../../src/core/options';
import { defaultOptions, type Options } from '../../src/logic/options';
import { memoryStorage } from './memory-storage';

afterEach(() => {
  loadOptions(null);
});

describe('options store', () => {
  it('reads flexymon.options, falling back to the defaults', () => {
    expect(OPTIONS_KEY).toBe('flexymon.options');
    expect(loadOptions(memoryStorage())).toEqual(defaultOptions());
    const mem = memoryStorage({ [OPTIONS_KEY]: JSON.stringify({ music: 2, sfx: 5, textSpeed: 'slow' }) });
    expect(loadOptions(mem)).toEqual({ music: 2, sfx: 5, textSpeed: 'slow' });
    expect(getOptions().textSpeed).toBe('slow');
    expect(loadOptions(memoryStorage({ [OPTIONS_KEY]: 'garbage' }))).toEqual(defaultOptions());
  });

  it('setOptions stores, applies and announces the new options', () => {
    const mem = memoryStorage();
    loadOptions(mem);
    const seen: Options[] = [];
    const off = events.on('options:changed', (o) => seen.push(o));
    setOptions({ music: 1, sfx: 5, textSpeed: 'fast' });
    off();
    expect(JSON.parse(mem.map.get(OPTIONS_KEY) ?? '')).toEqual({ music: 1, sfx: 5, textSpeed: 'fast' });
    expect(seen).toEqual([{ music: 1, sfx: 5, textSpeed: 'fast' }]);
    expect(sfxVolume()).toBe(0.5);
  });

  it('a storage that throws never breaks the game', () => {
    const bad = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => undefined,
    };
    expect(loadOptions(bad)).toEqual(defaultOptions());
    expect(() => setOptions({ ...defaultOptions(), sfx: 0 })).not.toThrow();
    expect(sfxVolume()).toBe(0);
  });
});
