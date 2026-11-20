import {
  APIGatewayAuthorizerResult,
  APIGatewayRequestAuthorizerEvent,
} from 'aws-lambda';
import { timingSafeEqual } from 'crypto';
import {
  AuthorizerContext,
  AuthorizerLambdaEnvSchema,
  SessionSchema,
  UserSchema,
} from '../types';
import { getItem } from '../utils/ddb';

const ADMIN_ONLY_ROUTES = new Set([
  'DELETE /league',
  'DELETE /user',
  'POST /league',
  'POST /user',
  'PUT /league',
  'PUT /session',
]);

const AUTHENTICATED_ROUTES = new Set([
  'DELETE /session',
  'PUT /user',
]);

const constantTimeEquals = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
};

const generatePolicy = (
  context: AuthorizerContext,
  effect: 'Allow' | 'Deny',
  principalId: string,
  resource: string,
): APIGatewayAuthorizerResult => ({
  context,
  policyDocument: {
    Statement: [
      {
        Action: 'execute-api:Invoke',
        Effect: effect,
        Resource: resource,
      },
    ],
    Version: '2012-10-17',
  },
  principalId,
});

const getHeader = (
  headers: Record<string, string | undefined> | null | undefined,
  name: string,
): string | undefined => {
  if (!headers) {
    return undefined;
  }
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target && typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return undefined;
};

export const handler = async (
  event: APIGatewayRequestAuthorizerEvent,
): Promise<APIGatewayAuthorizerResult> => {
  const {
    ADMIN_API_KEY,
    SESSION_TABLE_NAME,
    USER_TABLE_NAME,
  } = AuthorizerLambdaEnvSchema.parse(process.env);

  const apiKey = getHeader(event.headers, 'x-api-key');
  const sessionId = getHeader(event.headers, 'x-session-id');

  let isAdmin = false;
  let principalId = '';
  let username = '';

  if (ADMIN_API_KEY && apiKey && constantTimeEquals(apiKey, ADMIN_API_KEY)) {
    isAdmin = true;
    principalId = 'admin-api-key';
    username = '';
  } else if (sessionId) {
    const { Item: sessionItem } = await getItem(SESSION_TABLE_NAME, { sessionid: sessionId });
    const parsedSession = SessionSchema.safeParse(sessionItem);
    if (!parsedSession.success || !parsedSession.data.username || !parsedSession.data.expiration) {
      throw new Error('Unauthorized');
    }

    const expirationMs = parseInt(parsedSession.data.expiration, 10);
    if (!Number.isFinite(expirationMs) || expirationMs <= Date.now()) {
      throw new Error('Unauthorized');
    }

    const { Item: userItem } = await getItem(USER_TABLE_NAME, { username: parsedSession.data.username });
    const parsedUser = UserSchema.safeParse(userItem);
    if (!parsedUser.success) {
      throw new Error('Unauthorized');
    }

    isAdmin = Boolean(parsedUser.data.roles?.includes('admin'));
    principalId = parsedSession.data.username;
    username = parsedSession.data.username;
  } else {
    throw new Error('Unauthorized');
  }

  const routeKey = `${event.httpMethod.toUpperCase()} ${event.resource}`;
  const isRouteAllowed = isAdmin
    ? (ADMIN_ONLY_ROUTES.has(routeKey) || AUTHENTICATED_ROUTES.has(routeKey))
    : AUTHENTICATED_ROUTES.has(routeKey);

  return generatePolicy(
    {
      isAdmin: String(isAdmin),
      username,
    },
    isRouteAllowed ? 'Allow' : 'Deny',
    principalId,
    event.methodArn,
  );
};
