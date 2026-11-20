import * as assert from 'node:assert/strict';
import { after, afterEach, beforeEach, describe, it, mock } from 'node:test';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { handler } from '../src/resources/league';
import * as ddbUtils from '../src/utils/ddb';
import * as s3Utils from '../src/utils/s3';

const makeEvent = (overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent => ({
  body: null,
  headers: {},
  httpMethod: 'GET',
  isBase64Encoded: false,
  multiValueHeaders: {},
  multiValueQueryStringParameters: null,
  path: '/league',
  pathParameters: null,
  queryStringParameters: null,
  requestContext: {} as any,
  resource: '/league',
  stageVariables: null,
  ...overrides,
});

describe('league resource Lambda', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      DB_TABLE_NAME: 'test-league-table',
      S3_BUCKET_NAME: 'test-league-bucket',
    };
    mock.restoreAll();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  after(() => {
    process.env = originalEnv;
  });

  it('POST /league should require admin, deactivate prior active leagues when active, and initialize S3 keys', async () => {
    const nonAdminRes = await handler(
      makeEvent({
        body: JSON.stringify({ isActive: true, leaguename: 'Season 2' }),
        httpMethod: 'POST',
        requestContext: { authorizer: { isAdmin: 'false', username: 'alice' } } as any,
      }),
    );
    assert.equal(nonAdminRes.statusCode, 403);

    mock.method(ddbUtils, 'getItem', async () => ({ Item: null }));
    mock.method(ddbUtils, 'listItems', async () => ({
      Items: [{ isActive: true, leaguename: 'Season 1' }],
    }));
    const updateSpy = mock.method(ddbUtils, 'updateItem', async () => ({ Item: null }));
    const createSpy = mock.method(ddbUtils, 'createItem', async () => {});
    const putSpy = mock.method(s3Utils, 'putObject', async () => ({} as any));

    const res = await handler(
      makeEvent({
        body: JSON.stringify({ isActive: true, leaguename: 'Season 2' }),
        httpMethod: 'POST',
        requestContext: { authorizer: { isAdmin: 'true', username: 'henry' } } as any,
      }),
    );

    assert.equal(res.statusCode, 200);
    assert.deepEqual(updateSpy.mock.calls[0].arguments, [
      'test-league-table',
      { leaguename: 'Season 1' },
      { isActive: false },
    ]);
    assert.equal(createSpy.mock.callCount(), 1);
    assert.equal(putSpy.mock.callCount(), 2);
    assert.equal(JSON.parse(res.body).leaguename, 'Season 2');
    assert.equal(JSON.parse(res.body).isActive, true);
  });

  it('PUT /league should switch active leagues safely and prevent deactivating the sole active league', async () => {
    mock.method(ddbUtils, 'getItem', async () => ({
      Item: {
        cardCountsKey: 'counts/1',
        cardPoolKey: 'pools/1',
        isActive: true,
        leaguename: 'Season 1',
      },
    }));
    mock.method(ddbUtils, 'listItems', async () => ({
      Items: [{ isActive: true, leaguename: 'Season 1' }],
    }));

    const deactivateOnlyRes = await handler(
      makeEvent({
        body: JSON.stringify({ isActive: false }),
        httpMethod: 'PUT',
        queryStringParameters: { leaguename: 'Season 1' },
        requestContext: { authorizer: { isAdmin: 'true', username: 'henry' } } as any,
      }),
    );
    assert.equal(deactivateOnlyRes.statusCode, 400);

    mock.restoreAll();

    mock.method(ddbUtils, 'getItem', async () => ({
      Item: {
        cardCountsKey: 'counts/2',
        cardPoolKey: 'pools/2',
        isActive: false,
        leaguename: 'Season 2',
      },
    }));
    mock.method(ddbUtils, 'listItems', async () => ({
      Items: [
        { isActive: true, leaguename: 'Season 1' },
        { isActive: false, leaguename: 'Season 2' },
      ],
    }));
    const updateSpy = mock.method(ddbUtils, 'updateItem');
    updateSpy.mock.mockImplementationOnce(async () => ({ Item: null }), 0);
    updateSpy.mock.mockImplementationOnce(async () => ({
      Item: {
        cardCountsKey: 'counts/2',
        cardPoolKey: 'pools/2',
        isActive: true,
        leaguename: 'Season 2',
      },
    }), 1);
    mock.method(s3Utils, 'getObject', async () => ({
      Body: { transformToString: async () => '{}' },
    }) as any);

    const activateRes = await handler(
      makeEvent({
        body: JSON.stringify({ isActive: true, leaguename: 'Season 2' }),
        httpMethod: 'PUT',
        queryStringParameters: { leaguename: 'Season 2' },
        requestContext: { authorizer: { isAdmin: 'true', username: 'henry' } } as any,
      }),
    );
    assert.equal(activateRes.statusCode, 200);
    assert.deepEqual(updateSpy.mock.calls[0].arguments, [
      'test-league-table',
      { leaguename: 'Season 1' },
      { isActive: false },
    ]);
    assert.deepEqual(updateSpy.mock.calls[1].arguments, [
      'test-league-table',
      { leaguename: 'Season 2' },
      { isActive: true },
    ]);
  });

  it('DELETE /league should block deleting active league and delete inactive league + S3 objects', async () => {
    mock.method(ddbUtils, 'getItem', async () => ({
      Item: { isActive: true, leaguename: 'Active League' },
    }));
    const activeDeleteRes = await handler(
      makeEvent({
        httpMethod: 'DELETE',
        queryStringParameters: { leaguename: 'Active League' },
        requestContext: { authorizer: { isAdmin: 'true', username: 'henry' } } as any,
      }),
    );
    assert.equal(activeDeleteRes.statusCode, 400);

    mock.restoreAll();

    mock.method(ddbUtils, 'getItem', async () => ({
      Item: {
        cardCountsKey: 'counts/old',
        cardPoolKey: 'pools/old',
        isActive: false,
        leaguename: 'Old League',
      },
    }));
    const deleteDdbSpy = mock.method(ddbUtils, 'deleteItem', async () => ({
      Item: {
        cardCountsKey: 'counts/old',
        cardPoolKey: 'pools/old',
        isActive: false,
        leaguename: 'Old League',
      },
    }));
    const deleteS3Spy = mock.method(s3Utils, 'deleteObject', async () => ({} as any));

    const inactiveDeleteRes = await handler(
      makeEvent({
        httpMethod: 'DELETE',
        queryStringParameters: { leaguename: 'Old League' },
        requestContext: { authorizer: { isAdmin: 'true', username: 'henry' } } as any,
      }),
    );
    assert.equal(inactiveDeleteRes.statusCode, 200);
    assert.deepEqual(deleteDdbSpy.mock.calls[0].arguments, ['test-league-table', { leaguename: 'Old League' }]);
    assert.equal(deleteS3Spy.mock.callCount(), 2);
  });
});
