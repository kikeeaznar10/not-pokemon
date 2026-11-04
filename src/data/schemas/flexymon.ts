/** Schema for `public/data/flexymon.json`: every species (name, sprites, cry, base stats, 1–3 attacks). */
import { z } from 'zod';
import { idSchema, imagePathSchema, soundPathSchema, textSchema } from './common';

const statSchema = z.int().min(1).max(999);

/** Base stats: whole numbers 1–999. */
export const statsSchema = z.strictObject({
  hp: statSchema,
  attack: statSchema,
  defense: statSchema,
  speed: statSchema,
});

/** One species. Sprites: front/back 64×64, icon 16×16. */
export const speciesSchema = z.strictObject({
  id: idSchema,
  name: textSchema,
  sprite: z.strictObject({ front: imagePathSchema, back: imagePathSchema, icon: imagePathSchema }),
  cry: soundPathSchema,
  stats: statsSchema,
  attacks: z.array(idSchema).min(1, 'needs 1 to 3 attacks').max(3, 'needs 1 to 3 attacks'),
});

/** The whole file: an array of species. */
export const flexymonFileSchema = z.array(speciesSchema);

export type Stats = z.infer<typeof statsSchema>;
export type Species = z.infer<typeof speciesSchema>;
