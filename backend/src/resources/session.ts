import { APIGatewayProxyEvent } from 'aws-lambda';
import { ddbCrudHandler } from '../utils/ddb';
import { SessionSchema } from '../types';

export const handler = (event: APIGatewayProxyEvent) => ddbCrudHandler(event, SessionSchema);
