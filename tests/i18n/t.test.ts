import { describe, expect, it } from 'vitest';
import { createT, t } from '../../src/i18n';

describe('t()', () => {
  const tt = createT({
    'battle.wild_appeared': '¡Un {name} salvaje!',
    'shop.price': '{item}: {price} €',
  });

  it('reads es.json', () => {
    expect(t('app.title')).toBe('Flexymon');
  });

  it('fills vars', () => {
    expect(tt('battle.wild_appeared', { name: 'Ratón' })).toBe('¡Un Ratón salvaje!');
    expect(tt('shop.price', { item: 'Café', price: 50 })).toBe('Café: 50 €');
  });

  it('leaves unknown placeholders untouched', () => {
    expect(tt('battle.wild_appeared')).toBe('¡Un {name} salvaje!');
    expect(tt('shop.price', { item: 'Café' })).toBe('Café: {price} €');
  });

  it('shows the missing-key marker', () => {
    expect(tt('nope.missing')).toBe('⟦nope.missing⟧');
    expect(t('battle.wild_appeared', { name: 'x' })).toBe('⟦battle.wild_appeared⟧');
  });
});
