import { APIGatewayRequestAuthorizerEvent } from 'aws-lambda';
import { handler } from '../src/authorizer';
import * as ddbUtils from '../src/utils/ddb';

const makeAuthEvent = (overrides: Partial<APIGatewayRequestAuthorizerEvent> = {}): APIGatewayRequestAuthorizerEvent => ({
  headers: {},
  httpMethod: 'POST',
  methodArn: 'arn:aws:execute-api:us-east-1:123412341234:apiId/prod/POST/user',
  multiValueHeaders: {},
  multiValueQueryStringParameters: null,
  path: '/user',
  pathParameters: null,
  queryStringParameters: null,
  requestContext: {} as any,
  resource: '/user',
  stageVariables: null,
  type: 'REQUEST',
  ...overrides,
});

describe('API Gateway RequestAuthorizer', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      ADMIN_API_KEY: 'admin-secret-key',
      SESSION_TABLE_NAME: 'test-session-table',
      USER_TABLE_NAME: 'test-user-table',
    };
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should throw Unauthorized when no valid API key or session header is present', async () => {
    await expect(
      handler(makeAuthEvent({ headers: { 'X-Api-Key': 'frontend-key' } })),
    ).rejects.toThrow('Unauthorized');
  });

  it('should allow requests with the configured ADMIN_API_KEY', async () => {
    const result = await handler(
      makeAuthEvent({
        headers: { 'x-api-key': 'admin-secret-key' },
        httpMethod: 'POST',
        resource: '/league',
      }),
    );

    expect(result.principalId).toBe('admin-api-key');
    expect(result.policyDocument.Statement[0]).toMatchObject({
      Action: 'execute-api:Invoke',
      Effect: 'Allow',
    });
    expect(result.context).toEqual({
      isAdmin: 'true',
      username: '',
    });
  });

  it('should allow an admin session on admin-only routes', async () => {
    jest.spyOn(ddbUtils, 'getItem').mockImplementation(async (tableName: string) => {
      if (tableName === 'test-session-table') {
        return {
          Item: {
            expiration: `${Date.now() + 60_000}`,
            sessionid: 'sess-1',
            username: 'henry',
          },
        };
      }
      return {
        Item: {
          roles: ['admin', 'player'],
          username: 'henry',
        },
      };
    });

    const result = await handler(
      makeAuthEvent({
        headers: { 'X-Session-Id': 'sess-1' },
        httpMethod: 'DELETE',
        resource: '/league',
      }),
    );

    expect(result.principalId).toBe('henry');
    expect(result.policyDocument.Statement[0]).toMatchObject({ Effect: 'Allow' });
    expect(result.context).toEqual({
      isAdmin: 'true',
      username: 'henry',
    });
  });

  it('should allow a player session on self-service routes and deny on admin-only routes', async () => {
    jest.spyOn(ddbUtils, 'getItem').mockImplementation(async (tableName: string) => {
      if (tableName === 'test-session-table') {
        return {
          Item: {
            expiration: `${Date.now() + 60_000}`,
            sessionid: 'sess-player',
            username: 'alice',
          },
        };
      }
      return {
        Item: {
          roles: ['player'],
          username: 'alice',
        },
      };
    });

    const allowedResult = await handler(
      makeAuthEvent({
        headers: { 'X-Session-Id': 'sess-player' },
        httpMethod: 'PUT',
        resource: '/user',
      }),
    );
    expect(allowedResult.policyDocument.Statement[0]).toMatchObject({ Effect: 'Allow' });
    expect(allowedResult.context).toEqual({
      isAdmin: 'false',
      username: 'alice',
    });

    const deniedResult = await handler(
      makeAuthEvent({
        headers: { 'X-Session-Id': 'sess-player' },
        httpMethod: 'POST',
        resource: '/user',
      }),
    );
    expect(deniedResult.policyDocument.Statement[0]).toMatchObject({ Effect: 'Deny' });
    expect(deniedResult.context).toEqual({
      isAdmin: 'false',
      username: 'alice',
    });
  });

  it('should throw Unauthorized for expired sessions or missing users', async () => {
    jest.spyOn(ddbUtils, 'getItem').mockResolvedValueOnce({
      Item: {
        expiration: `${Date.now() - 1000}`,
        sessionid: 'expired-sess',
        username: 'alice',
      },
    });

    await expect(
      handler(makeAuthEvent({ headers: { 'X-Session-Id': 'expired-sess' } })),
    ).rejects.toThrow('Unauthorized');

    jest.spyOn(ddbUtils, 'getItem')
      .mockResolvedValueOnce({
        Item: {
          expiration: `${Date.now() + 60_000}`,
          sessionid: 'orphan-sess',
          username: 'deleted-user',
        },
      })
      .mockResolvedValueOnce({ Item: null });

    await expect(
      handler(makeAuthEvent({ headers: { 'X-Session-Id': 'orphan-sess' } })),
    ).rejects.toThrow('Unauthorized');
  });
});
