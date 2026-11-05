/**
 * Schema for `public/data/car.json`: item pairs that unlock the Audi, the locked dialogue, trip endpoints, and
 * the art and sound of the trip scene: `sprite` is the Audi seen from the side, nose to the right
 * (placeholder 96 × 40), `sound` the engine, looped during the trip.
 */
import { z } from 'zod';
import { dialogueSchema, idSchema, imagePathSchema, mapPointSchema, soundPathSchema } from './common';

/** The whole file. The car opens if the player owns both items of any pair. */
export const carFileSchema = z.strictObject({
  unlockPairs: z.array(z.tuple([idSchema, idSchema])).min(1, 'needs at least one pair'),
  lockedDialogue: dialogueSchema,
  sprite: imagePathSchema,
  sound: soundPathSchema,
  toMurcia: mapPointSchema,
  toValencia: mapPointSchema,
});

export type Car = z.infer<typeof carFileSchema>;
