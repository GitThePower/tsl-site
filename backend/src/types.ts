import { z } from 'zod';

const MagicCardSchema = z.object({
  mainboardQuantity: z.number().optional(),
  mana_cost: z.string(),
  name: z.string(),
  quantity: z.number(),
  scryfall_id: z.string().optional(),
});
export type MagicCard = z.infer<typeof MagicCardSchema>;

export const MagicCardCountsSchema = z.record(z.string(), MagicCardSchema);
export type MagicCardCounts = z.infer<typeof MagicCardCountsSchema>;

export const MagicCardPoolSchema = z.object({
  cardList: z.record(z.string(), MagicCardSchema),
  colors: z.array(z.string()).optional(),
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

export const GatewayProviderSchema = z.enum([
  'scrapedo',
  'scraperapi',
  'scrapingant',
  'scrapingbee',
]);
export type GatewayProvider = z.infer<typeof GatewayProviderSchema>;

export const FillPoolsLambdaEnvSchema = z.object({
  GATEWAY_PROVIDER: GatewayProviderSchema.optional(),
  GATEWAY_SECRET_NAME: z.string().optional(),
  LEAGUE_BUCKET_NAME: z.string(),
  LEAGUE_TABLE_NAME: z.string(),
  REQUEST_DELAY_MS: z.string().optional(),
  USER_TABLE_NAME: z.string(),
});
export type FillPoolsLambdaEnv = z.infer<typeof FillPoolsLambdaEnvSchema>;

// ######################################
// ########## RESOURCE SCHEMAS ##########
// ######################################

export const LeagueSchema = z.object({
  cardCounts: MagicCardCountsSchema,
  cardCountsKey: z.string(),
  cardPool: z.record(z.string(), MagicCardPoolSchema),
  cardPoolKey: z.string(),
  isActive: z.boolean(),
  leaguename: z.string(),
  poolSyncError: z.boolean(),
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
