/**
 * New-game intro rules (M11, pure). The IntroScene plays `intro.json`'s steps; this file holds the parts
 * that are rules, not drawing:
 * - {@link fillIntroText}: `{name}` (the player's name) and `{starter}` (the starter's species name) in the
 *   coworker's lines;
 * - {@link findSecretName} / {@link applySecretName}: docs/PLAN.md › `secret-names.json` — matching ignores
 *   case, accents and surrounding spaces (`normalizeName`), at most one entry matches, its items go into the
 *   bag (capped at `ITEM_COUNT_MAX` per item, like any other gain);
 * - {@link traceIntro}: every tile each actor stands on while the script runs, so the boot checks can
 *   reject a script that walks into a wall or into the other actor.
 */
import type { IntroActor, IntroStep, SecretName } from '../data/schemas';
import { addItem } from './inventory';
import { normalizeName } from './names';
import { FACING_DELTA, type Point } from './npc-state';
import type { GameState } from './save';

/** Fill `{name}` and `{starter}` in an intro line; other `{…}` placeholders are left as they are. */
export function fillIntroText(line: string, vars: { name: string; starter: string }): string {
  return line.replace(/\{(name|starter)\}/g, (_whole, key: 'name' | 'starter') => vars[key]);
}

/** The secret-names entry matching `name` (ignoring case, accents and surrounding spaces), or `null`. */
export function findSecretName(
  name: string,
  secretNames: readonly Readonly<SecretName>[],
): Readonly<SecretName> | null {
  const key = normalizeName(name);
  if (key === '') return null;
  return secretNames.find((s) => normalizeName(s.name) === key) ?? null;
}

/** Add a secret name's items to the bag (each capped by the bag's room). Returns a new state. */
export function applySecretName(state: GameState, entry: Readonly<SecretName>): GameState {
  let items = state.items;
  for (const [id, n] of Object.entries(entry.items)) items = addItem(items, id, n).items;
  return { ...state, items };
}

/** One tile an actor stands on during the intro (after `step` ran), and where the other actor stands. */
export interface IntroVisit {
  step: number;
  actor: IntroActor;
  x: number;
  y: number;
  other: Point;
}

/** Positions after the script: every tile walked on, and where both actors end. */
export interface IntroTrace {
  visits: IntroVisit[];
  player: Point;
  coworker: Point;
}

/**
 * Follow the `walk` steps from the starting tiles of the player and the coworker. Every tile entered is
 * a visit (with the other actor's tile at that moment); the start tiles are visits of step `-1`.
 */
export function traceIntro(steps: readonly IntroStep[], player: Point, coworker: Point): IntroTrace {
  const pos: Record<IntroActor, Point> = { player: { ...player }, coworker: { ...coworker } };
  const other = (a: IntroActor): IntroActor => (a === 'player' ? 'coworker' : 'player');
  const visits: IntroVisit[] = (['player', 'coworker'] as const).map((actor) => ({
    step: -1,
    actor,
    ...pos[actor],
    other: { ...pos[other(actor)] },
  }));
  steps.forEach((s, i) => {
    if (s.type !== 'walk') return;
    for (const dir of s.path) {
      const d = FACING_DELTA[dir];
      pos[s.actor] = { x: pos[s.actor].x + d.x, y: pos[s.actor].y + d.y };
      visits.push({ step: i, actor: s.actor, ...pos[s.actor], other: { ...pos[other(s.actor)] } });
    }
  });
  return { visits, player: pos.player, coworker: pos.coworker };
}
