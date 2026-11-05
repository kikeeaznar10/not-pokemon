/**
 * Audio unlock (M15). Browsers keep a page's audio context suspended until the first user gesture, and Phaser's
 * own unlock only listens for some events. {@link unlockAudioOnFirstInput} adds one-shot listeners for the first
 * key press, pointer press or touch and then calls `unlock` (in `main.ts`: Phaser's `sound.unlock()` plus a
 * `resume()` of the Web Audio context). Every listener is removed after that first gesture.
 *
 * The game never plays a sound before the player's first input: the title waits for Start / A or a tap, and zone
 * music starts when the overworld enters a map, which always follows that input.
 */

/** Events that count as a user gesture for audio. */
export const UNLOCK_EVENTS = ['keydown', 'pointerdown', 'touchend', 'mousedown'] as const;

/** Listen on `target` for the first user gesture and call `unlock` once. Returns a function that stops listening. */
export function unlockAudioOnFirstInput(
  target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>,
  unlock: () => void,
): () => void {
  let done = false;
  const stop = (): void => {
    done = true;
    for (const name of UNLOCK_EVENTS) target.removeEventListener(name, handler, true);
  };
  const handler = (): void => {
    if (done) return;
    stop();
    unlock();
  };
  for (const name of UNLOCK_EVENTS) target.addEventListener(name, handler, true);
  return stop;
}
