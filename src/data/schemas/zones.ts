/**
 * Schema for `public/data/zones.json`: every map (Tiled file, display name, region, music,
 * encounter groups). Encounter group keys must match rectangles in the map's `encounters` layer (M7).
 */
import { z } from 'zod';
import { idSchema, soundPathSchema, textSchema } from './common';

/** One weighted species in an encounter group. Weights are relative positive whole numbers. */
export const encounterEntrySchema = z.strictObject({ id: idSchema, weight: z.int().min(1) });

/** An encounter group: `rate` = percent chance per step (1–100), and the species table. */
export const encounterGroupSchema = z.strictObject({
  rate: z.int().min(1).max(100),
  flexymon: z.array(encounterEntrySchema).min(1, 'needs at least one flexymon'),
});

/** One zone (map). `file` is relative to `public/`, e.g. `maps/valencia.tmj`. */
export const zoneSchema = z.strictObject({
  id: idSchema,
  name: textSchema,
  file: z.string().regex(/^maps\/[^\s]+\.tmj$/, 'must be a path like maps/….tmj'),
  region: idSchema,
  music: soundPathSchema,
  indoor: z.boolean(),
  encounters: z.record(idSchema, encounterGroupSchema),
});

/** The whole file: an array of zones. */
export const zonesFileSchema = z.array(zoneSchema);

export type EncounterGroup = z.infer<typeof encounterGroupSchema>;
export type Zone = z.infer<typeof zoneSchema>;
