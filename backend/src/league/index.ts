import { APIGatewayProxyEvent } from 'aws-lambda';
import { ddbCrudHandler } from '../utils/ddb';
import { z } from 'zod';
import { MagicCardPoolSchema } from '../../src/types';

const schema = z
  .object({
    id: z.string(),
    leagueName: z.string(),
    pool: MagicCardPoolSchema,
  })
  .partial()
  .refine(
    (obj: Record<string | number | symbol, unknown>) =>
      Object.values(obj).some(v => v !== undefined),
    { message: 'One of the fields must be defined' },
  );

export const handler = (event: APIGatewayProxyEvent) => ddbCrudHandler(event, schema);
