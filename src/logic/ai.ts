/**
 * Opponent AI (docs/PLAN.md › Opponent AI).
 * - Wild: a random attack, equal chance (`rng.pick`).
 * - NPC enemy: below `NPC_LOW_HP` of max HP with a heal attack → heals (first heal attack in its list).
 *   Otherwise the damage attack with the highest `power × accuracy` (first one on a tie). No damage
 *   attack → a random one. NPCs never use items or switch.
 */
import type { Rng } from '../core/rng';
import type { Attack } from '../data/schemas';
import { NPC_LOW_HP } from './constants';

/** Who the AI is playing for. */
export type OpponentKind = 'wild' | 'npc';

/** What the AI needs to know: its attacks (in species order) and its HP. */
export interface AiInput {
  kind: OpponentKind;
  attacks: readonly Attack[];
  currentHp: number;
  maxHp: number;
}

/** Choose the opponent's attack id for this round. Throws if the species has no attacks. */
export function chooseOpponentAttack(input: AiInput, rng: Rng): string {
  const { attacks } = input;
  if (attacks.length === 0) throw new Error('chooseOpponentAttack: no attacks');
  if (input.kind === 'wild') return rng.pick(attacks).id;

  if (input.currentHp < input.maxHp * NPC_LOW_HP) {
    const healer = attacks.find((a) => a.effect.type === 'heal');
    if (healer) return healer.id;
  }
  let best: Attack | null = null;
  let bestScore = -1;
  for (const a of attacks) {
    if (a.effect.type !== 'damage') continue;
    const score = a.effect.power * a.accuracy;
    if (score > bestScore) {
      best = a;
      bestScore = score;
    }
  }
  return best ? best.id : rng.pick(attacks).id;
}
