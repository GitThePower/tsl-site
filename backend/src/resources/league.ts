import { APIGatewayProxyEvent } from 'aws-lambda';
import { z } from 'zod';
import { ddbCrudHandler } from '../utils/ddb';
import { MagicCardPoolSchema } from '../types';
import config from '../../lib/config';

export const LeagueSchema = z.object({
  [config.resource_league_pk]: z.string(),
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
