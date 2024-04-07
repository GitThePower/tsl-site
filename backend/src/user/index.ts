import { APIGatewayProxyEvent } from 'aws-lambda';
import { ddbCrudHandler } from '../utils/ddb';
import { z } from 'zod';

export const UserSchema = z.object({
  username: z.string(),
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
