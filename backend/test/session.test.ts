import * as assert from 'node:assert/strict';
import { after, afterEach, beforeEach, describe, it, mock } from 'node:test';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../src/resources/session';
import * as ddbUtils from '../src/utils/ddb';
import { hashPassword, isHashedPassword } from '../src/utils/password';

const makeEvent = (overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent => ({
  body: null,
  headers: {},
  httpMethod: 'GET',
  isBase64Encoded: false,
  multiValueHeaders: {},
  multiValueQueryStringParameters: null,
  path: '/session',
  pathParameters: null,
  queryStringParameters: null,
  requestContext: {} as any,
  resource: '/session',
  stageVariables: null,
  ...overrides,
});

describe('session resource Lambda', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      DB_TABLE_NAME: 'test-session-table',
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

  it('POST /session should verify credentials, create session, and upgrade plaintext passwords', async () => {
    mock.method(ddbUtils, 'getItem', async () => ({
      Item: {
        password: 'legacy-plaintext-password',
        username: 'henry',
      },
    }));
    const updateSpy = mock.method(ddbUtils, 'updateItem', async () => ({ Item: null }));
    const createSpy = mock.method(ddbUtils, 'createItem', async () => {});

    const response = await handler(
      makeEvent({
        body: JSON.stringify({
          password: 'legacy-plaintext-password',
          username: ' henry ',
        }),
        httpMethod: 'POST',
      }),
    );

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.username, 'henry');
    assert.equal(typeof body.sessionid, 'string');
    assert.ok(parseInt(body.expiration, 10) > Date.now());

    assert.equal(updateSpy.mock.callCount(), 1);
    const migratedPassword = updateSpy.mock.calls[0].arguments[2].password;
    assert.equal(isHashedPassword(migratedPassword), true);
    assert.deepEqual(createSpy.mock.calls[0].arguments, ['test-session-table', body]);
  });

  it('POST /session should verify hashed password without rewriting user and reject bad credentials', async () => {
    const hashed = hashPassword('correct-pass');
    mock.method(ddbUtils, 'getItem', async () => ({
      Item: {
        password: hashed,
        username: 'alice',
      },
    }));
    const updateSpy = mock.method(ddbUtils, 'updateItem', async () => ({ Item: null }));
    mock.method(ddbUtils, 'createItem', async () => {});

    const badRes = await handler(
      makeEvent({
        body: JSON.stringify({ password: 'wrong', username: 'alice' }),
        httpMethod: 'POST',
      }),
    );
    assert.equal(badRes.statusCode, 401);

    const okRes = await handler(
      makeEvent({
        body: JSON.stringify({ password: 'correct-pass', username: 'alice' }),
        httpMethod: 'POST',
      }),
    );
    assert.equal(okRes.statusCode, 200);
    assert.equal(updateSpy.mock.callCount(), 0);
  });

  it('GET /session should require sessionid and reject expired sessions', async () => {
    const missingIdRes = await handler(makeEvent({ httpMethod: 'GET' }));
    assert.equal(missingIdRes.statusCode, 400);

    mock.method(ddbUtils, 'getItem', async () => ({
      Item: {
        expiration: `${Date.now() - 5000}`,
        sessionid: 'old-sess',
        username: 'alice',
      },
    }));
    const expiredRes = await handler(
      makeEvent({
        httpMethod: 'GET',
        queryStringParameters: { sessionid: 'old-sess' },
      }),
    );
    assert.equal(expiredRes.statusCode, 404);
  });

  it('DELETE /session should enforce ownership unless caller is admin', async () => {
    mock.method(ddbUtils, 'getItem', async () => ({
      Item: {
        expiration: `${Date.now() + 60_000}`,
        sessionid: 'sess-alice',
        username: 'alice',
      },
    }));
    const deleteSpy = mock.method(ddbUtils, 'deleteItem', async () => ({
      Item: {
        expiration: `${Date.now() + 60_000}`,
        sessionid: 'sess-alice',
        username: 'alice',
      },
    }));

    const forbiddenRes = await handler(
      makeEvent({
        httpMethod: 'DELETE',
        queryStringParameters: { sessionid: 'sess-alice' },
        requestContext: {
          authorizer: { isAdmin: 'false', username: 'bob' },
        } as any,
      }),
    );
    assert.equal(forbiddenRes.statusCode, 403);
    assert.equal(deleteSpy.mock.callCount(), 0);

    const ownerRes = await handler(
      makeEvent({
        httpMethod: 'DELETE',
        queryStringParameters: { sessionid: 'sess-alice' },
        requestContext: {
          authorizer: { isAdmin: 'false', username: 'alice' },
        } as any,
      }),
    );
    assert.equal(ownerRes.statusCode, 200);
    assert.deepEqual(deleteSpy.mock.calls[0].arguments, ['test-session-table', { sessionid: 'sess-alice' }]);
  });
});
