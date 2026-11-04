import { describe, expect, it } from 'vitest';
import { normalizeName } from '../../src/logic/names';

describe('normalizeName', () => {
  it('ignores case, accents and surrounding spaces', () => {
    expect(normalizeName('  PÁCO ')).toBe('paco');
    expect(normalizeName('Paco')).toBe(normalizeName('paco'));
    expect(normalizeName('Pacoo')).not.toBe('paco');
    expect(normalizeName('José  Luis')).toBe('jose luis');
    expect(normalizeName('Ünai')).toBe('unai');
  });

  it('keeps ñ as a letter', () => {
    expect(normalizeName('ÑOÑO')).toBe('ñoño');
    expect(normalizeName('Ñoño')).not.toBe(normalizeName('nono'));
  });
});
