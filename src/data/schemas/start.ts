/** Schema for `public/data/start.json`: the new-game state (starter, euros, slots, spawn, respawn, items). */
import { z } from 'zod';
import { EUROS_MAX, ITEM_COUNT_MAX, TEAM_MAX } from '../../logic/constants';
import { idSchema, mapPointSchema } from './common';

/** Item id → count (1–99). Shared by start.json and secret-names.json. */
export const itemCountsSchema = z.record(idSchema, z.int().min(1).max(ITEM_COUNT_MAX));

/** The whole file. */
export const startFileSchema = z.strictObject({
  starter: idSchema,
  euros: z.int().min(0).max(EUROS_MAX),
  teamSlots: z.int().min(1).max(TEAM_MAX),
  spawn: mapPointSchema,
  respawn: mapPointSchema,
  items: itemCountsSchema,
});

export type Start = z.infer<typeof startFileSchema>;
