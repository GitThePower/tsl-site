import { APIGatewayProxyEvent } from "aws-lambda";
import { ddbCrudHandler } from '../utils/ddb';
import { z } from "zod";
import { MagicCardPoolSchema } from "../../types";

const schema = z.object({
  id: z.string(),
  leagueName: z.string(),
  pool: MagicCardPoolSchema,
});

export const handler = (event: APIGatewayProxyEvent) => ddbCrudHandler(event, schema);
