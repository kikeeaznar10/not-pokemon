/**
 * Touch controls (M12) — an HTML overlay over the game canvas with a D-pad (bottom left), A and B (bottom
 * right) and Start and Mapa (top right). They feed the same Input service as the keyboard
 * (`input.press(action, source)` / `input.release(action, source)`), so every scene works by touch with no
 * change. M11's text mode does not affect them: on the name screen the touch B deletes and A presses the cell.
 *
 * - Shown only on touch devices: {@link isTouchDevice} (`matchMedia('(pointer: coarse)')`), checked once at start.
 * - Drawn in HTML, not in the canvas, so the buttons keep their size whatever the game's pixel scale is. Every
 *   touch target is at least `TOUCH_MIN_PX` (48) CSS pixels; the look (semi-transparent) is in `index.html`.
 * - Multi-touch: every finger is tracked by its pointer id, so the D-pad and a button can be held together.
 * - D-pad: the direction comes from where the finger is relative to the pad's centre ({@link dpadDirection}).
 *   Sliding the thumb to another arm changes direction without lifting; leaving the pad keeps the direction of
 *   the side the finger is on, until it lifts. Only the first finger on the pad counts.
 * - No browser gestures: the controls cancel the default of every touch and pointer event they get (no scroll,
 *   zoom, text selection or long-press menu); {@link preventBrowserGestures} does the same for the whole page.
 * - Losing focus or hiding the page releases everything ({@link TouchControls.reset}), like the keyboard.
 */
import type { Action, Direction, Input } from '../core/input';
import { t } from '../i18n';
import { DPAD_DEAD_ZONE } from '../logic/constants';

/** Smallest touch target in CSS pixels (docs/PLAN.md › M12). The CSS in `index.html` keeps every control at least this big. */
export const TOUCH_MIN_PX = 48;

/** The buttons (not the D-pad): id → action and the `es.json` key of its label. */
export const TOUCH_BUTTONS: readonly { id: 'a' | 'b' | 'start' | 'map'; action: Action; label: string }[] = [
  { id: 'a', action: 'a', label: 'touch.a' },
  { id: 'b', action: 'b', label: 'touch.b' },
  { id: 'start', action: 'start', label: 'touch.start' },
  { id: 'map', action: 'map', label: 'touch.map' },
];

/** Minimal `window` for {@link isTouchDevice}. */
export interface MediaQueryTarget {
  matchMedia?: (query: string) => { matches: boolean };
}

/** True on touch devices: the primary pointer is coarse (a finger). */
export function isTouchDevice(win: MediaQueryTarget): boolean {
  return win.matchMedia?.('(pointer: coarse)').matches ?? false;
}

/**
 * The D-pad direction for a touch at (`dx`, `dy`) from the pad's centre, on a pad `half` pixels from centre
 * to edge. Inside the dead zone (`deadZone × half` from the centre) nothing is pressed; otherwise the axis
 * with the larger distance wins (a tie goes to left/right). Works outside the pad too (a finger that slid off).
 */
export function dpadDirection(
  dx: number,
  dy: number,
  half: number,
  deadZone = DPAD_DEAD_ZONE,
): Direction | null {
  if (Math.hypot(dx, dy) < deadZone * half) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}

/** One control as the E2E hooks see it: id (`dpad`, `a`, `b`, `start`, `map`) and its box in CSS pixels. */
export interface TouchControlView {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The touch overlay as data (for the E2E hooks). */
export interface TouchView {
  shown: boolean;
  controls: TouchControlView[];
  /** Ids of the controls held right now (the D-pad as `dpad:<direction>`). */
  pressed: string[];
}

/** Source id prefix for the Input service, so touch and keys never release each other. */
const SOURCE = 'touch';

/** The overlay. Create it, then {@link TouchControls.mount} it. */
export class TouchControls {
  private root: HTMLElement | null = null;
  private dpad: HTMLElement | null = null;
  private readonly arms = new Map<Direction, HTMLElement>();
  private readonly buttons = new Map<string, HTMLElement>();
  /** Fingers on each button: button id → pointer ids. */
  private readonly held = new Map<string, Set<number>>();
  private dpadPointer: number | null = null;
  private dpadDir: Direction | null = null;

  constructor(
    private readonly doc: Document,
    private readonly service: Input,
  ) {}

