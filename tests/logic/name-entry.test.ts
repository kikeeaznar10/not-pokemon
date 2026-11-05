import { describe, expect, it } from 'vitest';
import es from '../../src/i18n/es.json';
import { NAME_MAX_LENGTH } from '../../src/logic/constants';
import {
  canConfirm,
  deleteChar,
  finalName,
  isNameChar,
  nameGrid,
  typeChar,
} from '../../src/logic/name-entry';

describe('name entry (M11)', () => {
  it('allows letters (ñ and accents too) and spaces only', () => {
    for (const ch of ['a', 'Z', 'ñ', 'Ñ', 'á', 'ü', ' ']) expect(isNameChar(ch)).toBe(true);
    for (const ch of ['1', '-', '.', '', 'ab', '\n']) expect(isNameChar(ch)).toBe(false);
  });

  it('types up to NAME_MAX_LENGTH characters', () => {
    expect(NAME_MAX_LENGTH).toBe(10);
    let name = '';
    for (const ch of 'Bartolomeus') name = typeChar(name, ch);
    expect(name).toBe('Bartolomeu');
    expect(typeChar(name, 'x')).toBe(name);
    expect(typeChar('Ana', '7')).toBe('Ana');
  });

  it('no leading or double spaces', () => {
    expect(typeChar('', ' ')).toBe('');
    expect(typeChar('Ana', ' ')).toBe('Ana ');
    expect(typeChar('Ana ', ' ')).toBe('Ana ');
  });

  it('deletes the last character (whole characters, not code units)', () => {
    expect(deleteChar('Ñá')).toBe('Ñ');
    expect(deleteChar('')).toBe('');
  });

  it('needs a letter; the saved name is trimmed', () => {
    expect(canConfirm('')).toBe(false);
    expect(canConfirm('   ')).toBe(false);
    expect(canConfirm('Ño')).toBe(true);
    expect(finalName('Ana ')).toBe('Ana');
  });

  it('builds the plan grid from es.json: A–Z, Ñ, á é í ó ú, space, Borrar, OK', () => {
    const grid = nameGrid(es['name.letters']);
    const chars = grid.flatMap((c) => (c.kind === 'char' ? [c.char] : []));
    expect(chars.join('')).toBe('ABCDEFGHIJKLMNÑOPQRSTUVWXYZáéíóú ');
    expect(grid.slice(-2)).toEqual([{ kind: 'delete' }, { kind: 'ok' }]);
    // Duplicates, spaces and non-letters in the source are dropped.
    expect(nameGrid('AAB 1').map((c) => (c.kind === 'char' ? c.char : c.kind))).toEqual([
      'A',
      'B',
      ' ',
      'delete',
      'ok',
    ]);
  });
});
