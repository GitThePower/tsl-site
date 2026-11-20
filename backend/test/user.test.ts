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
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('GET /user should mask passwords and default roles to player', async () => {
    jest.spyOn(ddbUtils, 'getItem').mockResolvedValue({
      Item: {
        leagues: [{ decklistUrl: 'https://moxfield.com/decks/abc', leaguename: 'Season 1' }],
        password: 'super-secret-password',
        username: 'alice',
      },
    });

    const res = await handler(
      makeEvent({
        httpMethod: 'GET',
        queryStringParameters: { username: 'alice' },
      }),
    );

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
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
    expect(nonAdminRes.statusCode).toBe(403);

    jest.spyOn(ddbUtils, 'getItem').mockResolvedValueOnce({
      Item: { username: 'existing' },
    });
    const dupRes = await handler(
      makeEvent({
        body: JSON.stringify({ password: 'pw', username: 'existing' }),
        httpMethod: 'POST',
        requestContext: { authorizer: { isAdmin: 'true', username: 'henry' } } as any,
      }),
    );
    expect(dupRes.statusCode).toBe(409);

    jest.spyOn(ddbUtils, 'getItem').mockResolvedValueOnce({ Item: null });
    const createSpy = jest.spyOn(ddbUtils, 'createItem').mockResolvedValue();

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

    expect(okRes.statusCode).toBe(200);
    expect(createSpy).toHaveBeenCalledTimes(1);
    const savedUser = createSpy.mock.calls[0][1];
    expect(savedUser.username).toBe('bob');
    expect(savedUser.roles).toEqual(['player']);
    expect(isHashedPassword(savedUser.password)).toBe(true);
    expect(JSON.parse(okRes.body).password).toBe('[ HIDDEN ]');
  });

  it('PUT /user should enforce self-update rules for players and allow admin updates', async () => {
    const storedHash = hashPassword('old-pass');
    jest.spyOn(ddbUtils, 'getItem').mockResolvedValue({
      Item: {
        leagues: [],
        password: storedHash,
        roles: ['player'],
        username: 'alice',
      },
    });

    const otherUserForbidden = await handler(
      makeEvent({
        body: JSON.stringify({ leagues: [] }),
        httpMethod: 'PUT',
        queryStringParameters: { username: 'alice' },
        requestContext: { authorizer: { isAdmin: 'false', username: 'bob' } } as any,
      }),
    );
    expect(otherUserForbidden.statusCode).toBe(403);

    const roleEscalationForbidden = await handler(
      makeEvent({
        body: JSON.stringify({ roles: ['admin'] }),
        httpMethod: 'PUT',
        queryStringParameters: { username: 'alice' },
        requestContext: { authorizer: { isAdmin: 'false', username: 'alice' } } as any,
      }),
    );
    expect(roleEscalationForbidden.statusCode).toBe(403);

    const wrongCurrPassword = await handler(
      makeEvent({
        body: JSON.stringify({ currentPassword: 'wrong', password: 'new-pass' }),
        httpMethod: 'PUT',
        queryStringParameters: { username: 'alice' },
        requestContext: { authorizer: { isAdmin: 'false', username: 'alice' } } as any,
      }),
    );
    expect(wrongCurrPassword.statusCode).toBe(403);

    const updateSpy = jest.spyOn(ddbUtils, 'updateItem').mockResolvedValue({
      Item: {
        leagues: [],
        password: hashPassword('new-pass'),
        roles: ['player'],
        username: 'alice',
      },
    });

    const playerPassChange = await handler(
      makeEvent({
        body: JSON.stringify({ currentPassword: 'old-pass', password: 'new-pass' }),
        httpMethod: 'PUT',
        queryStringParameters: { username: 'alice' },
        requestContext: { authorizer: { isAdmin: 'false', username: 'alice' } } as any,
      }),
    );
    expect(playerPassChange.statusCode).toBe(200);
    expect(isHashedPassword(updateSpy.mock.calls[0][2].password)).toBe(true);
    expect(updateSpy.mock.calls[0][2].currentPassword).toBeUndefined();

    const selfDemoteRes = await handler(
      makeEvent({
        body: JSON.stringify({ roles: ['player'] }),
        httpMethod: 'PUT',
        queryStringParameters: { username: 'alice' },
        requestContext: { authorizer: { isAdmin: 'true', username: 'alice' } } as any,
      }),
    );
    expect(selfDemoteRes.statusCode).toBe(400);
  });

  it('DELETE /user should delete by username query param and guard self-deletion', async () => {
    const selfDeleteRes = await handler(
      makeEvent({
        httpMethod: 'DELETE',
        queryStringParameters: { username: 'henry' },
        requestContext: { authorizer: { isAdmin: 'true', username: 'henry' } } as any,
      }),
    );
    expect(selfDeleteRes.statusCode).toBe(400);

    const deleteSpy = jest.spyOn(ddbUtils, 'deleteItem').mockResolvedValue({
      Item: {
        password: 'hashed',
        roles: ['player'],
        username: 'alice',
      },
    });

    const okRes = await handler(
      makeEvent({
        httpMethod: 'DELETE',
        queryStringParameters: { username: 'alice' },
        requestContext: { authorizer: { isAdmin: 'true', username: 'henry' } } as any,
      }),
    );
    expect(okRes.statusCode).toBe(200);
    expect(deleteSpy).toHaveBeenCalledWith('test-user-table', { username: 'alice' });
    expect(JSON.parse(okRes.body).password).toBe('[ HIDDEN ]');
  });
});
