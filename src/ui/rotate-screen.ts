/**
 * Portrait guard and fullscreen. Flexymon is played in landscape only.
 *
 * - {@link RotateScreen}: on touch devices, while the screen is taller than wide ({@link isPortrait}) a black
 *   HTML screen covers everything with "Gira el móvil" (`mobile.rotate`, `mobile.rotate_hint` in `es.json`) and
 *   `onChange(true)` is called so `main.ts` pauses the game; turning back to landscape hides it and calls
 *   `onChange(false)`. Checked at start and on every `resize` / `orientationchange`.
 * - {@link requestFullscreenOnFirstTap}: the first finger lifted anywhere on the page asks for fullscreen (and,
 *   where allowed, locks the orientation to landscape). Browsers only allow it from a tap, and iPhone Safari
 *   has no fullscreen for pages: failures are ignored.
 */
import { t } from '../i18n';

/** True when a `width × height` screen is portrait (taller than wide; a square counts as landscape). */
export function isPortrait(width: number, height: number): boolean {
  return height > width;
}

/** The black "turn your phone" screen. Create it, then {@link RotateScreen.mount} it. */
export class RotateScreen {
  private root: HTMLElement | null = null;
  private portrait: boolean | null = null;

  constructor(
    private readonly doc: Document,
    private readonly win: Window,
    private readonly onChange: (portrait: boolean) => void,
  ) {}

  /** Build the screen inside `parent`, apply the current orientation and follow its changes. */
  mount(parent: HTMLElement): void {
    const root = this.doc.createElement('div');
    root.className = 'rotate-screen';
    root.dataset['testid'] = 'rotate-screen';
    const icon = this.doc.createElement('div');
    icon.className = 'rotate-phone';
    const title = this.doc.createElement('div');
    title.className = 'rotate-title';
    title.textContent = t('mobile.rotate');
    const hint = this.doc.createElement('div');
    hint.className = 'rotate-hint';
    hint.textContent = t('mobile.rotate_hint');
    root.append(icon, title, hint);
    parent.appendChild(root);
    this.root = root;
    const check = () => this.apply();
    this.win.addEventListener('resize', check);
    this.win.addEventListener('orientationchange', check);
    this.apply();
  }

  /** True while the screen shows. */
  get shown(): boolean {
    return this.portrait === true;
  }

  private apply(): void {
    const portrait = isPortrait(this.win.innerWidth, this.win.innerHeight);
    if (portrait === this.portrait) return;
    this.portrait = portrait;
    this.root?.classList.toggle('rotate-shown', portrait);
    this.onChange(portrait);
  }
}

/** `requestFullscreen` with the prefixed Safari variant (iPad) as a fallback. */
interface FullscreenElement {
  requestFullscreen?: (options?: { navigationUI?: 'hide' | 'show' | 'auto' }) => Promise<void>;
  webkitRequestFullscreen?: () => void;
}

/** `screen.orientation.lock`, missing from TypeScript's DOM types and from most browsers outside fullscreen. */
interface LockableOrientation {
  lock?: (orientation: 'landscape') => Promise<void>;
}

/**
 * On the first finger lifted on the page (`pointerup` from a touch), ask for fullscreen and then a landscape
 * orientation lock. Calls `onRequest` once when it asks (for the E2E hooks). Errors are swallowed: not every
 * browser allows either.
 */
export function requestFullscreenOnFirstTap(
  doc: Document,
  win: Window,
  onRequest: () => void = () => {},
): void {
  const handler = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    doc.removeEventListener('pointerup', handler, true);
    onRequest();
    const el = doc.documentElement as unknown as FullscreenElement;
    const lock = () => {
      const orientation = win.screen?.orientation as unknown as LockableOrientation | undefined;
      orientation?.lock?.('landscape').catch(() => {});
    };
    try {
      if (el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).then(lock, () => {});
      else el.webkitRequestFullscreen?.();
    } catch {
      // Not allowed here (an iframe, an old browser): keep playing in the page.
    }
  };
  doc.addEventListener('pointerup', handler, true);
}
