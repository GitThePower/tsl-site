import { APIGatewayProxyEvent } from 'aws-lambda';
import { ddbCrudHandler } from '../utils/ddb';
import { LeagueSchema } from '../types';

export const handler = (event: APIGatewayProxyEvent) => ddbCrudHandler(event, LeagueSchema);
