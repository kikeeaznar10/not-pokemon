/**
 * Logging helpers. The ONLY place in the game allowed to call `console.*`.
 *
 * Output is enabled in dev builds (`import.meta.env.DEV`) and in test builds made with
 * `VITE_E2E=1`; in a normal production build every function is a silent no-op.
 */

/** True when log output is enabled (dev server or an E2E build). */
export const LOG_ENABLED: boolean = import.meta.env.DEV || import.meta.env.VITE_E2E === '1';

/** Informational message (`console.log`). */
export function log(...args: unknown[]): void {
  if (LOG_ENABLED) console.log('[flexymon]', ...args);
}

/** Something unexpected that the game can recover from (`console.warn`). */
export function warn(...args: unknown[]): void {
  if (LOG_ENABLED) console.warn('[flexymon]', ...args);
}

/** A real failure (`console.error`). */
export function error(...args: unknown[]): void {
  if (LOG_ENABLED) console.error('[flexymon]', ...args);
}
