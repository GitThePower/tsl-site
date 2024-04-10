import { APIGatewayProxyEvent } from 'aws-lambda';
import { z } from 'zod';
import { ddbCrudHandler } from '../utils/ddb';
import config from '../../lib/config';

export const SessionSchema = z.object({
  [config.resource_session_pk]: z.string(),
  [config.resource_user_pk]: z.string(),
  expiration: z.string(),
})
  .partial()
  .refine(
    (obj: Record<string | number | symbol, unknown>) =>
      Object.values(obj).some(v => v !== undefined),
    { message: 'One of the fields must be defined' },
  );
export type Session = z.infer<typeof SessionSchema>;

export const handler = (event: APIGatewayProxyEvent) => ddbCrudHandler(event, SessionSchema);
