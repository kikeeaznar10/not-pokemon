/**
 * Schema for `public/data/items.json`. Effect types: heal (amount), heal_full, revive (percent),
 * buff (as attacks), team_slot, key, catch (reserved). `price: null` = cannot be bought or sold.
 */
import { z } from 'zod';
import { EUROS_MAX } from '../../logic/constants';
import { idSchema, imagePathSchema, modStatSchema, textSchema } from './common';

/** Effect of an item, discriminated by `type`. */
export const itemEffectSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('heal'), amount: z.int().min(1).max(999) }),
  z.strictObject({ type: z.literal('heal_full') }),
  z.strictObject({ type: z.literal('revive'), percent: z.int().min(1).max(100) }),
  z.strictObject({
    type: z.literal('buff'),
    stat: modStatSchema,
    percent: z.int().min(1).max(100),
    turns: z.int().min(1).max(9),
  }),
  z.strictObject({ type: z.literal('team_slot') }),
  z.strictObject({ type: z.literal('key') }),
  z.strictObject({ type: z.literal('catch') }),
]);

/** One item. Sprite 16×16. */
export const itemSchema = z.strictObject({
  id: idSchema,
  name: textSchema,
  description: textSchema,
  sprite: imagePathSchema,
  price: z.int().min(0).max(EUROS_MAX).nullable(),
  usableIn: z
    .array(z.enum(['battle', 'field']))
    .refine((v) => new Set(v).size === v.length, 'has duplicates'),
  effect: itemEffectSchema,
});

/** The whole file: an array of items. */
export const itemsFileSchema = z.array(itemSchema);

export type ItemEffect = z.infer<typeof itemEffectSchema>;
export type Item = z.infer<typeof itemSchema>;
