/**
 * What an NPC says when the player talks to it (M5), by NPC type:
 * - `talker` and `shopkeeper` (shop opens in M9): its `dialogue`.
 * - `enemy` (M8): its `dialogue` while `ready` (said before the battle); only its `defeatDialogue`
 *   while in `cooldown`.
 * - `healer`: heals the team, then says its dialogue. Until M9 the heal is a placeholder box
 *   (`npc.healer_placeholder`, "[curar]") shown before the dialogue.
 * - `storage`: says its dialogue, then opens the storage box. Until M9 the box is a placeholder
 *   (`npc.storage_placeholder`, "[caja]") shown after the dialogue.
 * The placeholder texts come from `src/i18n/es.json`; the caller passes the translator.
 */
import type { Npc } from '../data/schemas';
import type { NpcState } from './npc-state';

/**
 * The dialogue strings shown, in order, when the player talks to `npc`. `state` only matters for enemies
 * (missing = `ready`).
 */
export function talkLines(
  npc: Pick<Npc, 'type' | 'dialogue'> & { readonly defeatDialogue?: readonly string[] },
  t: (key: string) => string,
  state: NpcState = 'ready',
): string[] {
  switch (npc.type) {
    case 'enemy':
      return [...(state === 'cooldown' ? (npc.defeatDialogue ?? npc.dialogue) : npc.dialogue)];
    case 'healer':
      return [t('npc.healer_placeholder'), ...npc.dialogue];
    case 'storage':
      return [...npc.dialogue, t('npc.storage_placeholder')];
    default:
      return [...npc.dialogue];
  }
}
