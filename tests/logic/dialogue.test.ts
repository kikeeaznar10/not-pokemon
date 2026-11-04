import { describe, expect, it } from 'vitest';
import { TEXT_CPS, VOICE_EVERY_CHARS } from '../../src/logic/constants';
import {
  dialoguePages,
  isTyped,
  pressA,
  revealAll,
  startTyping,
  typeTick,
  visibleText,
  voiceAt,
  wrapText,
} from '../../src/logic/dialogue';

const MS = 1000 / TEXT_CPS;

describe('wrapText', () => {
  it('keeps short text on one line', () => {
    expect(wrapText('¿Lo de siempre?', 20)).toEqual(['¿Lo de siempre?']);
  });
  it('breaks at spaces without exceeding the width', () => {
    const lines = wrapText('Hoy hay bravas y también calamares a la romana', 12);
    expect(lines).toEqual(['Hoy hay', 'bravas y', 'también', 'calamares a', 'la romana']);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(12);
  });
  it('fits a word exactly at the width', () => {
    expect(wrapText('abc def', 7)).toEqual(['abc def']);
    expect(wrapText('abc defg', 7)).toEqual(['abc', 'defg']);
  });
  it('cuts words longer than a line', () => {
    expect(wrapText('a supercalifragilístico b', 6)).toEqual(['a', 'superc', 'alifra', 'gilíst', 'ico b']);
  });
  it('honours explicit line breaks and collapses spaces', () => {
    expect(wrapText('uno  dos\ntres', 20)).toEqual(['uno dos', 'tres']);
  });
  it('returns one empty line for empty text', () => {
    expect(wrapText('', 10)).toEqual(['']);
  });
});

describe('dialoguePages', () => {
  it('makes one page per string when it fits', () => {
    expect(dialoguePages(['¿Lo de siempre?', 'Hoy hay bravas.'], 30, 3)).toEqual([
      '¿Lo de siempre?',
      'Hoy hay bravas.',
    ]);
  });
  it('wraps long strings and continues on extra pages', () => {
    const pages = dialoguePages(['aa bb cc dd ee', 'ff'], 5, 2);
    expect(pages).toEqual(['aa bb\ncc dd', 'ee', 'ff']);
  });
  it('makes no pages for no strings', () => {
    expect(dialoguePages([], 10, 3)).toEqual([]);
  });
});

describe('typing', () => {
  it(`types ${TEXT_CPS} characters per second`, () => {
    let t = startTyping('x'.repeat(100));
    t = typeTick(t, 1000).typing;
    expect(t.shown).toBe(TEXT_CPS);
    expect(visibleText(t)).toBe('x'.repeat(TEXT_CPS));
  });
  it('carries leftover time across frames', () => {
    let t = startTyping('abcdef');
    for (let i = 0; i < 4; i += 1) t = typeTick(t, MS / 2).typing;
    expect(t.shown).toBe(2);
  });
  it('stops at the end of the page', () => {
    const t = typeTick(startTyping('abc'), 10_000).typing;
    expect(t.shown).toBe(3);
    expect(isTyped(t)).toBe(true);
    expect(typeTick(t, 100)).toEqual({ typing: t, voice: false });
  });
  it(`plays the voice on characters 1, 1 + ${VOICE_EVERY_CHARS}, …`, () => {
    let t = startTyping('abcdefgh');
    const voiced: number[] = [];
    while (!isTyped(t)) {
      const r = typeTick(t, MS);
      t = r.typing;
      if (r.voice) voiced.push(t.shown);
    }
    expect(voiced).toEqual([1, 4, 7]);
    expect(voiceAt(0)).toBe(false);
  });
  it('A reveals a typing page, then goes next', () => {
    const t = typeTick(startTyping('hola mundo'), MS * 2).typing;
    expect(pressA(t)).toBe('reveal');
    const full = revealAll(t);
    expect(visibleText(full)).toBe('hola mundo');
    expect(pressA(full)).toBe('next');
  });
  it('an empty page counts as typed', () => {
    expect(isTyped(startTyping(''))).toBe(true);
  });
});
