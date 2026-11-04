/**
 * The bag: `{ itemId: count }`, each count 0–`ITEM_COUNT_MAX` (an id with count 0 is removed).
 * Pure helpers shared by shops, battles, secret names and the field menu.
 */
import { ITEM_COUNT_MAX } from './constants';

/** Item id → count. */
export type Inventory = Record<string, number>;

/** How many of an item the bag holds (0 if none). */
export function itemCount(items: Readonly<Inventory>, id: string): number {
  return items[id] ?? 0;
}

/** True if the bag holds at least one. */
export function hasItem(items: Readonly<Inventory>, id: string): boolean {
  return itemCount(items, id) > 0;
}

/** How many more of an item fit in the bag. */
export function roomFor(items: Readonly<Inventory>, id: string): number {
  return Math.max(0, ITEM_COUNT_MAX - itemCount(items, id));
}

/** Add `n` (≥ 0) of an item, capped at `ITEM_COUNT_MAX`. Returns the new bag and how many were added. */
export function addItem(
  items: Readonly<Inventory>,
  id: string,
  n: number,
): { items: Inventory; added: number } {
  const added = Math.min(Math.max(0, Math.floor(n)), roomFor(items, id));
  if (added === 0) return { items: { ...items }, added: 0 };
  return { items: { ...items, [id]: itemCount(items, id) + added }, added };
}

/** Remove `n` of an item; returns `null` if the bag holds fewer than `n`. A count of 0 drops the id. */
export function removeItem(items: Readonly<Inventory>, id: string, n: number): Inventory | null {
  const have = itemCount(items, id);
  if (n < 0 || have < n) return null;
  const next = { ...items };
  if (have - n > 0) next[id] = have - n;
  else delete next[id];
  return next;
}
