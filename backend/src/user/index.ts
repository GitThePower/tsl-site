import { APIGatewayProxyEvent } from 'aws-lambda';
import { ddbCrudHandler } from '../utils/ddb';
import { z } from 'zod';

const schema = z.object({
  id: z.string(),
  username: z.string(),
  password: z.string(),
})
.partial()
.refine(
  (obj: Record<string | number | symbol, unknown>) =>
    Object.values(obj).some(v => v !== undefined),
  { message: 'One of the fields must be defined' },
);

export const handler = (event: APIGatewayProxyEvent) => ddbCrudHandler(event, schema);
