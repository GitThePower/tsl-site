import { APIGatewayProxyEvent } from 'aws-lambda';
import { z } from 'zod';
import { ddbCrudHandler } from '../utils/ddb';
import config from '../../lib/config';

export const UserSchema = z.object({
  [config.resource_user_pk]: z.string(),
  password: z.string(),
})
  .partial()
  .refine(
    (obj: Record<string | number | symbol, unknown>) =>
      Object.values(obj).some(v => v !== undefined),
    { message: 'One of the fields must be defined' },
  );
export type User = z.infer<typeof UserSchema>;

export const handler = (event: APIGatewayProxyEvent) => ddbCrudHandler(event, UserSchema);
