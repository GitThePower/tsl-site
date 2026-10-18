import { S3Event } from 'aws-lambda';
import {
  formatCardCounts,
  handler,
  normalizeCountsKey,
} from '../src/jobs/processCardCounts';
import { MagicCardCountsSchema, MagicCardPool } from '../src/types';
import * as ddbUtils from '../src/utils/ddb';
import * as s3Utils from '../src/utils/s3';

describe('processCardCounts job', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      LEAGUE_BUCKET_NAME: 'test-league-bucket',
      LEAGUE_TABLE_NAME: 'test-league-table',
    };
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('normalizeCountsKey should add counts/ prefix if missing', () => {
    expect(normalizeCountsKey('counts-123')).toBe('counts/counts-123');
    expect(normalizeCountsKey('counts/counts-123')).toBe('counts/counts-123');
  });

  it('formatCardCounts should aggregate card quantities across all users and sort alphabetically', () => {
    const mockCardPool: Record<string, MagicCardPool> = {
      alice: {
        cardList: {
          'Counterspell': {
            mainboardQuantity: 2,
            mana_cost: '{U}{U}',
            name: 'Counterspell',
            quantity: 2,
            scryfall_id: 'cs-id',
          },
          'Lightning Bolt': {
            mainboardQuantity: 2,
            mana_cost: '{R}',
            name: 'Lightning Bolt',
            quantity: 3,
            scryfall_id: 'bolt-id',
          },
        },
        decklistUrl: 'https://moxfield.com/decks/alice',
      },
      bob: {
        cardList: {
          'Dark Ritual': {
            mainboardQuantity: 4,
            mana_cost: '{B}',
            name: 'Dark Ritual',
            quantity: 4,
            scryfall_id: 'ritual-id',
          },
          'Lightning Bolt': {
            mainboardQuantity: 1,
            mana_cost: '{R}',
            name: 'Lightning Bolt',
            quantity: 1,
            scryfall_id: 'bolt-id',
          },
        },
        decklistUrl: 'https://moxfield.com/decks/bob',
      },
    };

    const counts = formatCardCounts(mockCardPool);
    const parsedCounts = MagicCardCountsSchema.parse(counts);

    expect(Object.keys(parsedCounts)).toEqual([
      'Counterspell',
      'Dark Ritual',
      'Lightning Bolt',
    ]);
    expect(parsedCounts['Counterspell'].quantity).toBe(2);
    expect(parsedCounts['Counterspell'].mainboardQuantity).toBe(2);
    expect(parsedCounts['Dark Ritual'].quantity).toBe(4);
    expect(parsedCounts['Dark Ritual'].mainboardQuantity).toBe(4);
    expect(parsedCounts['Lightning Bolt'].quantity).toBe(4);
    expect(parsedCounts['Lightning Bolt'].mainboardQuantity).toBe(3);
  });

  it('handler should read pool from S3, aggregate counts, write to S3, and update DynamoDB', async () => {
    const mockPool: Record<string, MagicCardPool> = {
      player1: {
        cardList: {
          'Opt': {
            mainboardQuantity: 4,
            mana_cost: '{U}',
            name: 'Opt',
            quantity: 4,
            scryfall_id: 'opt-id',
          },
        },
        decklistUrl: 'https://moxfield.com/decks/p1',
      },
    };

    jest.spyOn(s3Utils, 'getObject').mockResolvedValue({
      Body: {
        transformToString: async () => JSON.stringify(mockPool),
      } as any,
      Metadata: {
        cardcountskey: 'counts/counts-uuid',
        hassyncfailure: 'false',
        leaguename: 'Season 1',
      },
    } as any);

    const putSpy = jest.spyOn(s3Utils, 'putObject').mockResolvedValue({} as any);
    const updateItemSpy = jest.spyOn(ddbUtils, 'updateItem').mockResolvedValue({} as any);

    const event: S3Event = {
      Records: [
        {
          s3: {
            bucket: { name: 'test-league-bucket' },
            object: { key: 'pools/pool-uuid' },
          },
        } as any,
      ],
    };

    await handler(event);

    expect(putSpy).toHaveBeenCalledTimes(1);
    expect(putSpy).toHaveBeenCalledWith({
      Body: JSON.stringify({
        'Opt': {
          mainboardQuantity: 4,
          mana_cost: '{U}',
          name: 'Opt',
          quantity: 4,
          scryfall_id: 'opt-id',
        },
      }),
      Bucket: 'test-league-bucket',
      Key: 'counts/counts-uuid',
    });

    expect(updateItemSpy).toHaveBeenCalledWith(
      'test-league-table',
      { leaguename: 'Season 1' },
      { poolSyncError: false },
    );
  });

  it('handler should fall back to DynamoDB lookup if S3 object metadata is missing', async () => {
    const mockPool: Record<string, MagicCardPool> = {
      player1: {
        cardList: {
          'Ponder': {
            mainboardQuantity: 4,
            mana_cost: '{U}',
            name: 'Ponder',
            quantity: 4,
          },
        },
        decklistUrl: 'https://moxfield.com/decks/p1',
      },
    };

    jest.spyOn(s3Utils, 'getObject').mockResolvedValue({
      Body: {
        transformToString: async () => JSON.stringify(mockPool),
      } as any,
      Metadata: {},
    } as any);

    jest.spyOn(ddbUtils, 'listItems').mockResolvedValue({
      Items: [
        {
          cardCountsKey: 'fallback-counts-key',
          cardPoolKey: 'pools/legacy-pool-key',
          isActive: true,
          leaguename: 'Legacy Season',
          poolSyncError: true,
        },
      ],
    } as any);

    const putSpy = jest.spyOn(s3Utils, 'putObject').mockResolvedValue({} as any);
    const updateItemSpy = jest.spyOn(ddbUtils, 'updateItem').mockResolvedValue({} as any);

    const event: S3Event = {
      Records: [
        {
          s3: {
            bucket: { name: 'test-league-bucket' },
            object: { key: 'pools/legacy-pool-key' },
          },
        } as any,
      ],
    };

    await handler(event);

    expect(putSpy).toHaveBeenCalledWith({
      Body: JSON.stringify({
        'Ponder': {
          mainboardQuantity: 4,
          mana_cost: '{U}',
          name: 'Ponder',
          quantity: 4,
        },
      }),
      Bucket: 'test-league-bucket',
      Key: 'counts/fallback-counts-key',
    });

    expect(updateItemSpy).toHaveBeenCalledWith(
      'test-league-table',
      { leaguename: 'Legacy Season' },
      { poolSyncError: true },
    );
  });
});
