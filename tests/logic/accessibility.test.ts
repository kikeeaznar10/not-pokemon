import { describe, expect, it } from 'vitest';
import { blinkRate, burstRate, flashRateOk } from '../../src/logic/accessibility';
import {
  BATTLE_FLASHES,
  BATTLE_FLASH_MS,
  DIALOG_ARROW_BLINK_MS,
  HIT_DIM_MS,
  MAX_FLASHES_PER_SECOND,
  MINIMAP_BLINK_MS,
  TITLE_BLINK_MS,
} from '../../src/logic/constants';

describe('accessibility helpers', () => {
  it('blinkRate: on + off is one flash', () => {
    expect(blinkRate(500)).toBe(1);
    expect(blinkRate(250)).toBe(2);
  });

  it('burstRate: most flashes in any one-second window', () => {
    expect(burstRate(3, 600)).toBe(3); // the old battle transition: too many
    expect(burstRate(2, 600)).toBe(2);
    expect(burstRate(1, 100)).toBe(1);
    expect(burstRate(10, 10_000)).toBe(2);
  });

  it('flashRateOk: strictly under the limit', () => {
    expect(flashRateOk(MAX_FLASHES_PER_SECOND)).toBe(false);
    expect(flashRateOk(MAX_FLASHES_PER_SECOND - 0.1)).toBe(true);
  });
});

describe('every flashing effect stays under 3 flashes per second', () => {
  it.each([
    ['title "Pulsa START"', blinkRate(TITLE_BLINK_MS)],
    ['dialogue arrow', blinkRate(DIALOG_ARROW_BLINK_MS)],
    ['minimap dot', blinkRate(MINIMAP_BLINK_MS)],
    ['battle transition', burstRate(BATTLE_FLASHES, BATTLE_FLASH_MS)],
    ['hit dim (once per hit)', burstRate(1, HIT_DIM_MS)],
  ])('%s', (_name, rate) => {
    expect(flashRateOk(rate)).toBe(true);
  });
});
