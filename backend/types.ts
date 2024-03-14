import { z } from 'zod';

export const MagicCardSchema = z.object({
  name: z.string(),
  count: z.number(),
});
export type MagicCard = z.infer<typeof MagicCardSchema>;

const MoxfieldBoardSchema = z.object({
  count: z.number(),
  cards: z.unknown(),
});
export const MoxfieldContentSchema = z.object({
  boards: z.object({
    mainboard: MoxfieldBoardSchema,
    sideboard: MoxfieldBoardSchema,
    maybeboard: MoxfieldBoardSchema,
  }),
});
export type MoxfieldContent = z.infer<typeof MoxfieldContentSchema>;
