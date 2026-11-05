import { describe, expect, it } from 'vitest';
import { TEXT_CPS, TEXT_SPEED_CPS, VOLUME_STEPS } from '../../src/logic/constants';
import {
  defaultOptions,
  OPTION_KEYS,
  parseOptions,
  serializeOptions,
  stepOption,
  textCps,
  volumeGain,
} from '../../src/logic/options';

describe('options', () => {
  it('start with both volumes full and normal text', () => {
    expect(defaultOptions()).toEqual({ music: VOLUME_STEPS, sfx: VOLUME_STEPS, textSpeed: 'normal' });
    expect(OPTION_KEYS).toEqual(['music', 'sfx', 'textSpeed']);
  });

  it('round-trip through the stored JSON', () => {
    const o = { music: 3, sfx: 0, textSpeed: 'fast' as const };
    expect(parseOptions(serializeOptions(o))).toEqual({ options: o, warnings: [] });
  });

  it('nothing stored gives the defaults with no warning', () => {
    expect(parseOptions(null)).toEqual({ options: defaultOptions(), warnings: [] });
  });

  it('broken JSON or a non-object gives the defaults with a warning', () => {
    for (const text of ['{nope', '42', '[]', 'null']) {
      const r = parseOptions(text);
      expect(r.options).toEqual(defaultOptions());
      expect(r.warnings).toHaveLength(1);
    }
  });

  it('a bad field falls back alone; good fields are kept', () => {
    const r = parseOptions(JSON.stringify({ music: 99, sfx: 4, textSpeed: 'warp' }));
    expect(r.options).toEqual({ music: VOLUME_STEPS, sfx: 4, textSpeed: 'normal' });
    expect(r.warnings).toHaveLength(2);
    expect(parseOptions(JSON.stringify({ sfx: 2.5 })).options.sfx).toBe(VOLUME_STEPS);
  });

  it('step one level at a time and stop at the ends (no wrap)', () => {
    let o = defaultOptions();
    o = stepOption(o, 'music', 1);
    expect(o.music).toBe(VOLUME_STEPS);
    o = stepOption(o, 'music', -1);
    expect(o.music).toBe(VOLUME_STEPS - 1);
    let s = { ...o, sfx: 0 };
    s = stepOption(s, 'sfx', -1);
    expect(s.sfx).toBe(0);
    expect(stepOption(o, 'textSpeed', 1).textSpeed).toBe('fast');
    expect(stepOption(stepOption(o, 'textSpeed', 1), 'textSpeed', 1).textSpeed).toBe('fast');
    expect(stepOption(o, 'textSpeed', -1).textSpeed).toBe('slow');
    expect(stepOption({ ...o, textSpeed: 'slow' }, 'textSpeed', -1).textSpeed).toBe('slow');
  });

  it('never change the input', () => {
    const o = defaultOptions();
    stepOption(o, 'sfx', -1);
    expect(o).toEqual(defaultOptions());
  });

  it('map text speeds to characters per second (normal = TEXT_CPS) and levels to gains', () => {
    expect(textCps('normal')).toBe(TEXT_CPS);
    expect(textCps('slow')).toBe(TEXT_SPEED_CPS.slow);
    expect(textCps('slow')).toBeLessThan(textCps('normal'));
    expect(textCps('fast')).toBeGreaterThan(textCps('normal'));
    expect(volumeGain(0)).toBe(0);
    expect(volumeGain(VOLUME_STEPS)).toBe(1);
    expect(volumeGain(VOLUME_STEPS / 2)).toBe(0.5);
    expect(volumeGain(-3)).toBe(0);
  });
});