  /** Build the overlay inside `parent` and start listening. */
  mount(parent: HTMLElement): void {
    const root = this.doc.createElement('div');
    root.className = 'touch-controls';
    root.dataset['testid'] = 'touch-controls';
    this.root = root;

    const dpad = this.doc.createElement('div');
    dpad.className = 'tc-dpad';
    dpad.dataset['control'] = 'dpad';
    for (const dir of ['up', 'down', 'left', 'right'] as const) {
      const arm = this.doc.createElement('div');
      arm.className = `tc-arm tc-arm-${dir}`;
      dpad.appendChild(arm);
      this.arms.set(dir, arm);
    }
    this.bindDpad(dpad);
    root.appendChild(dpad);
    this.dpad = dpad;

    for (const b of TOUCH_BUTTONS) {
      const el = this.doc.createElement('div');
      el.className = `tc-button tc-${b.id}`;
      el.dataset['control'] = b.id;
      el.textContent = t(b.label);
      this.bindButton(el, b.id, b.action);
      root.appendChild(el);
      this.buttons.set(b.id, el);
    }

    // No browser behaviour on the controls: scrolling, zooming, selecting, the long-press menu.
    const cancel = (e: Event) => {
      if (e.cancelable) e.preventDefault();
    };
    for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel'])
      root.addEventListener(type, cancel, { passive: false });
    for (const type of ['contextmenu', 'selectstart', 'dblclick']) root.addEventListener(type, cancel);

    parent.appendChild(root);
    const view = this.doc.defaultView;
    view?.addEventListener('blur', () => this.reset());
    this.doc.addEventListener('visibilitychange', () => {
      if (this.doc.hidden) this.reset();
    });
  }

  /** Release every touch control (focus lost, page hidden, phone turned to portrait). */
  reset(): void {
    this.setDpad(null);
    this.dpadPointer = null;
    for (const [id, pointers] of this.held) {
      const action = TOUCH_BUTTONS.find((b) => b.id === id)?.action;
      if (action) for (const p of pointers) this.service.release(action, `${SOURCE}:${id}:${p}`);
      this.buttons.get(id)?.classList.remove('tc-down');
    }
    this.held.clear();
  }

  /** The overlay as data (for the E2E hooks). */
  view(): TouchView {
    const controls: TouchControlView[] = [];
    const add = (id: string, el: HTMLElement | null) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      controls.push({ id, x: r.x, y: r.y, width: r.width, height: r.height });
    };
    add('dpad', this.dpad);
    for (const [id, el] of this.buttons) add(id, el);
    const pressed = [...this.held.entries()].filter(([, p]) => p.size > 0).map(([id]) => id);
    if (this.dpadDir) pressed.unshift(`dpad:${this.dpadDir}`);
    const shown = this.root !== null && this.doc.defaultView?.getComputedStyle(this.root).display !== 'none';
    return { shown, controls, pressed };
  }

  private bindButton(el: HTMLElement, id: string, action: Action): void {
    el.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      capture(el, e.pointerId);
      let pointers = this.held.get(id);
      if (!pointers) {
        pointers = new Set();
        this.held.set(id, pointers);
      }
      pointers.add(e.pointerId);
      el.classList.add('tc-down');
      this.service.press(action, `${SOURCE}:${id}:${e.pointerId}`);
    });
    const up = (e: PointerEvent) => {
      const pointers = this.held.get(id);
      if (!pointers?.delete(e.pointerId)) return;
      this.service.release(action, `${SOURCE}:${id}:${e.pointerId}`);
      if (pointers.size === 0) el.classList.remove('tc-down');
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  private bindDpad(el: HTMLElement): void {
    const dirAt = (e: PointerEvent): Direction | null => {
      const r = el.getBoundingClientRect();
      const half = Math.min(r.width, r.height) / 2;
      return dpadDirection(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2), half);
    };
    el.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      if (this.dpadPointer !== null) return;
      this.dpadPointer = e.pointerId;
      capture(el, e.pointerId);
      this.setDpad(dirAt(e));
    });
    el.addEventListener('pointermove', (e: PointerEvent) => {
      if (e.pointerId === this.dpadPointer) this.setDpad(dirAt(e));
    });
    const up = (e: PointerEvent) => {
      if (e.pointerId !== this.dpadPointer) return;
      this.dpadPointer = null;
      this.setDpad(null);
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  /** Hold `dir` on the D-pad (releasing the previous direction), or nothing. */
  private setDpad(dir: Direction | null): void {
    if (dir === this.dpadDir) return;
    if (this.dpadDir) {
      this.service.release(this.dpadDir, `${SOURCE}:dpad`);
      this.arms.get(this.dpadDir)?.classList.remove('tc-down');
    }
    this.dpadDir = dir;
    if (dir) {
      this.service.press(dir, `${SOURCE}:dpad`);
      this.arms.get(dir)?.classList.add('tc-down');
    }
  }
}

/** Keep sending a finger's events to `el` after it slides off (ignored where unsupported). */
function capture(el: HTMLElement, pointerId: number): void {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    // Synthetic pointers (tests) or old browsers: the element still gets the events it is under.
  }
}

/**
 * Stop page-level browser gestures on touch devices: pinch zoom (iOS `gesture*` events), double-tap zoom
 * (`dblclick`) and scrolling by dragging (`touchmove`). The CSS `touch-action: none` in `index.html` does the
 * same where it is supported; this covers the rest.
 */
export function preventBrowserGestures(doc: Document): void {
  const cancel = (e: Event) => {
    if (e.cancelable) e.preventDefault();
  };
  for (const type of ['gesturestart', 'gesturechange', 'gestureend', 'dblclick'])
    doc.addEventListener(type, cancel);
  doc.addEventListener('touchmove', cancel, { passive: false });
}
