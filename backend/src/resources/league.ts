import { APIGatewayProxyEvent } from 'aws-lambda';
import { v4 } from 'uuid';
import { z } from 'zod';
import {
  League,
  LeagueSchema,
  MagicCardCounts,
  MagicCardCountsSchema,
  MagicCardPool,
  MagicCardPoolSchema,
  ResourceLambdaEnvSchema,
} from '../types';
import {
  createItem,
  deleteItem,
  getItem,
  listItems,
  updateItem,
} from '../utils/ddb';
import {
  MethodHandlers,
  crudHandler,
  getAuthorizerContext,
  getResponse,
} from '../utils/lambda';
import { deleteObject, getObject, putObject } from '../utils/s3';

const deactivateOtherLeagues = async (tableName: string, excludeLeaguename?: string): Promise<void> => {
  const { Items } = await listItems(tableName);
  if (!Items) {
    return;
  }
  for (const item of Items) {
    const existingLeague = LeagueSchema.parse(item);
    if (
      existingLeague.isActive === true &&
      existingLeague.leaguename &&
      existingLeague.leaguename !== excludeLeaguename
    ) {
      await updateItem(tableName, { leaguename: existingLeague.leaguename }, { isActive: false });
    }
  }
};

const hydrateLeagueS3Data = async (league: League, bucketName?: string): Promise<League> => {
  let cardPool = {} as Record<string, MagicCardPool>;
  if (league.cardPoolKey) {
    const { Body } = await getObject({
      Bucket: bucketName,
      Key: league.cardPoolKey,
    });
    const cardPoolString = z.string().parse(await Body?.transformToString());
    cardPool = z.record(z.string(), MagicCardPoolSchema).parse(JSON.parse(cardPoolString));
  }
  let cardCounts = {} as MagicCardCounts;
  if (league.cardCountsKey) {
    const { Body } = await getObject({
      Bucket: bucketName,
      Key: league.cardCountsKey,
    });
    const cardCountsString = z.string().parse(await Body?.transformToString());
    cardCounts = MagicCardCountsSchema.parse(JSON.parse(cardCountsString));
  }
  return {
    ...league,
    cardCounts,
    cardCountsKey: '[ HIDDEN ]',
    cardPool,
    cardPoolKey: '[ HIDDEN ]',
  };
};

