import { z } from 'zod';

const MagicCardSchema = z.object({
  cmc: z.number().optional(),
  colors: z.array(z.string()).optional(),
  mainboardQuantity: z.number().optional(),
  mana_cost: z.string(),
  name: z.string(),
  quantity: z.number(),
  rarity: z.string().optional(),
  scryfall_id: z.string().optional(),
  type_line: z.string().optional(),
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

const MoxfieldCardFaceSchema = z.object({
  colors: z.array(z.string()).nullish(),
  mana_cost: z.string().nullish(),
  type_line: z.string().nullish(),
});

const MoxfieldCardDetailsSchema = z.object({
  card_faces: z.array(MoxfieldCardFaceSchema).nullish(),
  cmc: z.number().nullish(),
  colors: z.array(z.string()).nullish(),
  mana_cost: z.string().nullish(),
  name: z.string(),
  rarity: z.string().nullish(),
  scryfall_id: z.string().nullish(),
  set_name: z.string().nullish(),
  type_line: z.string().nullish(),
});
export type MoxfieldCardDetails = z.infer<typeof MoxfieldCardDetailsSchema>;

const MoxfieldCardSchema = z.object({
  card: MoxfieldCardDetailsSchema,
  quantity: z.number(),
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

export const AuthorizerContextSchema = z.object({
  isAdmin: z.string(),
  username: z.string(),
});
export type AuthorizerContext = z.infer<typeof AuthorizerContextSchema>;

export const AuthorizerLambdaEnvSchema = z.object({
  ADMIN_API_KEY: z.string().optional(),
  SESSION_TABLE_NAME: z.string(),
  USER_TABLE_NAME: z.string(),
});
export type AuthorizerLambdaEnv = z.infer<typeof AuthorizerLambdaEnvSchema>;

export const ResourceLambdaEnvSchema = z.object({
  DB_TABLE_NAME: z.string(),
  S3_BUCKET_NAME: z.string().optional(),
});
export type ResourceLambdaEnv = z.infer<typeof ResourceLambdaEnvSchema>;

export const SessionLambdaEnvSchema = z.object({
  DB_TABLE_NAME: z.string(),
  USER_TABLE_NAME: z.string(),
});
export type SessionLambdaEnv = z.infer<typeof SessionLambdaEnvSchema>;

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

export const ProcessCardCountsLambdaEnvSchema = z.object({
  LEAGUE_BUCKET_NAME: z.string(),
  LEAGUE_TABLE_NAME: z.string(),
});
export type ProcessCardCountsLambdaEnv = z.infer<typeof ProcessCardCountsLambdaEnvSchema>;

export const ProcessCardPoolLambdaEnvSchema = z.object({
  LEAGUE_BUCKET_NAME: z.string(),
  LEAGUE_TABLE_NAME: z.string(),
});
export type ProcessCardPoolLambdaEnv = z.infer<typeof ProcessCardPoolLambdaEnvSchema>;

export const ProcessDeckColorsLambdaEnvSchema = z.object({
  LEAGUE_BUCKET_NAME: z.string(),
  LEAGUE_TABLE_NAME: z.string(),
});
export type ProcessDeckColorsLambdaEnv = z.infer<typeof ProcessDeckColorsLambdaEnvSchema>;

export const RawPoolEnvelopeSchema = z.object({
  cardCountsKey: z.string(),
  cardPoolKey: z.string(),
  hasSyncFailure: z.boolean(),
  leaguename: z.string(),
  pool: MoxfieldPoolSchema,
});
export type RawPoolEnvelope = z.infer<typeof RawPoolEnvelopeSchema>;

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

export const UserRoleSchema = z.enum(['admin', 'player']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserLeagueSchema = z.object({
  decklistUrl: z.string(),
  leaguename: z.string(),
});
export type UserLeague = z.infer<typeof UserLeagueSchema>;

export const UserSchema = z.object({
  leagues: z.array(UserLeagueSchema),
  password: z.string(),
  roles: z.array(UserRoleSchema),
  username: z.string(),
})
  .partial()
  .refine(
    (obj: Record<string | number | symbol, unknown>) =>
      Object.values(obj).some(v => v !== undefined),
    { message: 'One of the fields must be defined' },
  );
export type User = z.infer<typeof UserSchema>;

export const CreateUserSchema = z.object({
  leagues: z.array(UserLeagueSchema).optional(),
  password: z.string().min(1),
  roles: z.array(UserRoleSchema).optional(),
  username: z.string().min(1),
});
export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const LoginRequestSchema = z.object({
  password: z.string().min(1),
  username: z.string().min(1),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const UpdateUserBodySchema = z.object({
  currentPassword: z.string(),
  leagues: z.array(UserLeagueSchema),
  password: z.string().min(1),
  roles: z.array(UserRoleSchema),
})
  .partial()
  .refine(
    (obj: Record<string | number | symbol, unknown>) =>
      Object.values(obj).some(v => v !== undefined),
    { message: 'One of the fields must be defined' },
  );
export type UpdateUserInput = z.infer<typeof UpdateUserBodySchema>;
