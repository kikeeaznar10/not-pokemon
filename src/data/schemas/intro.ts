/**
 * Schema for `public/data/intro.json` (M11): the title screen image and the new-game intro script.
 *
 * - `titleImage`: the pixel office drawn behind the title (`assets/ui/title.png`, 512 × 288).
 * - `jingle`: the sound played when the starter is handed over.
 * - `coworker`: the intro-only character who walks up and hands over the starter (name, sprite, voice,
 *   start tile and facing on the `start.json › spawn` map). It is not an `npcs.json` NPC: it only exists
 *   during the intro, so the script should walk it out of view (or leave it where an `npcs.json` NPC stands).
 * - `steps`: run in order by the IntroScene. The player starts on `start.json › spawn`.
 *   - `fade_in` `{ ms }`: fade in from black; `wait` `{ ms }`: pause.
 *   - `walk` `{ actor, path }`: `player` or `coworker` walks one tile per direction in `path`.
 *   - `face` `{ actor, facing }`: turn on the spot.
 *   - `say` `{ lines }`: the coworker's dialogue (one box per line, its voice); `{name}` is the player's
 *     name and `{starter}` the starter's species name.
 *   - `handover`: the jingle and "¡Recibes {starter}!", then the secret-name message if the name matches.
 *   Exactly one `handover` step is required. Walk tiles are checked against the map at boot (`map-checks.ts`).
 */
import { z } from 'zod';
import {
  dialogueSchema,
  facingSchema,
  imagePathSchema,
  soundPathSchema,
  textSchema,
  tileCoordSchema,
} from './common';

/** Who a `walk` / `face` step moves. */
export const introActorSchema = z.enum(['player', 'coworker']);

const msSchema = z.int().min(0).max(10_000);

/** One step of the intro script. */
export const introStepSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('fade_in'), ms: msSchema }),
  z.strictObject({ type: z.literal('wait'), ms: msSchema }),
  z.strictObject({
    type: z.literal('walk'),
    actor: introActorSchema,
    path: z.array(facingSchema).min(1, 'needs at least one direction'),
  }),
  z.strictObject({ type: z.literal('face'), actor: introActorSchema, facing: facingSchema }),
  z.strictObject({ type: z.literal('say'), lines: dialogueSchema }),
  z.strictObject({ type: z.literal('handover') }),
]);

/** The whole file. */
export const introFileSchema = z.strictObject({
  titleImage: imagePathSchema,
  jingle: soundPathSchema,
  coworker: z.strictObject({
    name: textSchema,
    sprite: imagePathSchema,
    voice: soundPathSchema,
    x: tileCoordSchema,
    y: tileCoordSchema,
    facing: facingSchema,
  }),
  steps: z
    .array(introStepSchema)
    .min(1, 'needs at least one step')
    .superRefine((steps, ctx) => {
      const handovers = steps.filter((s) => s.type === 'handover').length;
      if (handovers !== 1)
        ctx.addIssue({ code: 'custom', message: `needs exactly one "handover" step (found ${handovers})` });
    }),
});

/** `player` or `coworker`. */
export type IntroActor = z.infer<typeof introActorSchema>;
/** One intro step (discriminated by `type`). */
export type IntroStep = z.infer<typeof introStepSchema>;
/** The parsed `intro.json`. */
export type Intro = z.infer<typeof introFileSchema>;
