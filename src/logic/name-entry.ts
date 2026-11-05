/**
 * Name entry rules (M11, pure), used by the NameScene:
 * - the name holds at most `NAME_MAX_LENGTH` (10) characters;
 * - only letters (any alphabet, so ñ and accented vowels too) and spaces can be typed; a space cannot be
 *   the first character and two spaces never follow each other;
 * - the name is accepted when it has at least one letter; {@link finalName} trims the trailing space.
 * The letter grid (A–Z, Ñ, á é í ó ú, space, Borrar, OK) is built by {@link nameGrid} from the letters in
 * `es.json` (`name.letters`), so the scene never hard-codes them.
 */
import { NAME_MAX_LENGTH } from './constants';

/** One cell of the letter grid: a character to type, or the delete / confirm buttons. */
export type NameCell = { kind: 'char'; char: string } | { kind: 'delete' } | { kind: 'ok' };

/** True if `ch` (one character) may be part of a name. */
export function isNameChar(ch: string): boolean {
  return /^[\p{L} ]$/u.test(ch);
}

/** Type `ch` at the end of `name`; returns `name` unchanged when it is not allowed or the name is full. */
export function typeChar(name: string, ch: string): string {
  if (!isNameChar(ch) || [...name].length >= NAME_MAX_LENGTH) return name;
  if (ch === ' ' && (name === '' || name.endsWith(' '))) return name;
  return name + ch;
}

/** Remove the last character. */
export function deleteChar(name: string): string {
  return [...name].slice(0, -1).join('');
}

/** True when the name can be confirmed (it has a letter). */
export function canConfirm(name: string): boolean {
  return /\p{L}/u.test(name);
}

/** The name as saved: surrounding spaces removed. */
export function finalName(name: string): string {
  return name.trim();
}

/**
 * The letter grid: every character of `letters` (in order), then a space cell, then Borrar and OK.
 * The space cell is a `char` cell with `' '`.
 */
export function nameGrid(letters: string): NameCell[] {
  const chars = [...new Set([...letters])].filter((c) => c !== ' ' && isNameChar(c));
  return [
    ...chars.map((char): NameCell => ({ kind: 'char', char })),
    { kind: 'char', char: ' ' },
    { kind: 'delete' },
    { kind: 'ok' },
  ];
}
