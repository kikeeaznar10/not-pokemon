/**
 * Schema for `public/data/attacks.json`. Effect types: damage (power 1–200), heal (percent 1–100),
 * buff/debuff (stat, percent 1–100, turns 1–9). Rule: heal and buff target `self`; damage and debuff
 * target `enemy`.
 */
import { z } from 'zod';
import { idSchema, modStatSchema, soundPathSchema, textSchema } from './common';

const percentSchema = z.int().min(1).max(100);
const turnsSchema = z.int().min(1).max(9);

/** Effect of an attack, discriminated by `type`. */
export const attackEffectSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('damage'), power: z.int().min(1).max(200) }),
  z.strictObject({ type: z.literal('heal'), percent: percentSchema }),
  z.strictObject({
    type: z.literal('buff'),
    stat: modStatSchema,
    percent: percentSchema,
    turns: turnsSchema,
  }),
  z.strictObject({
    type: z.literal('debuff'),
    stat: modStatSchema,
    percent: percentSchema,
    turns: turnsSchema,
  }),
]);

/** Which target each effect type must use. */
const REQUIRED_TARGET = { damage: 'enemy', debuff: 'enemy', heal: 'self', buff: 'self' } as const;

/** One attack. */
export const attackSchema = z
  .strictObject({
    id: idSchema,
    name: textSchema,
    sound: soundPathSchema,
    accuracy: z.int().min(1).max(100),
    target: z.enum(['enemy', 'self']),
    effect: attackEffectSchema,
  })
  .superRefine((attack, ctx) => {
    const required = REQUIRED_TARGET[attack.effect.type];
    if (attack.target !== required) {
      ctx.addIssue({
        code: 'custom',
        path: ['target'],
        message: `a ${attack.effect.type} attack must target "${required}"`,
      });
    }
  });

/** The whole file: an array of attacks. */
export const attacksFileSchema = z.array(attackSchema);

export type AttackEffect = z.infer<typeof attackEffectSchema>;
export type Attack = z.infer<typeof attackSchema>;
