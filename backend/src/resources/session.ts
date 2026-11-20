import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 } from 'uuid';
import {
  LoginRequestSchema,
  SessionLambdaEnvSchema,
  SessionSchema,
  UserSchema,
} from '../types';
import {
  createItem,
  deleteItem,
  getItem,
  updateItem,
} from '../utils/ddb';
import { getAuthorizerContext, getResponse } from '../utils/lambda';
import { hashPassword, isHashedPassword, verifyPassword } from '../utils/password';

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { DB_TABLE_NAME, USER_TABLE_NAME } = SessionLambdaEnvSchema.parse(process.env);
    const { body, httpMethod, queryStringParameters } = event;

    if (httpMethod === 'GET') {
      const sessionid = queryStringParameters?.sessionid;
      if (!sessionid) {
        return getResponse(400, 'QueryStringParametersErr: sessionid is required');
      }

      const { Item } = await getItem(DB_TABLE_NAME, { sessionid });
      if (!Item) {
        return getResponse(404, 'Not found');
      }

      const session = SessionSchema.parse(Item);
      const expirationMs = session.expiration ? parseInt(session.expiration, 10) : NaN;
      if (!Number.isFinite(expirationMs) || expirationMs <= Date.now()) {
        return getResponse(404, 'Not found');
      }

      return getResponse(200, JSON.stringify(session));
    }

    if (httpMethod === 'POST') {
      if (!body) {
        return getResponse(400, 'BodyErr: body is not defined');
      }

      let rawBody: unknown;
      try {
        rawBody = JSON.parse(body);
      } catch {
        return getResponse(400, 'BodyErr: Invalid JSON body');
      }

      const parsedLogin = LoginRequestSchema.safeParse(rawBody);
      if (!parsedLogin.success) {
        return getResponse(400, `BodyErr: ${parsedLogin.error}`);
      }

      const username = parsedLogin.data.username.trim();
      if (!username) {
        return getResponse(400, 'BodyErr: username cannot be blank');
      }

      const { Item: userItem } = await getItem(USER_TABLE_NAME, { username });
      if (!userItem) {
        return getResponse(401, 'Invalid username or password');
      }

      const user = UserSchema.parse(userItem);
      if (!verifyPassword(parsedLogin.data.password, user.password)) {
        return getResponse(401, 'Invalid username or password');
      }

      if (user.password && !isHashedPassword(user.password)) {
        try {
          await updateItem(USER_TABLE_NAME, { username }, {
            password: hashPassword(parsedLogin.data.password),
          });
        } catch (migrationErr) {
          console.error('Failed lazy password hash migration:', migrationErr);
        }
      }

      const session = {
        expiration: `${Date.now() + SESSION_DURATION_MS}`,
        sessionid: v4(),
        username,
      };
      await createItem(DB_TABLE_NAME, session);
      return getResponse(200, JSON.stringify(session));
    }

    if (httpMethod === 'DELETE') {
      const sessionid = queryStringParameters?.sessionid;
      if (!sessionid) {
        return getResponse(400, 'QueryStringParametersErr: sessionid is required');
      }

      const { Item: existingItem } = await getItem(DB_TABLE_NAME, { sessionid });
      if (!existingItem) {
        return getResponse(404, 'Not found');
      }

      const existingSession = SessionSchema.parse(existingItem);
      const { isAdmin, username } = getAuthorizerContext(event);
      if (!isAdmin && existingSession.username !== username) {
        return getResponse(403, 'Forbidden');
      }

      const { Item: deletedItem } = await deleteItem(DB_TABLE_NAME, { sessionid });
      const deletedSession = SessionSchema.parse(deletedItem ?? existingItem);
      return getResponse(200, JSON.stringify(deletedSession));
    }

    return getResponse(405, 'Method Not Allowed');
  } catch (err) {
    console.error(err);
    return getResponse(500, 'Unexpected Error - check logs');
  }
};
