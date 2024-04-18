import { z } from 'zod';

export const MagicCardPoolSchema = z.record(z.string(), z.number());
export type MagicCardPool = z.infer<typeof MagicCardPoolSchema>;

const MoxfieldCardSchema = z.object({
  quantity: z.number(),
  card: z.object({
    cmc: z.number(),
    colors: z.array(z.string()),
    mana_cost: z.string(),
    name: z.string(),
    set_name: z.string(),
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
export type MoxfieldContent = z.infer<typeof MoxfieldContentSchema>;

export const ResourceLambdaEnvSchema = z.object({
  DB_TABLE_NAME: z.string(),
});
export type ResourceLambdaEnv = z.infer<typeof ResourceLambdaEnvSchema>;

// ######################################
// ########## RESOURCE SCHEMAS ##########
// ######################################

export const LeagueSchema = z.object({
  leaguename: z.string(),
  pool: z.record(z.string(), MoxfieldContentSchema),
  isActive: z.boolean(),
})
  .partial()
  .refine(
    (obj: Record<string | number | symbol, unknown>) =>
      Object.values(obj).some(v => v !== undefined),
    { message: 'One of the fields must be defined' },
  );
export type League = z.infer<typeof LeagueSchema>;

export const SessionSchema = z.object({
  sessionid: z.string(),
  username: z.string(),
  expiration: z.string(),
})
  .partial()
  .refine(
    (obj: Record<string | number | symbol, unknown>) =>
      Object.values(obj).some(v => v !== undefined),
    { message: 'One of the fields must be defined' },
  );
export type Session = z.infer<typeof SessionSchema>;

export const UserSchema = z.object({
  username: z.string(),
  password: z.string(),
  decklist: z.string(),
})
  .partial()
  .refine(
    (obj: Record<string | number | symbol, unknown>) =>
      Object.values(obj).some(v => v !== undefined),
    { message: 'One of the fields must be defined' },
  );
export type User = z.infer<typeof UserSchema>;
