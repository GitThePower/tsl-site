import * as assert from 'node:assert/strict';
import { after, afterEach, beforeEach, describe, it, mock } from 'node:test';
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
    mock.restoreAll();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  after(() => {
    process.env = originalEnv;
  });

  it('normalizeCountsKey should add counts/ prefix if missing', () => {
    assert.equal(normalizeCountsKey('counts-123'), 'counts/counts-123');
    assert.equal(normalizeCountsKey('counts/counts-123'), 'counts/counts-123');
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

    assert.deepEqual(Object.keys(parsedCounts), [
      'Counterspell',
      'Dark Ritual',
      'Lightning Bolt',
    ]);
    assert.equal(parsedCounts['Counterspell'].quantity, 2);
    assert.equal(parsedCounts['Counterspell'].mainboardQuantity, 2);
    assert.equal(parsedCounts['Dark Ritual'].quantity, 4);
    assert.equal(parsedCounts['Dark Ritual'].mainboardQuantity, 4);
    assert.equal(parsedCounts['Lightning Bolt'].quantity, 4);
    assert.equal(parsedCounts['Lightning Bolt'].mainboardQuantity, 3);
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

    mock.method(s3Utils, 'getObject', async () => ({
      Body: {
        transformToString: async () => JSON.stringify(mockPool),
      } as any,
      Metadata: {
        cardcountskey: 'counts/counts-uuid',
        hassyncfailure: 'false',
        leaguename: 'Season 1',
      },
    }) as any);

    const putSpy = mock.method(s3Utils, 'putObject', async () => ({} as any));
    const updateItemSpy = mock.method(ddbUtils, 'updateItem', async () => ({} as any));

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

    assert.equal(putSpy.mock.callCount(), 1);
    assert.deepEqual(putSpy.mock.calls[0].arguments[0], {
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

    assert.deepEqual(updateItemSpy.mock.calls[0].arguments, [
      'test-league-table',
      { leaguename: 'Season 1' },
      { poolSyncError: false },
    ]);
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

    mock.method(s3Utils, 'getObject', async () => ({
      Body: {
        transformToString: async () => JSON.stringify(mockPool),
      } as any,
      Metadata: {},
    }) as any);

    mock.method(ddbUtils, 'listItems', async () => ({
      Items: [
        {
          cardCountsKey: 'fallback-counts-key',
          cardPoolKey: 'pools/legacy-pool-key',
          isActive: true,
          leaguename: 'Legacy Season',
          poolSyncError: true,
        },
      ],
    }) as any);

    const putSpy = mock.method(s3Utils, 'putObject', async () => ({} as any));
    const updateItemSpy = mock.method(ddbUtils, 'updateItem', async () => ({} as any));

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

    assert.deepEqual(putSpy.mock.calls[0].arguments[0], {
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

    assert.deepEqual(updateItemSpy.mock.calls[0].arguments, [
      'test-league-table',
      { leaguename: 'Legacy Season' },
      { poolSyncError: true },
    ]);
  });
});
