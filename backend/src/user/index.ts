import { APIGatewayProxyEvent } from "aws-lambda";
import { ddbCrudHandler } from '../utils/ddb';
import { z } from "zod";

const schema = z.object({
  id: z.string(),
  username: z.string(),
  password: z.string(),
});

export const handler = (event: APIGatewayProxyEvent) => ddbCrudHandler(event, schema);
