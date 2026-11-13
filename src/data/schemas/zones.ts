/**
 * Schema for `public/data/zones.json`: every map (Tiled file, display name, region, music,
 * encounter groups). Encounter group keys must match rectangles in the map's `encounters` layer.
 */
import { z } from 'zod';
import { idSchema, imagePathSchema, soundPathSchema, textSchema, tileCoordSchema } from './common';

/** One weighted species in an encounter group. Weights are relative positive whole numbers. */
export const encounterEntrySchema = z.strictObject({ id: idSchema, weight: z.int().min(1) });

/** An encounter group: `rate` = percent chance per step (1–100), and the species table. */
export const encounterGroupSchema = z.strictObject({
  rate: z.int().min(1).max(100),
  flexymon: z.array(encounterEntrySchema).min(1, 'needs at least one flexymon'),
});

/**
 * A building skin: `image` is drawn over the `width` × `height` tiles whose top-left tile is (`x`, `y`). The
 * map's own `deco` and `above` tiles inside that rectangle are hidden; collision, doors and warps are untouched.
 */
export const buildingSkinSchema = z.strictObject({
  id: idSchema,
  image: imagePathSchema,
  x: tileCoordSchema,
  y: tileCoordSchema,
  width: z.int().min(1),
  height: z.int().min(1),
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
  buildings: z.array(buildingSkinSchema).optional(),
});

/** The whole file: an array of zones. */
export const zonesFileSchema = z.array(zoneSchema);

export type EncounterGroup = z.infer<typeof encounterGroupSchema>;
export type BuildingSkin = z.infer<typeof buildingSkinSchema>;
export type Zone = z.infer<typeof zoneSchema>;
