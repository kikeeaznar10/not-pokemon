/**
 * Building blocks shared by the content schemas: ids, asset paths, grid points, facing.
 * All objects are strict: an unknown (e.g. misspelled) field is an error.
 */
import { z } from 'zod';

/** A content id: `snake_case` (lowercase letters, digits, underscores). */
export const idSchema = z.string().regex(/^[a-z0-9]+(_[a-z0-9]+)*$/, 'must be a snake_case id');

/** A non-empty visible text. */
export const textSchema = z.string().trim().min(1, 'must not be empty');

/** A PNG path relative to `public/`, e.g. `assets/sprites/items/cafe.png`. */
export const imagePathSchema = z.string().regex(/^assets\/[^\s]+\.png$/, 'must be a path like assets/….png');

/** A sound path relative to `public/` (`.ogg`; an `.mp3` with the same name is expected next to it). */
export const soundPathSchema = z
  .string()
  .regex(/^assets\/[^\s]+\.(ogg|mp3)$/, 'must be a path like assets/….ogg');

/** A direction a character can face. */
export const facingSchema = z.enum(['up', 'down', 'left', 'right']);

/** A non-negative whole number (tile coordinates). */
export const tileCoordSchema = z.int().min(0);

/** A tile position on a map. */
export const tilePointSchema = z.strictObject({ x: tileCoordSchema, y: tileCoordSchema });

/** A position on a named map with a facing (start spawn/respawn, car endpoints). */
export const mapPointSchema = z.strictObject({
  map: idSchema,
  x: tileCoordSchema,
  y: tileCoordSchema,
  facing: facingSchema,
});

/** A stat that buffs/debuffs can change (HP cannot be buffed). */
export const modStatSchema = z.enum(['attack', 'defense', 'speed']);

/** A list of dialogue strings: one text box each, at least one. */
export const dialogueSchema = z.array(textSchema).min(1, 'needs at least one line');

export type Facing = z.infer<typeof facingSchema>;
export type MapPoint = z.infer<typeof mapPointSchema>;
export type ModStat = z.infer<typeof modStatSchema>;