export const handler = async (event: APIGatewayProxyEvent) => {
  const { DB_TABLE_NAME, S3_BUCKET_NAME } = ResourceLambdaEnvSchema.parse(process.env);
  const methodHandlers: MethodHandlers = {
    DeleteHandler: async (queryStringParameters: League, reqEvent: APIGatewayProxyEvent) => {
      if (!getAuthorizerContext(reqEvent).isAdmin) {
        return getResponse(403, 'Forbidden');
      }
      if (!queryStringParameters.leaguename) {
        return getResponse(400, 'QueryStringParametersErr: leaguename is required');
      }

      const { Item: existingItem } = await getItem(DB_TABLE_NAME, { leaguename: queryStringParameters.leaguename });
      if (!existingItem) {
        return getResponse(404, 'Not found');
      }
      const existingLeague = LeagueSchema.parse(existingItem);
      if (existingLeague.isActive === true) {
        return getResponse(400, 'Cannot delete the active league');
      }

      const { Item } = await deleteItem(DB_TABLE_NAME, { leaguename: queryStringParameters.leaguename });
      if (Item) {
        let league = LeagueSchema.parse(Item);
        if (league.cardPoolKey) {
          await deleteObject({
            Bucket: S3_BUCKET_NAME,
            Key: league.cardPoolKey,
          });
        }
        if (league.cardCountsKey) {
          await deleteObject({
            Bucket: S3_BUCKET_NAME,
            Key: league.cardCountsKey,
          });
        }
        const cardCounts = {} as MagicCardCounts;
        const cardPool = {} as Record<string, MagicCardPool>;
        league = {
          ...league,
          cardCounts,
          cardCountsKey: '[ HIDDEN ]',
          cardPool,
          cardPoolKey: '[ HIDDEN ]',
        };
        return getResponse(200, JSON.stringify(league));
      }
      return getResponse(404, 'Not found');
    },
    GetHandler: async (queryStringParameters: League) => {
      if (!queryStringParameters.leaguename) {
        return getResponse(400, 'QueryStringParametersErr: leaguename is required');
      }
      const { Item } = await getItem(DB_TABLE_NAME, { leaguename: queryStringParameters.leaguename });
      if (Item) {
        const league: League = await hydrateLeagueS3Data(LeagueSchema.parse(Item), S3_BUCKET_NAME);
        return getResponse(200, JSON.stringify(league));
      }
      return getResponse(404, 'Not found');
    },
    ListHandler: async () => {
      const { Items } = await listItems(DB_TABLE_NAME);
      const leaguePromises = (Items ?? []).map((Item) =>
        hydrateLeagueS3Data(LeagueSchema.parse(Item), S3_BUCKET_NAME),
      );
      const leagues: League[] = await Promise.all(leaguePromises);
      return getResponse(200, JSON.stringify(leagues));
    },
    PostHandler: async (body: League, reqEvent: APIGatewayProxyEvent) => {
      if (!getAuthorizerContext(reqEvent).isAdmin) {
        return getResponse(403, 'Forbidden');
      }
      const leaguename = body.leaguename?.trim();
      if (!leaguename) {
        return getResponse(400, 'New league must have a leaguename');
      }

      const { Item: existing } = await getItem(DB_TABLE_NAME, { leaguename });
      if (existing) {
        return getResponse(409, 'League already exists');
      }

      if (body.isActive === true) {
        await deactivateOtherLeagues(DB_TABLE_NAME, leaguename);
      }

      const leagueValues: League = {
        cardCountsKey: `counts/${v4()}`,
        cardPoolKey: `pools/${v4()}`,
        isActive: body.isActive ?? false,
        leaguename,
        poolSyncError: body.poolSyncError ?? false,
      };

      await createItem(DB_TABLE_NAME, leagueValues);
      await putObject({
        Body: JSON.stringify({}),
        Bucket: S3_BUCKET_NAME,
        Key: leagueValues.cardPoolKey,
      });
      await putObject({
        Body: JSON.stringify({}),
        Bucket: S3_BUCKET_NAME,
        Key: leagueValues.cardCountsKey,
      });

      return getResponse(200, JSON.stringify({
        ...leagueValues,
        cardCounts: {} as MagicCardCounts,
        cardCountsKey: '[ HIDDEN ]',
        cardPool: {} as Record<string, MagicCardPool>,
        cardPoolKey: '[ HIDDEN ]',
      }));
    },
    PutHandler: async (body: League, queryStringParameters: League, reqEvent: APIGatewayProxyEvent) => {
      if (!getAuthorizerContext(reqEvent).isAdmin) {
        return getResponse(403, 'Forbidden');
      }
      if (!queryStringParameters.leaguename) {
        return getResponse(400, 'QueryStringParametersErr: leaguename is required');
      }

      const { Item: existingItem } = await getItem(DB_TABLE_NAME, { leaguename: queryStringParameters.leaguename });
      if (!existingItem) {
        return getResponse(404, 'Not found');
      }
      const existingLeague = LeagueSchema.parse(existingItem);

      const {
        cardCounts: updateCardCounts,
        cardCountsKey: updateCardCountsKey,
        cardPool: updateCardPool,
        cardPoolKey: updateCardPoolKey,
        leaguename: updateLeaguename,
        ...leagueUpdateValues
      } = body;

      if (Object.keys(leagueUpdateValues).length === 0) {
        return getResponse(400, 'BodyErr: No updatable fields provided');
      }

      if (leagueUpdateValues.isActive === true) {
        await deactivateOtherLeagues(DB_TABLE_NAME, queryStringParameters.leaguename);
      } else if (leagueUpdateValues.isActive === false && existingLeague.isActive === true) {
        const { Items } = await listItems(DB_TABLE_NAME);
        const hasOtherActiveLeague = (Items ?? []).some((item) => {
          const other = LeagueSchema.parse(item);
          return other.isActive === true && other.leaguename !== queryStringParameters.leaguename;
        });
        if (!hasOtherActiveLeague) {
          return getResponse(400, 'Cannot deactivate the only active league; activate another league instead');
        }
      }

      const { Item } = await updateItem(
        DB_TABLE_NAME,
        { leaguename: queryStringParameters.leaguename },
        leagueUpdateValues,
      );
      if (Item) {
        const league: League = await hydrateLeagueS3Data(LeagueSchema.parse(Item), S3_BUCKET_NAME);
        return getResponse(200, JSON.stringify(league));
      }
      return getResponse(404, 'Not found');
    },
  };
  return crudHandler(event, LeagueSchema, methodHandlers);
};
