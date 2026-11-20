import * as assert from 'node:assert/strict';
import { after, afterEach, beforeEach, describe, it, mock } from 'node:test';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../src/resources/user';
import * as ddbUtils from '../src/utils/ddb';
import { hashPassword, isHashedPassword } from '../src/utils/password';

const makeEvent = (overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent => ({
  body: null,
  headers: {},
  httpMethod: 'GET',
  isBase64Encoded: false,
  multiValueHeaders: {},
  multiValueQueryStringParameters: null,
  path: '/user',
  pathParameters: null,
  queryStringParameters: null,
  requestContext: {} as any,
  resource: '/user',
  stageVariables: null,
  ...overrides,
});

describe('user resource Lambda', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      DB_TABLE_NAME: 'test-user-table',
    };
    mock.restoreAll();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  after(() => {
    process.env = originalEnv;
  });

  it('GET /user should mask passwords and default roles to player', async () => {
    mock.method(ddbUtils, 'getItem', async () => ({
      Item: {
        leagues: [{ decklistUrl: 'https://moxfield.com/decks/abc', leaguename: 'Season 1' }],
        password: 'super-secret-password',
        username: 'alice',
      },
    }));

    const res = await handler(
      makeEvent({
        httpMethod: 'GET',
        queryStringParameters: { username: 'alice' },
      }),
    );

    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), {
      leagues: [{ decklistUrl: 'https://moxfield.com/decks/abc', leaguename: 'Season 1' }],
      password: '[ HIDDEN ]',
      roles: ['player'],
      username: 'alice',
    });
  });

  it('POST /user should require admin, reject duplicates, and hash passwords', async () => {
    const nonAdminRes = await handler(
      makeEvent({
        body: JSON.stringify({ password: 'pw', username: 'newuser' }),
        httpMethod: 'POST',
        requestContext: { authorizer: { isAdmin: 'false', username: 'alice' } } as any,
      }),
    );
    assert.equal(nonAdminRes.statusCode, 403);

    mock.method(ddbUtils, 'getItem', async () => ({
      Item: { username: 'existing' },
    }));
    const dupRes = await handler(
      makeEvent({
        body: JSON.stringify({ password: 'pw', username: 'existing' }),
        httpMethod: 'POST',
        requestContext: { authorizer: { isAdmin: 'true', username: 'henry' } } as any,
      }),
    );
    assert.equal(dupRes.statusCode, 409);

    mock.restoreAll();

    mock.method(ddbUtils, 'getItem', async () => ({ Item: null }));
    const createSpy = mock.method(ddbUtils, 'createItem', async () => {});

    const okRes = await handler(
      makeEvent({
        body: JSON.stringify({
          leagues: [{ decklistUrl: 'https://moxfield.com/decks/123', leaguename: 'Season 1' }],
          password: 'initial-password',
          username: ' bob ',
        }),
        httpMethod: 'POST',
        requestContext: { authorizer: { isAdmin: 'true', username: 'henry' } } as any,
      }),
    );

    assert.equal(okRes.statusCode, 200);
    assert.equal(createSpy.mock.callCount(), 1);
    const savedUser = createSpy.mock.calls[0].arguments[1];
    assert.equal(savedUser.username, 'bob');
    assert.deepEqual(savedUser.roles, ['player']);
    assert.equal(isHashedPassword(savedUser.password), true);
    assert.equal(JSON.parse(okRes.body).password, '[ HIDDEN ]');
  });

  it('PUT /user should enforce self-update rules for players and allow admin updates', async () => {
    const storedHash = hashPassword('old-pass');
    mock.method(ddbUtils, 'getItem', async () => ({
      Item: {
        leagues: [],
        password: storedHash,
        roles: ['player'],
        username: 'alice',
      },
    }));

    const otherUserForbidden = await handler(
      makeEvent({
        body: JSON.stringify({ leagues: [] }),
        httpMethod: 'PUT',
        queryStringParameters: { username: 'alice' },
        requestContext: { authorizer: { isAdmin: 'false', username: 'bob' } } as any,
      }),
    );
    assert.equal(otherUserForbidden.statusCode, 403);

    const roleEscalationForbidden = await handler(
      makeEvent({
        body: JSON.stringify({ roles: ['admin'] }),
        httpMethod: 'PUT',
        queryStringParameters: { username: 'alice' },
        requestContext: { authorizer: { isAdmin: 'false', username: 'alice' } } as any,
      }),
    );
    assert.equal(roleEscalationForbidden.statusCode, 403);

    const wrongCurrPassword = await handler(
      makeEvent({
        body: JSON.stringify({ currentPassword: 'wrong', password: 'new-pass' }),
        httpMethod: 'PUT',
        queryStringParameters: { username: 'alice' },
        requestContext: { authorizer: { isAdmin: 'false', username: 'alice' } } as any,
      }),
    );
    assert.equal(wrongCurrPassword.statusCode, 403);

    const updateSpy = mock.method(ddbUtils, 'updateItem', async () => ({
      Item: {
        leagues: [],
        password: hashPassword('new-pass'),
        roles: ['player'],
        username: 'alice',
      },
    }));

    const playerPassChange = await handler(
      makeEvent({
        body: JSON.stringify({ currentPassword: 'old-pass', password: 'new-pass' }),
        httpMethod: 'PUT',
        queryStringParameters: { username: 'alice' },
        requestContext: { authorizer: { isAdmin: 'false', username: 'alice' } } as any,
      }),
    );
    assert.equal(playerPassChange.statusCode, 200);
    assert.equal(isHashedPassword(updateSpy.mock.calls[0].arguments[2].password), true);
    assert.equal(updateSpy.mock.calls[0].arguments[2].currentPassword, undefined);

    const selfDemoteRes = await handler(
      makeEvent({
        body: JSON.stringify({ roles: ['player'] }),
        httpMethod: 'PUT',
        queryStringParameters: { username: 'alice' },
        requestContext: { authorizer: { isAdmin: 'true', username: 'alice' } } as any,
      }),
    );
    assert.equal(selfDemoteRes.statusCode, 400);
  });

  it('DELETE /user should delete by username query param and guard self-deletion', async () => {
    const selfDeleteRes = await handler(
      makeEvent({
        httpMethod: 'DELETE',
        queryStringParameters: { username: 'henry' },
        requestContext: { authorizer: { isAdmin: 'true', username: 'henry' } } as any,
      }),
    );
    assert.equal(selfDeleteRes.statusCode, 400);

    const deleteSpy = mock.method(ddbUtils, 'deleteItem', async () => ({
      Item: {
        password: 'hashed',
        roles: ['player'],
        username: 'alice',
      },
    }));

    const okRes = await handler(
      makeEvent({
        httpMethod: 'DELETE',
        queryStringParameters: { username: 'alice' },
        requestContext: { authorizer: { isAdmin: 'true', username: 'henry' } } as any,
      }),
    );
    assert.equal(okRes.statusCode, 200);
    assert.deepEqual(deleteSpy.mock.calls[0].arguments, ['test-user-table', { username: 'alice' }]);
    assert.equal(JSON.parse(okRes.body).password, '[ HIDDEN ]');
  });
});
