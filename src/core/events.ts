/**
 * Typed event bus. Scenes talk through it instead of reaching into each other.
 *
 * Add new events to {@link GameEvents}: the key is the event name, the value its payload type
 * (`void` for no payload).
 */
import type { Options } from '../logic/options';

/** Every game-wide event and its payload. Milestones add entries here. */
export interface GameEvents {
  /** Content JSON loaded and validated; `getGameData()` is available. */
  'data:loaded': void;
  /** Content failed validation; payload = formatted `file › path › message` lines. */
  'data:error': string[];
  /** Preload finished; all assets are in the cache. */
  'game:ready': void;
  /** The overworld finished building a zone's map (M3). */
  'zone:entered': { zone: string };
  /** The player finished a step, was placed on a map (M3) or turned on the spot (M10). Tile coordinates match Tiled. */
  'player:moved': { map: string; x: number; y: number; facing: 'up' | 'down' | 'left' | 'right' };
  /** Debug menu (M4): opened/closed. While open the overworld ignores movement. */
  'debug:menu': { open: boolean };
  /** Debug command (M4): teleport the player to a zone's `default` spawn. */
  'debug:teleport': { map: string };
  /** Debug command (M6): start a wild battle against one fresh flexymon of this species. */
  'debug:battle': { speciesId: string };
  /** The BattleScene finished (M6); the game state already holds the team after the battle. */
  'battle:ended': { result: 'win' | 'lose' | 'fled' };
  /**
   * A point where the game auto-saves (M9 emits `healer` and `shop`; M10 adds `map` (overworld entered a
   * map), `battle` (battle ended) and `menu` (Start menu closed); `src/core/autosave.ts` writes the save).
   */
  'save:request': { reason: 'healer' | 'shop' | 'map' | 'battle' | 'menu' };
  /** An overlay scene opened from the overworld (M9: Shop, Storage; M10: Menu) closed; the overworld resumes. */
  'overlay:closed': { scene: string };
  /** A save was written for this reason (M10; the HUD shows "Guardando…"). Quiet saves on page hide are not announced. */
  'save:done': { reason: 'healer' | 'shop' | 'map' | 'battle' | 'menu' };
  /** The player changed an option (M10); payload = the new options. */
  'options:changed': Options;
  /** Debug command (M10): delete the save and reload the page. */
  'debug:delete_save': void;
}

type Handler<P> = P extends void ? () => void : (payload: P) => void;

/** A small typed emitter over an event map `E`. */
export class EventBus<E extends object> {
  private readonly handlers = new Map<keyof E, Set<(payload: unknown) => void>>();

  /** Subscribe; returns a function that unsubscribes. */
  on<K extends keyof E>(name: K, handler: Handler<E[K]>): () => void {
    let set = this.handlers.get(name);
    if (!set) {
      set = new Set();
      this.handlers.set(name, set);
    }
    set.add(handler as (payload: unknown) => void);
    return () => this.off(name, handler);
  }

  /** Subscribe for a single emission only. */
  once<K extends keyof E>(name: K, handler: Handler<E[K]>): () => void {
    const wrapper = ((payload: unknown) => {
      off();
      (handler as (payload: unknown) => void)(payload);
    }) as Handler<E[K]>;
    const off = this.on(name, wrapper);
    return off;
  }

  /** Unsubscribe a handler previously passed to {@link on}. */
  off<K extends keyof E>(name: K, handler: Handler<E[K]>): void {
    this.handlers.get(name)?.delete(handler as (payload: unknown) => void);
  }

  /** Call every handler of `name`, in subscription order. */
  emit<K extends keyof E>(name: K, ...payload: E[K] extends void ? [] : [E[K]]): void {
    const set = this.handlers.get(name);
    if (!set) return;
    for (const h of [...set]) h(payload[0]);
  }

  /** Remove every handler (all events, or only `name`). */
  clear(name?: keyof E): void {
    if (name === undefined) this.handlers.clear();
    else this.handlers.delete(name);
  }
}

/** The shared game event bus. */
export const events = new EventBus<GameEvents>();
