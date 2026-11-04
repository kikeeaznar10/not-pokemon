/**
 * Zone music (M4). `play(key)` keeps the current track when the next zone uses the same file;
 * otherwise the old track fades out and the new one fades in over `MUSIC_FADE_MS` (a crossfade).
 * Fades advance in `update(dtMs)`, driven by the game loop in `main.ts`, so they keep running while
 * the Overworld scene restarts on a warp. `main.ts` calls `play()` on every `zone:entered` event.
 *
 * The player is engine-free: it receives a `makeTrack(key)` factory (Phaser's `sound.add` in the game,
 * fakes in tests). Audio only becomes audible after the first user gesture (browser rule; Phaser
 * unlocks it), and the title needs a key press, so this happens before any zone plays.
 */
import { MUSIC_FADE_MS } from '../logic/constants';

/** The bits of a Phaser sound the player uses. */
export interface Track {
  play(): unknown;
  stop(): unknown;
  destroy(): void;
  setVolume(volume: number): unknown;
}

/** Full music volume (0–1). The options menu (M10) will scale it. */
export const MUSIC_VOLUME = 0.6;

interface Playing {
  key: string;
  track: Track;
  /** 0–1 fade level (multiplied by `MUSIC_VOLUME`). */
  level: number;
}

/** Plays one looping track at a time with crossfades. */
export class MusicPlayer {
  private current: Playing | null = null;
  private fading: Playing[] = [];

  /** @param makeTrack creates a looping track for a sound key */
  constructor(private readonly makeTrack: (key: string) => Track) {}

  /** Key of the track playing (or fading in), or `null`. */
  currentKey(): string | null {
    return this.current?.key ?? null;
  }

  /** Number of tracks still fading out (for tests). */
  fadingCount(): number {
    return this.fading.length;
  }

  /** Switch to `key`: nothing if it is already playing, else crossfade. */
  play(key: string): void {
    if (this.current?.key === key) return;
    if (this.current) this.fading.push(this.current);
    const track = this.makeTrack(key);
    track.setVolume(0);
    track.play();
    this.current = { key, track, level: 0 };
  }

  /** Fade out whatever is playing. */
  stop(): void {
    if (this.current) this.fading.push(this.current);
    this.current = null;
  }

  /** Advance fades by `dtMs`. */
  update(dtMs: number): void {
    const step = dtMs / MUSIC_FADE_MS;
    if (this.current && this.current.level < 1) {
      this.current.level = Math.min(1, this.current.level + step);
      this.current.track.setVolume(this.current.level * MUSIC_VOLUME);
    }
    this.fading = this.fading.filter((f) => {
      f.level = Math.max(0, f.level - step);
      f.track.setVolume(f.level * MUSIC_VOLUME);
      if (f.level > 0) return true;
      f.track.stop();
      f.track.destroy();
      return false;
    });
  }
}
