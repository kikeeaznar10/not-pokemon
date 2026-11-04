/**
 * Player-name helpers (pure). Secret names match ignoring case, accents and surrounding spaces:
 * "  PÁCO " matches "paco". Decision: "ñ" is a letter in Spanish, not an accent, so it is kept
 * ("Ñoño" ≠ "nono").
 */

/** Combining accents to drop: everything in U+0300–U+036F except a tilde (U+0303) right after "n". */
const ACCENTS = new RegExp('(?<!n)\\u0303|[\\u0300-\\u0302\\u0304-\\u036f]', 'g');

/** Normalise a name for comparison: trim, lowercase, strip accents (keeping ñ), collapse inner spaces. */
export function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(ACCENTS, '')
    .normalize('NFC')
    .replace(/\s+/g, ' ');
}
