/**
 * The Input service: the ONLY way game code reads controls. Scenes ask `input.isDown('a')` or
 * `input.justPressed('start')`; they never read the keyboard directly. The keyboard (desktop, bound in
 * `main.ts` with {@link bindKeyboard}) and, from M12, the touch controls feed the same service through
 * `keyDown/keyUp` and `press/release`.
 *
 * Rules:
 * - An action is down while ANY of its sources (keys or touch buttons) is down.
 * - `justPressed(action)` is true during exactly one game frame: the first frame after the action went
 *   from up to down. Frames are marked by {@link Input.beginFrame} (called by `main.ts` on Phaser's
 *   `prestep`), so every scene sees the same answer during a frame.
 * - {@link Input.direction} gives the held direction; when several are held, the most recently
 *   pressed one wins. A tap shorter than one frame still shows for that one frame.
 * - Losing focus releases everything (no stuck keys).
 *
 * Keyboard (docs/PLAN.md › Locked decisions): arrows/WASD move, Z = A, X = B, Enter = Start, M = map.
 * F2 = `debug` (only used by the DebugScene). No gamepad.
 */

/** Every action the game understands. `debug` is a developer key (F2), not a game control. */
export type Action = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'start' | 'map' | 'debug';

/** The four movement actions. */
export type Direction = 'up' | 'down' | 'left' | 'right';

/** Movement actions in a fixed order. */
export const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right'];

/** `KeyboardEvent.code` → action. */
export const KEY_BINDINGS: Readonly<Record<string, Action>> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  KeyZ: 'a',
  KeyX: 'b',
  Enter: 'start',
  NumpadEnter: 'start',
  KeyM: 'map',
  F2: 'debug',
};

/** Holds the state of every action. Use the shared {@link input}; tests create their own. */
export class Input {
  /** Source ids (`key:KeyW`, `touch:a`…) currently down, per action. */
  private readonly sources = new Map<Action, Set<string>>();
  /** Actions that went down since the last frame began (in press order). */
  private pending = new Set<Action>();
  /** Actions that are "just pressed" during the current frame (in press order). */
  private current = new Set<Action>();
  /** Held directions, most recent last. */
  private dirOrder: Direction[] = [];

  /** True while the action is held. */
  isDown(action: Action): boolean {
    return (this.sources.get(action)?.size ?? 0) > 0;
  }

  /** True during the one frame after the action was pressed. */
  justPressed(action: Action): boolean {
    return this.current.has(action);
  }

  /**
   * The held direction (most recently pressed wins), or `null`. A direction pressed and released
   * within the same frame (a very fast tap) still counts during the frame it is `justPressed`.
   */
  direction(): Direction | null {
    const held = this.dirOrder[this.dirOrder.length - 1];
    if (held) return held;
    // Sets keep insertion order: the last direction pressed this frame wins.
    const tapped = [...this.current].filter((a): a is Direction =>
      (DIRECTIONS as readonly string[]).includes(a),
    );
    return tapped[tapped.length - 1] ?? null;
  }

  /** Start a new frame: presses since the previous frame become `justPressed`. */
  beginFrame(): void {
    this.current = this.pending;
    this.pending = new Set();
  }

  /** A source (key or touch button) went down for `action`. */
  press(action: Action, source = `action:${action}`): void {
    let set = this.sources.get(action);
    if (!set) {
      set = new Set();
      this.sources.set(action, set);
    }
    if (set.has(source)) return;
    const wasDown = set.size > 0;
    set.add(source);
    if (wasDown) return;
    this.pending.add(action);
    if ((DIRECTIONS as readonly string[]).includes(action)) {
      const dir = action as Direction;
      this.dirOrder = [...this.dirOrder.filter((d) => d !== dir), dir];
    }
  }

  /** A source went up for `action`. */
  release(action: Action, source = `action:${action}`): void {
    const set = this.sources.get(action);
    if (!set?.delete(source) || set.size > 0) return;
    this.dirOrder = this.dirOrder.filter((d) => d !== action);
  }

  /** A keyboard key went down; returns true if the key is bound (the caller then prevents default). */
  keyDown(code: string): boolean {
    const action = KEY_BINDINGS[code];
    if (!action) return false;
    this.press(action, `key:${code}`);
    return true;
  }

  /** A keyboard key went up; returns true if the key is bound. */
  keyUp(code: string): boolean {
    const action = KEY_BINDINGS[code];
    if (!action) return false;
    this.release(action, `key:${code}`);
    return true;
  }

  /** Release every action (window lost focus or the page was hidden). */
  releaseAll(): void {
    this.sources.clear();
    this.dirOrder = [];
    this.pending.clear();
  }
}

/** The shared Input service. */
export const input = new Input();

/** Minimal event target (a `Window`) for {@link bindKeyboard}. */
export interface KeyboardTarget {
  addEventListener(type: 'keydown' | 'keyup', fn: (e: KeyboardEvent) => void): void;
  addEventListener(type: 'blur', fn: () => void): void;
}

/**
 * Feed DOM keyboard events into `service`. Bound keys get `preventDefault()` so arrows never scroll
 * the page. Key repeat is ignored (holding is read with `isDown`).
 */
export function bindKeyboard(target: KeyboardTarget, service: Input = input): void {
  target.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.repeat) {
      if (KEY_BINDINGS[e.code]) e.preventDefault();
      return;
    }
    if (service.keyDown(e.code)) e.preventDefault();
  });
  target.addEventListener('keyup', (e: KeyboardEvent) => {
    if (service.keyUp(e.code)) e.preventDefault();
  });
  target.addEventListener('blur', () => service.releaseAll());
}
