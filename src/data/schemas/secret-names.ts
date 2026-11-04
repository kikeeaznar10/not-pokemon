/**
 * Schema for `public/data/secret-names.json`: names that grant bonus items. Matching ignores case,
 * accents and surrounding spaces, so two entries may not normalise to the same name (cross-check).
 */
import { z } from 'zod';
import { textSchema } from './common';
import { itemCountsSchema } from './start';

/** One secret name. */
export const secretNameSchema = z.strictObject({
  name: textSchema,
  items: itemCountsSchema,
  message: textSchema,
});

/** The whole file: an array of secret names. */
export const secretNamesFileSchema = z.array(secretNameSchema);

export type SecretName = z.infer<typeof secretNameSchema>;
