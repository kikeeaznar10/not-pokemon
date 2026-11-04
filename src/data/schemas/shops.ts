/** Schema for `public/data/shops.json`: shop id → list of item ids it sells. */
import { z } from 'zod';
import { idSchema } from './common';

/** The whole file: an object keyed by shop id. */
export const shopsFileSchema = z.record(
  idSchema,
  z
    .array(idSchema)
    .min(1, 'a shop needs at least one item')
    .refine((v) => new Set(v).size === v.length, 'has duplicates'),
);

export type Shops = z.infer<typeof shopsFileSchema>;
