/**
 * The Audi to Murcia (docs/CONTENT.md › The Audi). Pure rules, no Phaser:
 * - The office car (a map warp with `car = murcia`) opens only if the player owns BOTH items of ANY pair in
 *   `car.json › unlockPairs`. Owning means a count of at least 1; the items are only checked, never consumed.
 * - The Murcia car (`car = valencia`) has no requirement.
 * - The trip itself (CarScene) lasts `CAR_TRIP_MS`; any button skips it once `CAR_SKIP_AFTER_MS` have passed.
 */
import type { Car, MapPoint } from '../data/schemas';
import { CAR_SKIP_AFTER_MS, CAR_TRIP_MS } from './constants';
import { hasItem, type Inventory } from './inventory';

/** Where a car drives to: `murcia` (the office car) or `valencia` (the car in Murcia, back to the office). */
export type CarDestination = 'murcia' | 'valencia';

/** True if `items` holds both items of at least one pair. */
export function ownsUnlockPair(pairs: Car['unlockPairs'], items: Inventory): boolean {
  return pairs.some(([a, b]) => hasItem(items, a) && hasItem(items, b));
}

/** True if the car going to `to` may be used with this bag: the trip to Murcia needs a pair, the way back nothing. */
export function carUnlocked(car: Pick<Car, 'unlockPairs'>, to: CarDestination, items: Inventory): boolean {
  return to === 'valencia' || ownsUnlockPair(car.unlockPairs, items);
}

/** The arrival point of a trip (`car.json › toMurcia` or `toValencia`). */
export function carArrival(car: Pick<Car, 'toMurcia' | 'toValencia'>, to: CarDestination): MapPoint {
  return to === 'murcia' ? car.toMurcia : car.toValencia;
}

/** True once the trip may be skipped with a button press (`elapsedMs` since it started). */
export function canSkipTrip(elapsedMs: number): boolean {
  return elapsedMs >= CAR_SKIP_AFTER_MS;
}

/** True when the trip has run its full length. */
export function tripOver(elapsedMs: number): boolean {
  return elapsedMs >= CAR_TRIP_MS;
}
