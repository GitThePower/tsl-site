import * as assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { z } from 'zod';
import {
  LeagueSchema,
  MoxfieldContentSchema,
  SessionSchema,
  UpdateUserBodySchema,
  UserSchema,
} from '../src/types';
import { crudHandler, getResponse } from '../src/utils/lambda';

const makeEvent = (overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent => ({
  body: null,
  headers: {},
  httpMethod: 'GET',
  isBase64Encoded: false,
  multiValueHeaders: {},
  multiValueQueryStringParameters: null,
  path: '/test',
  pathParameters: null,
  queryStringParameters: null,
  requestContext: {} as any,
  resource: '/test',
  stageVariables: null,
  ...overrides,
});

describe('Zod v4 schema and crudHandler validation', () => {
  it('accepts valid partial payloads and rejects empty objects across refined schemas', () => {
    assert.deepEqual(LeagueSchema.parse({ leaguename: 'Season 1' }), { leaguename: 'Season 1' });
    assert.deepEqual(SessionSchema.parse({ sessionid: 'sess-1' }), { sessionid: 'sess-1' });
    assert.deepEqual(UserSchema.parse({ username: 'alice' }), { username: 'alice' });
    assert.deepEqual(UpdateUserBodySchema.parse({ roles: ['admin'] }), { roles: ['admin'] });

    for (const schema of [LeagueSchema, SessionSchema, UpdateUserBodySchema, UserSchema]) {
      const result = schema.safeParse({});
      assert.equal(result.success, false);
      if (!result.success) {
        assert.equal(
          result.error.issues.some((issue) => issue.message === 'One of the fields must be defined'),
          true,
        );
      }
    }
  });

  it('throws z.ZodError when MoxfieldContentSchema parses malformed input', () => {
    assert.throws(() => MoxfieldContentSchema.parse({ unexpected: 'shape' }), z.ZodError);
  });

  it('crudHandler validates JSON bodies, refined schemas, and query parameters', async () => {
    const getHandler = mock.fn(async (query: { leaguename?: string }, _event?: APIGatewayProxyEvent) =>
      getResponse(200, JSON.stringify({ got: query })),
    );
    const listHandler = mock.fn(async () => getResponse(200, '[]'));
    const postHandler = mock.fn(
      async (body: { isActive?: boolean; leaguename?: string }, _event?: APIGatewayProxyEvent) =>
        getResponse(200, JSON.stringify({ posted: body })),
    );
    const handlers = {
      GetHandler: getHandler,
      ListHandler: listHandler,
      PostHandler: postHandler,
    };

    const badJsonRes = await crudHandler(
      makeEvent({ body: '{invalid-json', httpMethod: 'POST' }),
      LeagueSchema,
      handlers,
    );
    assert.equal(badJsonRes.statusCode, 400);
    assert.equal(badJsonRes.body, 'BodyErr: Invalid JSON body');

    const emptyBodyRes = await crudHandler(
      makeEvent({ body: JSON.stringify({}), httpMethod: 'POST' }),
      LeagueSchema,
      handlers,
    );
    assert.equal(emptyBodyRes.statusCode, 400);
    assert.match(emptyBodyRes.body, /^BodyErr:/);
    assert.ok(emptyBodyRes.body.includes('One of the fields must be defined'));

    const emptyQueryRes = await crudHandler(
      makeEvent({ httpMethod: 'GET', queryStringParameters: {} }),
      LeagueSchema,
      handlers,
    );
    assert.equal(emptyQueryRes.statusCode, 400);
    assert.match(emptyQueryRes.body, /^QueryStringParametersErr:/);
    assert.ok(emptyQueryRes.body.includes('One of the fields must be defined'));

    const validPostRes = await crudHandler(
      makeEvent({
        body: JSON.stringify({ isActive: true, leaguename: 'Season 2' }),
        httpMethod: 'POST',
      }),
      LeagueSchema,
      handlers,
    );
    assert.equal(validPostRes.statusCode, 200);
    assert.equal(postHandler.mock.callCount(), 1);
    assert.deepEqual(postHandler.mock.calls[0].arguments[0], { isActive: true, leaguename: 'Season 2' });
    assert.equal(typeof postHandler.mock.calls[0].arguments[1], 'object');

    const validGetRes = await crudHandler(
      makeEvent({
        httpMethod: 'GET',
        queryStringParameters: { leaguename: 'Season 2' },
      }),
      LeagueSchema,
      handlers,
    );
    assert.equal(validGetRes.statusCode, 200);
    assert.equal(getHandler.mock.callCount(), 1);
    assert.deepEqual(getHandler.mock.calls[0].arguments[0], { leaguename: 'Season 2' });
    assert.equal(typeof getHandler.mock.calls[0].arguments[1], 'object');
  });
});
