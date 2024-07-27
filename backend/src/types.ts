import { z } from 'zod';

const MagicCardSchema = z.object({
  quantity: z.number(),
  mana_cost: z.string(),
});
export type MagicCard = z.infer<typeof MagicCardSchema>;

export const MagicCardPoolSchema = z.object({
  cardList: z.record(z.string(), MagicCardSchema),
  decklistUrl: z.string(),
});
export type MagicCardPool = z.infer<typeof MagicCardPoolSchema>;

const MoxfieldCardSchema = z.object({
  quantity: z.number(),
  card: z.object({
    cmc: z.number(),
    colors: z.array(z.string()),
    mana_cost: z.string(),
    name: z.string(),
    scryfall_id: z.string().optional(),
    set_name: z.string(),
  }),
});
const MoxfieldBoardSchema = z.object({
  count: z.number(),
  cards: z.record(z.string(), MoxfieldCardSchema),
});
export const MoxfieldContentSchema = z.object({
  boards: z.object({
    mainboard: MoxfieldBoardSchema,
    sideboard: MoxfieldBoardSchema,
    maybeboard: MoxfieldBoardSchema,
  }),
});
export type MoxfieldContent = z.infer<typeof MoxfieldContentSchema>;

export const MoxfieldPoolSchema = z.record(z.string(), z.object({
  decklistUrl: z.string(),
  moxfieldContent: MoxfieldContentSchema,
}));
export type MoxfieldPool = z.infer<typeof MoxfieldPoolSchema>;

export const ResourceLambdaEnvSchema = z.object({
  DB_TABLE_NAME: z.string(),
  S3_BUCKET_NAME: z.string().optional(),
});
export type ResourceLambdaEnv = z.infer<typeof ResourceLambdaEnvSchema>;

export const FillPoolsLambdaEnvSchema = z.object({
  LEAGUE_BUCKET_NAME: z.string(),
  LEAGUE_TABLE_NAME: z.string(),
  USER_TABLE_NAME: z.string(),
});
export type FillPoolsLambdaEnv = z.infer<typeof FillPoolsLambdaEnvSchema>;

// ######################################
// ########## RESOURCE SCHEMAS ##########
// ######################################

export const LeagueSchema = z.object({
  leaguename: z.string(),
  cardPool: MoxfieldPoolSchema,
  cardPoolKey: z.string(),
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
  leagues: z.array(z.object({
    leaguename: z.string(),
    decklistUrl: z.string(),
  })),
})
  .partial()
  .refine(
    (obj: Record<string | number | symbol, unknown>) =>
      Object.values(obj).some(v => v !== undefined),
    { message: 'One of the fields must be defined' },
  );
export type User = z.infer<typeof UserSchema>;
