import { APIGatewayProxyEvent } from 'aws-lambda';
import { ddbCrudHandler } from '../utils/ddb';
import { z } from 'zod';
import { MagicCardPoolSchema } from '../../src/types';

export const LeagueSchema = z.object({
  leagueName: z.string(),
  pool: MagicCardPoolSchema,
})
  .partial()
  .refine(
    (obj: Record<string | number | symbol, unknown>) =>
      Object.values(obj).some(v => v !== undefined),
    { message: 'One of the fields must be defined' },
  );
export type League = z.infer<typeof LeagueSchema>;

export const handler = (event: APIGatewayProxyEvent) => ddbCrudHandler(event, LeagueSchema);
