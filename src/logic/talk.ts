/**
 * What an NPC says when the player talks to it, by NPC type, and what happens around it:
 * - `talker`: its `dialogue`.
 * - `enemy`: its `dialogue` while `ready` (said before the battle); only its `defeatDialogue`
 *   while in `cooldown`.
 * - `healer`: heals the team and the storage box first (`talkAction` → `heal`), then says
 *   `healer.done` ("Tus flexymon están como nuevos.") and its dialogue; the game then auto-saves.
 * - `storage`: says its dialogue, then the storage box opens (`talkAction` → `storage`).
 * - `shopkeeper`: says its dialogue, then its shop opens (`talkAction` → `shop`).
 * UI texts come from `src/i18n/es.json`; the caller passes the translator.
 */
import type { Npc } from '../data/schemas';
import type { NpcState } from './npc-state';

/** What an NPC does besides talking: before its lines (`heal`) or after them (`storage`, `shop`). */
export type TalkAction = 'heal' | 'storage' | 'shop' | null;

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
      return [t('healer.done'), ...npc.dialogue];
    default:
      return [...npc.dialogue];
  }
}

/** The action of a talk with `npc` (see the module rules); `null` for talkers and enemies. */
export function talkAction(npc: Pick<Npc, 'type'>): TalkAction {
  switch (npc.type) {
    case 'healer':
      return 'heal';
    case 'storage':
      return 'storage';
    case 'shopkeeper':
      return 'shop';
    default:
      return null;
  }
}
