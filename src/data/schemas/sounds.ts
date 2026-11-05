/**
 * Schema for `public/data/sounds.json` (M15): the interface sounds. Every key is required; each value is a sound
 * path like the other files' (`assets/….ogg`, the MP3 with the same name is the fallback).
 *
 * - `cursor`: a menu cursor moved. `confirm`: an option chosen. `cancel`: B backed out of a menu.
 * - `error`: a refused action (a greyed option, not enough money, the storage box refusing a move…).
 * - `money`: euros changed hands (shop purchase or sale, an enemy's reward).
 */
import { z } from 'zod';
import { soundPathSchema } from './common';

/** The whole file. */
export const soundsFileSchema = z.strictObject({
  cursor: soundPathSchema,
  confirm: soundPathSchema,
  cancel: soundPathSchema,
  error: soundPathSchema,
  money: soundPathSchema,
});

/** The interface sounds by kind. */
export type Sounds = z.infer<typeof soundsFileSchema>;

/** One kind of interface sound (a key of `sounds.json`). */
export type UiSoundKind = keyof Sounds;
