import { APIGatewayProxyEvent } from 'aws-lambda';
import { v4 } from 'uuid';
import { z } from 'zod';
import {
  League,
  LeagueSchema,
  MoxfieldPool,
  MoxfieldPoolSchema,
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

export const handler = async (event: APIGatewayProxyEvent) => {
  const { DB_TABLE_NAME, S3_BUCKET_NAME } = ResourceLambdaEnvSchema.parse(process.env);
  const methodHandlers: MethodHandlers = {
    DeleteHandler: async (queryStringParameter: any) => {
      const { Item } = await deleteItem(DB_TABLE_NAME, queryStringParameter.data);
      if (Item) {
        let league = LeagueSchema.parse(Item);
        await deleteObject({
          Bucket: S3_BUCKET_NAME,
          Key: league.cardPoolKey,
        });
        const cardPool = {} as MoxfieldPool;
        league = { ...league, cardPool, cardPoolKey: '[ HIDDEN ]' }
        return getResponse(200, JSON.stringify(league));
      }
      return getResponse(404, 'Not found');
    },
    GetHandler: async (queryStringParameters: any) => {
      const { Item } = await getItem(DB_TABLE_NAME, queryStringParameters);
      if (Item) {
        let league: League = LeagueSchema.parse(Item);
        const { Body } = await getObject({
          Bucket: S3_BUCKET_NAME,
          Key: league.cardPoolKey,
        });
        const cardPoolString = z.string().parse(await Body?.transformToString());
        const cardPool = MoxfieldPoolSchema.parse(JSON.parse(cardPoolString));
        league = { ...league, cardPool, cardPoolKey: '[ HIDDEN ]' }
        return getResponse(200, JSON.stringify(league));
      }
      return getResponse(404, 'Not found');
    },
    ListHandler: async () => {
      const { Items } = await listItems(DB_TABLE_NAME);
      if (Items) {
        const leaguePromises = Items.map(async (Item) => {
          const league = LeagueSchema.parse(Item);
          const { Body } = await getObject({
            Bucket: S3_BUCKET_NAME,
            Key: league.cardPoolKey,
          });
          const cardPoolString = z.string().parse(await Body?.transformToString());
          const cardPool = MoxfieldPoolSchema.parse(JSON.parse(cardPoolString));
          return { ...league, cardPool, cardPoolKey: '[ HIDDEN ]' };
        });
        const leagues: League[] = await Promise.all(leaguePromises);
        return getResponse(200, JSON.stringify(leagues));
      }
      return getResponse(404, 'Not found');
    },
    PostHandler: async (body: any) => {
      const league = LeagueSchema.parse(body);
      if (!league.leaguename) throw new Error('New league must have a leaguename!');
      const { cardPool, ...leagueValues } = league;
      leagueValues.cardPoolKey = v4();
      await createItem(DB_TABLE_NAME, leagueValues);
      await putObject({
        Body: JSON.stringify({}),
        Bucket: S3_BUCKET_NAME,
        Key: leagueValues.cardPoolKey,
      })
      return getResponse(200, 'Successful Create!');
    },
    PutHandler: async (body: any, queryStringParameters: any) => {
      const leagueQuery = LeagueSchema.parse(queryStringParameters);
      const leagueUpdate = LeagueSchema.parse(body);
      const {
        cardPool: queryCardPool,
        cardPoolKey: queryCardPoolKey,
        ...leagueQueryValues
      } = leagueQuery;
      const {
        cardPool: updateCardPool,
        cardPoolKey: updateCardPoolKey,
        ...leagueUpdateValues
      } = leagueUpdate;
      const { Item } = await updateItem(DB_TABLE_NAME, leagueQueryValues, leagueUpdateValues);
      if (Item) {
        let league: League = LeagueSchema.parse(Item);
        const { Body } = await getObject({
          Bucket: S3_BUCKET_NAME,
          Key: league.cardPoolKey,
        });
        const cardPoolString = z.string().parse(await Body?.transformToString());
        const cardPool = MoxfieldPoolSchema.parse(JSON.parse(cardPoolString));
        league = { ...league, cardPool, cardPoolKey: '[ HIDDEN ]' }
        return getResponse(200, JSON.stringify(league));
      }
      return getResponse(404, 'Not found');
    },
  }
  return crudHandler(event, LeagueSchema, methodHandlers);
};
