/**
 * Buffs and debuffs (docs/PLAN.md › Buffs and debuffs). A modifier lives on the *active* flexymon of a
 * battle side. Effective stat = `stat × (100 + Σbuff − Σdebuff) / 100`, clamped to
 * [`MOD_MIN` × stat, `MOD_MAX` × stat], floored, minimum 1. The same attack or item used again on the
 * same flexymon replaces its old modifier (turns reset) instead of stacking.
 */
import type { ModStat } from '../data/schemas';
import { MOD_MAX, MOD_MIN } from './constants';

/** One active buff or debuff. */
export interface Modifier {
  /** What applied it: `attack:<id>` or `item:<id>`. Same source on the same flexymon replaces. */
  source: string;
  kind: 'buff' | 'debuff';
  stat: ModStat;
  /** Always positive; `kind` gives the sign. */
  percent: number;
  /** Rounds left; the modifier is removed when this reaches 0. */
  turnsLeft: number;
}

/** Small tolerance so float noise (e.g. 2.9999999) never floors a whole number down. */
const EPSILON = 1e-9;

/** Effective value of `stat` (base + bonus) under `mods`. */
export function effectiveStat(value: number, mods: readonly Modifier[], stat: ModStat): number {
  let percent = 100;
  for (const m of mods) {
    if (m.stat !== stat) continue;
    percent += m.kind === 'buff' ? m.percent : -m.percent;
  }
  const raw = (value * percent) / 100;
  const clamped = Math.min(value * MOD_MAX, Math.max(value * MOD_MIN, raw));
  return Math.max(1, Math.floor(clamped + EPSILON));
}

/** Add `mod`, replacing any modifier with the same `source` (turns reset). Returns a new list. */
export function applyModifier(mods: readonly Modifier[], mod: Modifier): Modifier[] {
  return [...mods.filter((m) => m.source !== mod.source), { ...mod }];
}

/** End of round: every modifier loses one turn. Returns the ones kept and the ones that ran out. */
export function tickModifiers(mods: readonly Modifier[]): { kept: Modifier[]; expired: Modifier[] } {
  const kept: Modifier[] = [];
  const expired: Modifier[] = [];
  for (const m of mods) {
    const next = { ...m, turnsLeft: m.turnsLeft - 1 };
    (next.turnsLeft > 0 ? kept : expired).push(next);
  }
  return { kept, expired };
}
