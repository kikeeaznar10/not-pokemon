/**
 * What an NPC says when the player talks to it (M5), by NPC type:
 * - `talker`, `shopkeeper` (shop opens in M9) and `enemy` (battles start in M8): its `dialogue`.
 * - `healer`: heals the team, then says its dialogue. Until M9 the heal is a placeholder box
 *   (`npc.healer_placeholder`, "[curar]") shown before the dialogue.
 * - `storage`: says its dialogue, then opens the storage box. Until M9 the box is a placeholder
 *   (`npc.storage_placeholder`, "[caja]") shown after the dialogue.
 * The placeholder texts come from `src/i18n/es.json`; the caller passes the translator.
 */
import type { Npc } from '../data/schemas';

/** The dialogue strings shown, in order, when the player talks to `npc`. */
export function talkLines(npc: Pick<Npc, 'type' | 'dialogue'>, t: (key: string) => string): string[] {
  switch (npc.type) {
    case 'healer':
      return [t('npc.healer_placeholder'), ...npc.dialogue];
    case 'storage':
      return [...npc.dialogue, t('npc.storage_placeholder')];
    default:
      return [...npc.dialogue];
  }
}
