import { describe, expect, it } from 'vitest';
import { canSkipTrip, carArrival, carUnlocked, ownsUnlockPair, tripOver } from '../../src/logic/car';
import { CAR_SKIP_AFTER_MS, CAR_TRIP_MS } from '../../src/logic/constants';

const car = {
  unlockPairs: [
    ['llaves_audi', 'carnet'],
    ['llaves_audi', 'cafe_doble'],
  ] as [string, string][],
  toMurcia: { map: 'murcia', x: 10, y: 5, facing: 'down' as const },
  toValencia: { map: 'oficina_exterior', x: 8, y: 12, facing: 'down' as const },
};

describe('car (M13)', () => {
  it('opens with both items of any pair, not with one item or an empty bag', () => {
    expect(ownsUnlockPair(car.unlockPairs, { llaves_audi: 1, carnet: 1 })).toBe(true);
    expect(ownsUnlockPair(car.unlockPairs, { llaves_audi: 2, cafe_doble: 5 })).toBe(true);
    expect(ownsUnlockPair(car.unlockPairs, { llaves_audi: 1 })).toBe(false);
    expect(ownsUnlockPair(car.unlockPairs, { carnet: 1, cafe_doble: 1 })).toBe(false);
    expect(ownsUnlockPair(car.unlockPairs, { llaves_audi: 1, carnet: 0 })).toBe(false);
    expect(ownsUnlockPair(car.unlockPairs, {})).toBe(false);
  });

  it('only the trip to Murcia needs a pair; the way back has no requirement', () => {
    expect(carUnlocked(car, 'murcia', {})).toBe(false);
    expect(carUnlocked(car, 'murcia', { llaves_audi: 1, carnet: 1 })).toBe(true);
    expect(carUnlocked(car, 'valencia', {})).toBe(true);
  });

  it('arrives at the car.json endpoints', () => {
    expect(carArrival(car, 'murcia')).toEqual(car.toMurcia);
    expect(carArrival(car, 'valencia')).toEqual(car.toValencia);
  });

  it('lasts 4–6 s and can be skipped after 1 s', () => {
    expect(CAR_TRIP_MS).toBeGreaterThanOrEqual(4000);
    expect(CAR_TRIP_MS).toBeLessThanOrEqual(6000);
    expect(CAR_SKIP_AFTER_MS).toBe(1000);
    expect(canSkipTrip(999)).toBe(false);
    expect(canSkipTrip(1000)).toBe(true);
    expect(tripOver(CAR_TRIP_MS - 1)).toBe(false);
    expect(tripOver(CAR_TRIP_MS)).toBe(true);
  });
});
