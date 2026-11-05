import { describe, expect, it } from 'vitest';
import { MUSIC_FADE_MS } from '../../src/logic/constants';
import { MUSIC_VOLUME, MusicPlayer, type Track } from '../../src/world/music';

/** A fake track recording calls. */
function fakeTracks() {
  const made: (Track & { key: string; volume: number; playing: boolean; destroyed: boolean })[] = [];
  const make = (key: string) => {
    const t = {
      key,
      volume: -1,
      playing: false,
      destroyed: false,
      play() {
        t.playing = true;
      },
      stop() {
        t.playing = false;
      },
      destroy() {
        t.destroyed = true;
      },
      setVolume(v: number) {
        t.volume = v;
      },
    };
    made.push(t);
    return t;
  };
  return { made, make };
}

describe('MusicPlayer', () => {
  it('fades the first track in over 500 ms', () => {
    expect(MUSIC_FADE_MS).toBe(500);
    const { made, make } = fakeTracks();
    const m = new MusicPlayer(make);
    m.play('a.ogg');
    expect(made[0]).toMatchObject({ key: 'a.ogg', playing: true, volume: 0 });
    m.update(250);
    expect(made[0]!.volume).toBeCloseTo(MUSIC_VOLUME / 2);
    m.update(1000);
    expect(made[0]!.volume).toBeCloseTo(MUSIC_VOLUME);
  });

  it('keeps playing when the next zone uses the same file', () => {
    const { made, make } = fakeTracks();
    const m = new MusicPlayer(make);
    m.play('a.ogg');
    m.update(600);
    m.play('a.ogg');
    expect(made).toHaveLength(1);
    expect(m.currentKey()).toBe('a.ogg');
  });

  it('crossfades to a different file in 500 ms, then stops and destroys the old one', () => {
    const { made, make } = fakeTracks();
    const m = new MusicPlayer(make);
    m.play('a.ogg');
    m.update(600);
    m.play('b.ogg');
    expect(m.currentKey()).toBe('b.ogg');
    m.update(250);
    expect(made[0]!.volume).toBeCloseTo(MUSIC_VOLUME / 2);
    expect(made[1]!.volume).toBeCloseTo(MUSIC_VOLUME / 2);
    expect(m.fadingCount()).toBe(1);
    m.update(250);
    expect(made[0]).toMatchObject({ playing: false, destroyed: true, volume: 0 });
    expect(made[1]!.volume).toBeCloseTo(MUSIC_VOLUME);
    expect(m.fadingCount()).toBe(0);
  });

  it('stop fades everything out', () => {
    const { made, make } = fakeTracks();
    const m = new MusicPlayer(make);
    m.stop();
    m.play('a.ogg');
    m.update(500);
    m.stop();
    expect(m.currentKey()).toBeNull();
    m.update(500);
    expect(made[0]!.destroyed).toBe(true);
  });

  it('scales every track by the music option gain, at once and during fades (M10)', () => {
    const { made, make } = fakeTracks();
    const m = new MusicPlayer(make);
    expect(m.getGain()).toBe(1);
    m.play('a.ogg');
    m.update(500);
    m.setGain(0.5);
    expect(made[0]!.volume).toBeCloseTo(MUSIC_VOLUME * 0.5);
    m.play('b.ogg');
    m.update(250);
    expect(made[0]!.volume).toBeCloseTo((MUSIC_VOLUME / 2) * 0.5);
    expect(made[1]!.volume).toBeCloseTo((MUSIC_VOLUME / 2) * 0.5);
    m.setGain(0);
    expect(made[1]!.volume).toBe(0);
    m.setGain(3);
    expect(m.getGain()).toBe(1);
  });
});
