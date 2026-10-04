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
import { MethodHandlers, crudHandler, getResponse } from '../utils/lambda';
import { deleteObject, getObject, putObject } from '../utils/s3';

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
    DeleteHandler: async (queryStringParameter: any) => {
      const { Item } = await deleteItem(DB_TABLE_NAME, queryStringParameter.data);
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
    GetHandler: async (queryStringParameters: any) => {
      const { Item } = await getItem(DB_TABLE_NAME, queryStringParameters);
      if (Item) {
        const league: League = await hydrateLeagueS3Data(LeagueSchema.parse(Item), S3_BUCKET_NAME);
        return getResponse(200, JSON.stringify(league));
      }
      return getResponse(404, 'Not found');
    },
    ListHandler: async () => {
      const { Items } = await listItems(DB_TABLE_NAME);
      if (Items) {
        const leaguePromises = Items.map((Item) => hydrateLeagueS3Data(LeagueSchema.parse(Item), S3_BUCKET_NAME));
        const leagues: League[] = await Promise.all(leaguePromises);
        return getResponse(200, JSON.stringify(leagues));
      }
      return getResponse(404, 'Not found');
    },
    PostHandler: async (body: any) => {
      const league = LeagueSchema.parse(body);
      if (!league.leaguename) throw new Error('New league must have a leaguename!');
      const { cardCounts, cardPool, ...leagueValues } = league;
      leagueValues.cardPoolKey = v4();
      leagueValues.cardCountsKey = v4();
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
      return getResponse(200, 'Successful Create!');
    },
    PutHandler: async (body: any, queryStringParameters: any) => {
      const leagueQuery = LeagueSchema.parse(queryStringParameters);
      const leagueUpdate = LeagueSchema.parse(body);
      const {
        cardCounts: queryCardCounts,
        cardCountsKey: queryCardCountsKey,
        cardPool: queryCardPool,
        cardPoolKey: queryCardPoolKey,
        ...leagueQueryValues
      } = leagueQuery;
      const {
        cardCounts: updateCardCounts,
        cardCountsKey: updateCardCountsKey,
        cardPool: updateCardPool,
        cardPoolKey: updateCardPoolKey,
        ...leagueUpdateValues
      } = leagueUpdate;
      const { Item } = await updateItem(DB_TABLE_NAME, leagueQueryValues, leagueUpdateValues);
      if (Item) {
        const league: League = await hydrateLeagueS3Data(LeagueSchema.parse(Item), S3_BUCKET_NAME);
        return getResponse(200, JSON.stringify(league));
      }
      return getResponse(404, 'Not found');
    },
  };
  return crudHandler(event, LeagueSchema, methodHandlers);
};
