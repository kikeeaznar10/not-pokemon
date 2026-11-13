import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('content: ferri', () => {
  it('adds riotous balanced content for Ferri and keeps all move ids valid', () => {
    const dataDir = join(__dirname, '..', '..', 'public', 'data');
    const flexymon = JSON.parse(readFileSync(join(dataDir, 'flexymon.json'), 'utf8')) as Array<{
      id: string;
      name: string;
      stats: { hp: number; attack: number; defense: number; speed: number };
      attacks: string[];
    }>;
    const attacks = JSON.parse(readFileSync(join(dataDir, 'attacks.json'), 'utf8')) as Array<{ id: string }>;

    const ferri = flexymon.find((entry) => entry.id === 'ferri');

    expect(ferri).toBeDefined();
    expect(ferri).toMatchObject({
      id: 'ferri',
      name: 'Ferri',
      attacks: ['rascada_hueval', 'culebra', 'punalada_trapera'],
    });

    const total = (ferri?.stats.hp ?? 0) + (ferri?.stats.attack ?? 0) + (ferri?.stats.defense ?? 0) + (ferri?.stats.speed ?? 0);
    expect(total).toBeGreaterThan(90);
    expect(total).toBeLessThan(140);

    for (const attackId of ferri?.attacks ?? []) {
      expect(attacks.some((attack) => attack.id === attackId)).toBe(true);
    }
  });
});
