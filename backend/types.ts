import { z } from 'zod';

export const MagicCardPoolSchema = z.record(z.string(), z.number());
export type MagicCardPool = z.infer<typeof MagicCardPoolSchema>;

const MoxfieldCardSchema = z.object({
  quantity: z.number(),
  card: z.object({
    name: z.string(),
  }),
});
const MoxfieldBoardSchema = z.object({
  count: z.number(),
  cards: z.record(z.string(), MoxfieldCardSchema),
});
export type MoxfieldBoard = z.infer<typeof MoxfieldBoardSchema>;
export const MoxfieldContentSchema = z.object({
  boards: z.object({
    mainboard: MoxfieldBoardSchema,
    sideboard: MoxfieldBoardSchema,
    maybeboard: MoxfieldBoardSchema,
  }),
});
