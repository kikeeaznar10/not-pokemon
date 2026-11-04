/**
 * Dialogue box rules (docs/PLAN.md › M5), pure so they can be unit-tested:
 * - Each dialogue string is one box. It is word-wrapped to the box width ({@link wrapText}); a string
 *   too long for one box continues on extra boxes ({@link dialoguePages}), so text is never cut off.
 * - Text types out at `TEXT_CPS` characters per second ({@link typeTick}). Line breaks count as
 *   characters, so typing pauses briefly at the end of a line.
 * - The voice plays on the 1st, 4th, 7th… typed character (once every `VOICE_EVERY_CHARS`). Every
 *   character counts, spaces and line breaks included, so the rhythm stays even.
 * - A while typing shows the whole page at once; A on a finished page goes to the next one
 *   ({@link pressA}).
 */
import { TEXT_CPS, VOICE_EVERY_CHARS } from './constants';

/**
 * Split `text` into lines of at most `maxChars` characters, breaking at spaces. A word longer than a
 * line is cut. Explicit `\n` in the text starts a new line. Runs of spaces collapse at line breaks.
 */
export function wrapText(text: string, maxChars: number): string[] {
  const width = Math.max(1, Math.floor(maxChars));
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const raw of para.split(' ')) {
      if (raw === '') continue;
      let word = raw;
      while (word.length > width) {
        if (line) {
          lines.push(line);
          line = '';
        }
        lines.push(word.slice(0, width));
        word = word.slice(width);
      }
      if (!word) continue;
      if (!line) line = word;
      else if (line.length + 1 + word.length <= width) line += ` ${word}`;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

/**
 * Turn dialogue strings into the pages shown one by one: each string is wrapped to `maxChars` and,
 * if it needs more than `maxLines` lines, split over several pages. Each page is its lines joined
 * with `\n`.
 */
export function dialoguePages(strings: readonly string[], maxChars: number, maxLines: number): string[] {
  const perPage = Math.max(1, Math.floor(maxLines));
  const pages: string[] = [];
  for (const s of strings) {
    const lines = wrapText(s, maxChars);
    for (let i = 0; i < lines.length; i += perPage) pages.push(lines.slice(i, i + perPage).join('\n'));
  }
  return pages;
}

/** Typing progress of one page. */
export interface Typing {
  /** The full page text (already wrapped). */
  readonly text: string;
  /** Characters shown so far (0 … text.length). */
  readonly shown: number;
  /** Time spent typing this page (ms). */
  readonly ms: number;
}

/** A page that has not started typing. */
export function startTyping(text: string): Typing {
  return { text, shown: 0, ms: 0 };
}

/** True once every character of the page is shown. */
export function isTyped(t: Typing): boolean {
  return t.shown >= t.text.length;
}

/** True if typing the character at 1-based position `n` plays the voice. */
export function voiceAt(n: number): boolean {
  return n >= 1 && (n - 1) % VOICE_EVERY_CHARS === 0;
}

/**
 * Advance typing by `dtMs`. Returns the new state and how many times the voice plays this tick
 * (0 or 1 at normal frame rates; a long frame may type several characters but plays it at most once).
 */
export function typeTick(t: Typing, dtMs: number): { typing: Typing; voice: boolean } {
  if (isTyped(t)) return { typing: t, voice: false };
  const ms = t.ms + dtMs;
  // Whole characters typed after `ms` (computed from the total time, so rounding never drifts).
  const shown = Math.min(t.text.length, Math.floor((ms * TEXT_CPS) / 1000 + 1e-9));
  let voice = false;
  for (let n = t.shown + 1; n <= shown; n += 1) if (voiceAt(n)) voice = true;
  return { typing: { text: t.text, shown: Math.max(shown, t.shown), ms }, voice };
}

/** The visible part of the page. */
export function visibleText(t: Typing): string {
  return t.text.slice(0, t.shown);
}

/** What pressing A does: show the rest of the page, or go on to the next page (or close). */
export function pressA(t: Typing): 'reveal' | 'next' {
  return isTyped(t) ? 'next' : 'reveal';
}

/** The page with every character shown. */
export function revealAll(t: Typing): Typing {
  return { text: t.text, shown: t.text.length, ms: (t.text.length * 1000) / TEXT_CPS };
}
