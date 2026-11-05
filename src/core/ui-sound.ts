/**
 * Interface sounds: `uiSound('cursor' | 'confirm' | 'cancel' | 'error' | 'money')` plays the matching sound
 * of `public/data/sounds.json` at the effects volume. UI code calls it; it never touches Phaser itself.
 *
 * - `main.ts` installs the player ({@link setUiSoundPlayer}): it looks the kind up in `getGameData().sounds` and
 *   plays it through the game's sound manager with `{ volume: sfxVolume() }` (the effects option).
 * - Before a player is installed (unit tests, boot) the call is only recorded.
 * - Every call is recorded in a short history ({@link uiSoundsPlayed}, newest last, at most
 *   {@link UI_SOUND_HISTORY} entries) for the E2E hook `uiSounds()`.
 *
 * Who plays what: menus and choice boxes play `cursor` on a move, `confirm` on A, `cancel` on B and `error` on A
 * over a greyed option; shops, the storage box and the bag play `error` with their refusal messages; shop deals
 * and enemy rewards play `money`.
 */
import type { UiSoundKind } from '../data/schemas';

export type { UiSoundKind };

/** How many calls {@link uiSoundsPlayed} remembers. */
export const UI_SOUND_HISTORY = 100;

let player: ((kind: UiSoundKind) => void) | null = null;
const history: UiSoundKind[] = [];

/** Install the function that actually plays a sound (`main.ts`), or `null` to only record. */
export function setUiSoundPlayer(play: ((kind: UiSoundKind) => void) | null): void {
  player = play;
}

/** Play an interface sound (and record it). */
export function uiSound(kind: UiSoundKind): void {
  history.push(kind);
  if (history.length > UI_SOUND_HISTORY) history.splice(0, history.length - UI_SOUND_HISTORY);
  player?.(kind);
}

/** The interface sounds played since the page loaded (or {@link clearUiSounds}), oldest first. */
export function uiSoundsPlayed(): UiSoundKind[] {
  return [...history];
}

/** Forget the recorded history (tests). */
export function clearUiSounds(): void {
  history.length = 0;
}
