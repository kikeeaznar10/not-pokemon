import { describe, expect, it } from 'vitest';
import { rng } from '../../src/core/rng';
import { applySecretName, fillIntroText, findSecretName, traceIntro } from '../../src/logic/intro';
import { newGameState } from '../../src/logic/new-game';
import { ITEM_COUNT_MAX } from '../../src/logic/constants';
import type { IntroStep, SecretName } from '../../src/data/schemas';
import { gameData } from './helpers';

const SECRETS: SecretName[] = [
  { name: 'paco', items: { cafe: 10 }, message: 'El de siempre te ha guardado unos cafés.' },
  { name: 'Lucía', items: { regleta: 1 }, message: 'Una regleta.' },
];

describe('intro text', () => {
  it('fills {name} and {starter}, leaves other placeholders', () => {
    expect(
      fillIntroText('¡Hola, {name}! Toma a {starter}. {otro}', { name: 'Ana', starter: 'Portátil' }),
    ).toBe('¡Hola, Ana! Toma a Portátil. {otro}');
  });
});

describe('secret names (plan › secret-names.json)', () => {
  it('matches ignoring case, accents and surrounding spaces', () => {
    expect(findSecretName('PACO', SECRETS)?.name).toBe('paco');
    expect(findSecretName('  PÁCO ', SECRETS)?.name).toBe('paco');
    expect(findSecretName('lucia', SECRETS)?.name).toBe('Lucía');
  });

  it('does not match other names or an empty name', () => {
    expect(findSecretName('Pacoo', SECRETS)).toBeNull();
    expect(findSecretName('pac', SECRETS)).toBeNull();
    expect(findSecretName('   ', SECRETS)).toBeNull();
  });

  it('adds the items to the bag, capped per item', () => {
    const state = newGameState(gameData(), rng, 'PACO'); // starts with 3 cafés
    const after = applySecretName(state, SECRETS[0]!);
    expect(after.items).toEqual({ cafe: 13 });
    expect(state.items).toEqual({ cafe: 3 }); // pure
    const full = applySecretName({ ...state, items: { cafe: ITEM_COUNT_MAX - 2 } }, SECRETS[0]!);
    expect(full.items.cafe).toBe(ITEM_COUNT_MAX);
  });
});

describe('traceIntro', () => {
  const steps: IntroStep[] = [
    { type: 'fade_in', ms: 100 },
    { type: 'walk', actor: 'player', path: ['up', 'up'] },
    { type: 'walk', actor: 'coworker', path: ['down', 'left'] },
    { type: 'handover' },
  ];

  it('lists every tile each actor enters and where the other one stands', () => {
    const tr = traceIntro(steps, { x: 5, y: 5 }, { x: 5, y: 1 });
    expect(tr.visits).toEqual([
      { step: -1, actor: 'player', x: 5, y: 5, other: { x: 5, y: 1 } },
      { step: -1, actor: 'coworker', x: 5, y: 1, other: { x: 5, y: 5 } },
      { step: 1, actor: 'player', x: 5, y: 4, other: { x: 5, y: 1 } },
      { step: 1, actor: 'player', x: 5, y: 3, other: { x: 5, y: 1 } },
      { step: 2, actor: 'coworker', x: 5, y: 2, other: { x: 5, y: 3 } },
      { step: 2, actor: 'coworker', x: 4, y: 2, other: { x: 5, y: 3 } },
    ]);
    expect(tr.player).toEqual({ x: 5, y: 3 });
    expect(tr.coworker).toEqual({ x: 4, y: 2 });
  });

  it('the shipped intro ends with the player two tiles above the spawn', () => {
    const d = gameData();
    const tr = traceIntro(d.intro.steps, d.start.spawn, d.intro.coworker);
    expect(tr.player).toEqual({ x: d.start.spawn.x, y: d.start.spawn.y - 2 });
  });
});
