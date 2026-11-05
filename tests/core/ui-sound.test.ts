import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearUiSounds,
  setUiSoundPlayer,
  UI_SOUND_HISTORY,
  uiSound,
  uiSoundsPlayed,
} from '../../src/core/ui-sound';

afterEach(() => {
  setUiSoundPlayer(null);
  clearUiSounds();
});

describe('uiSound (M15)', () => {
  it('records every call and hands it to the installed player', () => {
    const play = vi.fn();
    uiSound('cursor');
    setUiSoundPlayer(play);
    uiSound('money');
    expect(uiSoundsPlayed()).toEqual(['cursor', 'money']);
    expect(play).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledWith('money');
  });

  it('keeps only the last UI_SOUND_HISTORY calls', () => {
    for (let i = 0; i < UI_SOUND_HISTORY + 5; i++) uiSound('cursor');
    uiSound('error');
    const played = uiSoundsPlayed();
    expect(played).toHaveLength(UI_SOUND_HISTORY);
    expect(played[played.length - 1]).toBe('error');
  });
});
