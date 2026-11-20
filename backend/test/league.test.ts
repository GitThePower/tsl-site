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
    jest.restoreAllMocks();
  });

  afterAll(() => {
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
    expect(nonAdminRes.statusCode).toBe(403);

    jest.spyOn(ddbUtils, 'getItem').mockResolvedValueOnce({ Item: null });
    jest.spyOn(ddbUtils, 'listItems').mockResolvedValueOnce({
      Items: [{ isActive: true, leaguename: 'Season 1' }],
    });
    const updateSpy = jest.spyOn(ddbUtils, 'updateItem').mockResolvedValue({ Item: null });
    const createSpy = jest.spyOn(ddbUtils, 'createItem').mockResolvedValue();
    const putSpy = jest.spyOn(s3Utils, 'putObject').mockResolvedValue({} as any);

    const res = await handler(
      makeEvent({
        body: JSON.stringify({ isActive: true, leaguename: 'Season 2' }),
        httpMethod: 'POST',
        requestContext: { authorizer: { isAdmin: 'true', username: 'henry' } } as any,
      }),
    );

    expect(res.statusCode).toBe(200);
    expect(updateSpy).toHaveBeenCalledWith(
      'test-league-table',
      { leaguename: 'Season 1' },
      { isActive: false },
    );
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(putSpy).toHaveBeenCalledTimes(2);
    expect(JSON.parse(res.body).leaguename).toBe('Season 2');
    expect(JSON.parse(res.body).isActive).toBe(true);
  });

  it('PUT /league should switch active leagues safely and prevent deactivating the sole active league', async () => {
    jest.spyOn(ddbUtils, 'getItem').mockResolvedValue({
      Item: {
        cardCountsKey: 'counts/1',
        cardPoolKey: 'pools/1',
        isActive: true,
        leaguename: 'Season 1',
      },
    });
    jest.spyOn(ddbUtils, 'listItems').mockResolvedValue({
      Items: [{ isActive: true, leaguename: 'Season 1' }],
    });

    const deactivateOnlyRes = await handler(
      makeEvent({
        body: JSON.stringify({ isActive: false }),
        httpMethod: 'PUT',
        queryStringParameters: { leaguename: 'Season 1' },
        requestContext: { authorizer: { isAdmin: 'true', username: 'henry' } } as any,
      }),
    );
    expect(deactivateOnlyRes.statusCode).toBe(400);

    jest.spyOn(ddbUtils, 'getItem').mockResolvedValueOnce({
      Item: {
        cardCountsKey: 'counts/2',
        cardPoolKey: 'pools/2',
        isActive: false,
        leaguename: 'Season 2',
      },
    });
    jest.spyOn(ddbUtils, 'listItems').mockResolvedValueOnce({
      Items: [
        { isActive: true, leaguename: 'Season 1' },
        { isActive: false, leaguename: 'Season 2' },
      ],
    });
    const updateSpy = jest.spyOn(ddbUtils, 'updateItem')
      .mockResolvedValueOnce({ Item: null })
      .mockResolvedValueOnce({
        Item: {
          cardCountsKey: 'counts/2',
          cardPoolKey: 'pools/2',
          isActive: true,
          leaguename: 'Season 2',
        },
      });
    jest.spyOn(s3Utils, 'getObject').mockResolvedValue({
      Body: { transformToString: async () => '{}' },
    } as any);

    const activateRes = await handler(
      makeEvent({
        body: JSON.stringify({ isActive: true, leaguename: 'Season 2' }),
        httpMethod: 'PUT',
        queryStringParameters: { leaguename: 'Season 2' },
        requestContext: { authorizer: { isAdmin: 'true', username: 'henry' } } as any,
      }),
    );
    expect(activateRes.statusCode).toBe(200);
    expect(updateSpy).toHaveBeenNthCalledWith(
      1,
      'test-league-table',
      { leaguename: 'Season 1' },
      { isActive: false },
    );
    expect(updateSpy).toHaveBeenNthCalledWith(
      2,
      'test-league-table',
      { leaguename: 'Season 2' },
      { isActive: true },
    );
  });

  it('DELETE /league should block deleting active league and delete inactive league + S3 objects', async () => {
    jest.spyOn(ddbUtils, 'getItem').mockResolvedValueOnce({
      Item: { isActive: true, leaguename: 'Active League' },
    });
    const activeDeleteRes = await handler(
      makeEvent({
        httpMethod: 'DELETE',
        queryStringParameters: { leaguename: 'Active League' },
        requestContext: { authorizer: { isAdmin: 'true', username: 'henry' } } as any,
      }),
    );
    expect(activeDeleteRes.statusCode).toBe(400);

    jest.spyOn(ddbUtils, 'getItem').mockResolvedValueOnce({
      Item: {
        cardCountsKey: 'counts/old',
        cardPoolKey: 'pools/old',
        isActive: false,
        leaguename: 'Old League',
      },
    });
    const deleteDdbSpy = jest.spyOn(ddbUtils, 'deleteItem').mockResolvedValueOnce({
      Item: {
        cardCountsKey: 'counts/old',
        cardPoolKey: 'pools/old',
        isActive: false,
        leaguename: 'Old League',
      },
    });
    const deleteS3Spy = jest.spyOn(s3Utils, 'deleteObject').mockResolvedValue({} as any);

    const inactiveDeleteRes = await handler(
      makeEvent({
        httpMethod: 'DELETE',
        queryStringParameters: { leaguename: 'Old League' },
        requestContext: { authorizer: { isAdmin: 'true', username: 'henry' } } as any,
      }),
    );
    expect(inactiveDeleteRes.statusCode).toBe(200);
    expect(deleteDdbSpy).toHaveBeenCalledWith('test-league-table', { leaguename: 'Old League' });
    expect(deleteS3Spy).toHaveBeenCalledTimes(2);
  });
});
