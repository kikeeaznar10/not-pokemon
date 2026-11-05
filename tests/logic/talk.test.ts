import { describe, expect, it } from 'vitest';
import { talkAction, talkLines } from '../../src/logic/talk';

const t = (k: string): string => `<${k}>`;
const dialogue = ['Hola.', 'Adiós.'];

describe('talkLines', () => {
  it.each(['talker', 'shopkeeper', 'enemy', 'storage'] as const)('%s says its dialogue', (type) => {
    expect(talkLines({ type, dialogue }, t)).toEqual(dialogue);
  });
  it('healer says it healed the team first', () => {
    expect(talkLines({ type: 'healer', dialogue }, t)).toEqual(['<healer.done>', ...dialogue]);
  });
  it('an enemy in cooldown only says its defeatDialogue', () => {
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

describe('talkAction', () => {
  it('healer heals, storage opens the box, shopkeeper opens the shop, others nothing', () => {
    expect(talkAction({ type: 'healer' })).toBe('heal');
    expect(talkAction({ type: 'storage' })).toBe('storage');
    expect(talkAction({ type: 'shopkeeper' })).toBe('shop');
    expect(talkAction({ type: 'talker' })).toBeNull();
    expect(talkAction({ type: 'enemy' })).toBeNull();
  });
});
