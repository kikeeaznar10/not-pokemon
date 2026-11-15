/**
 * UI text lookup. Every visible UI string lives in `es.json` (flat keys like `battle.wild_appeared`).
 * Content text (creature names, dialogue…) lives in `public/data/*.json` instead.
 */
import es from './es.json';
import { warn } from '../core/log';

/** Values substituted into `{name}` placeholders. */
export type TextVars = Record<string, string | number>;

/** A string table: flat key → text with optional `{var}` placeholders. */
export type Strings = Record<string, string>;

/** Replace `{var}` placeholders in `text`; a placeholder with no matching var is left as-is. */
export function fillText(text: string, vars: TextVars): string {
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole,
  );
}

/**
 * Create a translator over a string table. A missing key returns `⟦key⟧` and logs a warning;
 * a placeholder with no matching var is left as-is (`{name}`).
 */
export function createT(strings: Strings): (key: string, vars?: TextVars) => string {
  return (key, vars) => {
    const text = strings[key];
    if (text === undefined) {
      warn(`Missing i18n key "${key}"`);
      return `⟦${key}⟧`;
    }
    return vars ? fillText(text, vars) : text;
  };
}

/** Translate `key` using `src/i18n/es.json`, filling `{var}` placeholders: `t('battle.wild_appeared', { name })`. */
export const t: (key: string, vars?: TextVars) => string = createT(es);
