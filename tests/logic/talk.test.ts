import { describe, expect, it } from 'vitest';
import { talkLines } from '../../src/logic/talk';

const t = (k: string): string => `<${k}>`;
const dialogue = ['Hola.', 'Adiós.'];

describe('talkLines', () => {
  it.each(['talker', 'shopkeeper', 'enemy'] as const)('%s says its dialogue', (type) => {
    expect(talkLines({ type, dialogue }, t)).toEqual(dialogue);
  });
  it('healer shows the heal placeholder first', () => {
    expect(talkLines({ type: 'healer', dialogue }, t)).toEqual(['<npc.healer_placeholder>', ...dialogue]);
  });
  it('storage shows the box placeholder last', () => {
    expect(talkLines({ type: 'storage', dialogue }, t)).toEqual([...dialogue, '<npc.storage_placeholder>']);
  });
  it('an enemy in cooldown only says its defeatDialogue (M8)', () => {
    const enemy = { type: 'enemy' as const, dialogue, defeatDialogue: ['Vale, vale...'] };
    expect(talkLines(enemy, t, 'cooldown')).toEqual(['Vale, vale...']);
    expect(talkLines(enemy, t, 'ready')).toEqual(dialogue);
  });
  it('returns a copy', () => {
    const lines = talkLines({ type: 'talker', dialogue }, t);
    lines.push('x');
    expect(dialogue).toHaveLength(2);
  });
});
