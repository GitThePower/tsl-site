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
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('POST /session should verify credentials, create session, and upgrade plaintext passwords', async () => {
    jest.spyOn(ddbUtils, 'getItem').mockResolvedValue({
      Item: {
        password: 'legacy-plaintext-password',
        username: 'henry',
      },
    });
    const updateSpy = jest.spyOn(ddbUtils, 'updateItem').mockResolvedValue({ Item: null });
    const createSpy = jest.spyOn(ddbUtils, 'createItem').mockResolvedValue();

    const response = await handler(
      makeEvent({
        body: JSON.stringify({
          password: 'legacy-plaintext-password',
          username: ' henry ',
        }),
        httpMethod: 'POST',
      }),
    );

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.username).toBe('henry');
    expect(typeof body.sessionid).toBe('string');
    expect(parseInt(body.expiration, 10)).toBeGreaterThan(Date.now());

    expect(updateSpy).toHaveBeenCalledTimes(1);
    const migratedPassword = updateSpy.mock.calls[0][2].password;
    expect(isHashedPassword(migratedPassword)).toBe(true);
    expect(createSpy).toHaveBeenCalledWith('test-session-table', body);
  });

  it('POST /session should verify hashed password without rewriting user and reject bad credentials', async () => {
    const hashed = hashPassword('correct-pass');
    jest.spyOn(ddbUtils, 'getItem').mockResolvedValue({
      Item: {
        password: hashed,
        username: 'alice',
      },
    });
    const updateSpy = jest.spyOn(ddbUtils, 'updateItem').mockResolvedValue({ Item: null });
    jest.spyOn(ddbUtils, 'createItem').mockResolvedValue();

    const badRes = await handler(
      makeEvent({
        body: JSON.stringify({ password: 'wrong', username: 'alice' }),
        httpMethod: 'POST',
      }),
    );
    expect(badRes.statusCode).toBe(401);

    const okRes = await handler(
      makeEvent({
        body: JSON.stringify({ password: 'correct-pass', username: 'alice' }),
        httpMethod: 'POST',
      }),
    );
    expect(okRes.statusCode).toBe(200);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('GET /session should require sessionid and reject expired sessions', async () => {
    const missingIdRes = await handler(makeEvent({ httpMethod: 'GET' }));
    expect(missingIdRes.statusCode).toBe(400);

    jest.spyOn(ddbUtils, 'getItem').mockResolvedValueOnce({
      Item: {
        expiration: `${Date.now() - 5000}`,
        sessionid: 'old-sess',
        username: 'alice',
      },
    });
    const expiredRes = await handler(
      makeEvent({
        httpMethod: 'GET',
        queryStringParameters: { sessionid: 'old-sess' },
      }),
    );
    expect(expiredRes.statusCode).toBe(404);
  });

  it('DELETE /session should enforce ownership unless caller is admin', async () => {
    jest.spyOn(ddbUtils, 'getItem').mockResolvedValue({
      Item: {
        expiration: `${Date.now() + 60_000}`,
        sessionid: 'sess-alice',
        username: 'alice',
      },
    });
    const deleteSpy = jest.spyOn(ddbUtils, 'deleteItem').mockResolvedValue({
      Item: {
        expiration: `${Date.now() + 60_000}`,
        sessionid: 'sess-alice',
        username: 'alice',
      },
    });

    const forbiddenRes = await handler(
      makeEvent({
        httpMethod: 'DELETE',
        queryStringParameters: { sessionid: 'sess-alice' },
        requestContext: {
          authorizer: { isAdmin: 'false', username: 'bob' },
        } as any,
      }),
    );
    expect(forbiddenRes.statusCode).toBe(403);
    expect(deleteSpy).not.toHaveBeenCalled();

    const ownerRes = await handler(
      makeEvent({
        httpMethod: 'DELETE',
        queryStringParameters: { sessionid: 'sess-alice' },
        requestContext: {
          authorizer: { isAdmin: 'false', username: 'alice' },
        } as any,
      }),
    );
    expect(ownerRes.statusCode).toBe(200);
    expect(deleteSpy).toHaveBeenCalledWith('test-session-table', { sessionid: 'sess-alice' });
  });
});
