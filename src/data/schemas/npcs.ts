/**
 * Schema for `public/data/npcs.json`. Types: talker, enemy (needs sight, team 1–6, reward,
 * defeatDialogue), shopkeeper (needs shop), healer, storage. `wander: null` = stands still; otherwise
 * the spawn must lie inside the wander rectangle (checked here; walkability is checked against the map).
 */
import { z } from 'zod';
import { EUROS_MAX, TEAM_MAX } from '../../logic/constants';
import {
  dialogueSchema,
  facingSchema,
  idSchema,
  imagePathSchema,
  soundPathSchema,
  textSchema,
  tileCoordSchema,
  tilePointSchema,
} from './common';

/** Wander rectangle in tiles plus the [min, max] wait between steps in ms. */
export const wanderSchema = z
  .strictObject({
    x: tileCoordSchema,
    y: tileCoordSchema,
    width: z.int().min(1),
    height: z.int().min(1),
    stepEveryMs: z.tuple([z.int().min(0), z.int().min(0)]),
  })
  .superRefine((w, ctx) => {
    if (w.stepEveryMs[0] > w.stepEveryMs[1]) {
      ctx.addIssue({ code: 'custom', path: ['stepEveryMs'], message: 'min must not be greater than max' });
    }
  });

const base = {
  id: idSchema,
  name: textSchema,
  sprite: imagePathSchema,
  voice: soundPathSchema,
  map: idSchema,
  spawn: tilePointSchema,
  facing: facingSchema,
  wander: wanderSchema.nullable(),
  dialogue: dialogueSchema,
};

/** Reward range in euros; `min <= max`. */
export const rewardSchema = z
  .strictObject({ min: z.int().min(0).max(EUROS_MAX), max: z.int().min(0).max(EUROS_MAX) })
  .superRefine((r, ctx) => {
    if (r.min > r.max)
      ctx.addIssue({ code: 'custom', path: ['min'], message: 'min must not be greater than max' });
  });

/** One NPC, discriminated by `type`. */
export const npcSchema = z
  .discriminatedUnion('type', [
    z.strictObject({ ...base, type: z.literal('talker') }),
    z.strictObject({
      ...base,
      type: z.literal('enemy'),
      sight: z.int().min(1).max(16),
      defeatDialogue: dialogueSchema,
      team: z
        .array(idSchema)
        .min(1, `needs 1 to ${TEAM_MAX} flexymon`)
        .max(TEAM_MAX, `needs 1 to ${TEAM_MAX} flexymon`),
      reward: rewardSchema,
    }),
    z.strictObject({ ...base, type: z.literal('shopkeeper'), shop: idSchema }),
    z.strictObject({ ...base, type: z.literal('healer') }),
    z.strictObject({ ...base, type: z.literal('storage') }),
  ])
  .superRefine((npc, ctx) => {
    const w = npc.wander;
    if (!w) return;
    const { x, y } = npc.spawn;
    if (x < w.x || y < w.y || x >= w.x + w.width || y >= w.y + w.height) {
      ctx.addIssue({ code: 'custom', path: ['spawn'], message: 'spawn must be inside the wander rectangle' });
    }
  });

/** The whole file: an array of NPCs. */
export const npcsFileSchema = z.array(npcSchema);

export type Wander = z.infer<typeof wanderSchema>;
export type Npc = z.infer<typeof npcSchema>;
export type NpcType = Npc['type'];
export type EnemyNpc = Extract<Npc, { type: 'enemy' }>;
