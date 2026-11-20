import * as assert from 'node:assert/strict';
import { after, afterEach, beforeEach, describe, it, mock } from 'node:test';
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
    mock.restoreAll();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  after(() => {
    process.env = originalEnv;
  });

  it('should throw Unauthorized when no valid API key or session header is present', async () => {
    await assert.rejects(
      handler(makeAuthEvent({ headers: { 'X-Api-Key': 'frontend-key' } })),
      { message: 'Unauthorized' },
    );
  });

  it('should allow requests with the configured ADMIN_API_KEY', async () => {
    const result = await handler(
      makeAuthEvent({
        headers: { 'x-api-key': 'admin-secret-key' },
        httpMethod: 'POST',
        resource: '/league',
      }),
    );

    assert.equal(result.principalId, 'admin-api-key');
    const statement = result.policyDocument.Statement[0] as { Action: string; Effect: string };
    assert.equal(statement.Action, 'execute-api:Invoke');
    assert.equal(statement.Effect, 'Allow');
    assert.deepEqual(result.context, {
      isAdmin: 'true',
      username: '',
    });
  });

  it('should allow an admin session on admin-only routes', async () => {
    mock.method(ddbUtils, 'getItem', async (tableName: string) => {
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

    assert.equal(result.principalId, 'henry');
    assert.equal((result.policyDocument.Statement[0] as { Effect: string }).Effect, 'Allow');
    assert.deepEqual(result.context, {
      isAdmin: 'true',
      username: 'henry',
    });
  });

  it('should allow a player session on self-service routes and deny on admin-only routes', async () => {
    mock.method(ddbUtils, 'getItem', async (tableName: string) => {
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
    assert.equal((allowedResult.policyDocument.Statement[0] as { Effect: string }).Effect, 'Allow');
    assert.deepEqual(allowedResult.context, {
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
    assert.equal((deniedResult.policyDocument.Statement[0] as { Effect: string }).Effect, 'Deny');
    assert.deepEqual(deniedResult.context, {
      isAdmin: 'false',
      username: 'alice',
    });
  });

  it('should throw Unauthorized for expired sessions or missing users', async () => {
    const getItemMock = mock.method(ddbUtils, 'getItem');
    getItemMock.mock.mockImplementationOnce(async () => ({
      Item: {
        expiration: `${Date.now() - 1000}`,
        sessionid: 'expired-sess',
        username: 'alice',
      },
    }), 0);

    await assert.rejects(
      handler(makeAuthEvent({ headers: { 'X-Session-Id': 'expired-sess' } })),
      { message: 'Unauthorized' },
    );

    getItemMock.mock.mockImplementationOnce(async () => ({
      Item: {
        expiration: `${Date.now() + 60_000}`,
        sessionid: 'orphan-sess',
        username: 'deleted-user',
      },
    }), 1);
    getItemMock.mock.mockImplementationOnce(async () => ({ Item: null }), 2);

    await assert.rejects(
      handler(makeAuthEvent({ headers: { 'X-Session-Id': 'orphan-sess' } })),
      { message: 'Unauthorized' },
    );
  });
});
