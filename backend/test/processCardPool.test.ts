import * as assert from 'node:assert/strict';
import { after, afterEach, beforeEach, describe, it, mock } from 'node:test';
import { S3Event } from 'aws-lambda';
import {
  formatCardPool,
  handler,
  normalizeCardPoolKey,
  normalizeCountsKey,
  normalizePoolKey,
} from '../src/jobs/processCardPool';
import { MoxfieldPool, RawPoolEnvelope } from '../src/types';
import * as ddbUtils from '../src/utils/ddb';
import * as s3Utils from '../src/utils/s3';

describe('processCardPool job', () => {
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

  it('normalizePoolKey, normalizeCardPoolKey, and normalizeCountsKey should format prefixes correctly', () => {
    assert.equal(normalizeCardPoolKey('uuid-123'), 'card-pools/uuid-123');
    assert.equal(normalizeCardPoolKey('pools/uuid-123'), 'card-pools/uuid-123');
    assert.equal(normalizeCardPoolKey('card-pools/uuid-123'), 'card-pools/uuid-123');
    assert.equal(normalizePoolKey('uuid-123'), 'pools/uuid-123');
    assert.equal(normalizePoolKey('pools/uuid-123'), 'pools/uuid-123');
    assert.equal(normalizeCountsKey('uuid-456'), 'counts/uuid-456');
    assert.equal(normalizeCountsKey('counts/uuid-456'), 'counts/uuid-456');
  });

  it('formatCardPool should ignore basic lands, combine quantities, and order colors by WUBRG', () => {
    const mockMoxfieldPool: MoxfieldPool = {
      user1: {
        decklistUrl: 'https://moxfield.com/decks/test',
        moxfieldContent: {
          boards: {
            mainboard: {
              cards: {
                c1: {
                  card: {
                    cmc: 1,
                    colors: ['R', 'W'],
                    mana_cost: '{R}{W}',
                    name: 'Lightning Helix',
                    scryfall_id: 'helix-id',
                    set_name: 'Ravnica',
                  },
                  quantity: 3,
                },
                c2: {
                  card: {
                    cmc: 0,
                    colors: [],
                    mana_cost: '',
                    name: 'Mountain',
                    set_name: 'Alpha',
                  },
                  quantity: 10,
                },
              },
              count: 13,
            },
            maybeboard: {
              cards: {},
              count: 0,
            },
            sideboard: {
              cards: {
                c3: {
                  card: {
                    cmc: 1,
                    colors: ['R', 'W'],
                    mana_cost: '{R}{W}',
                    name: 'Lightning Helix',
                    scryfall_id: 'helix-id',
                    set_name: 'Ravnica',
                  },
                  quantity: 1,
                },
              },
              count: 1,
            },
          },
        },
      },
    };

    const pool = formatCardPool(mockMoxfieldPool);
    assert.equal(pool.user1.cardList['Mountain'], undefined);
    assert.notEqual(pool.user1.cardList['Lightning Helix'], undefined);
    assert.equal(pool.user1.cardList['Lightning Helix'].quantity, 4);
    assert.equal(pool.user1.cardList['Lightning Helix'].mainboardQuantity, 3);
    assert.deepEqual(pool.user1.colors, ['W', 'R']);
  });

  it('formatCardPool should fall back to card_faces and empty mana_cost when top-level mana_cost or colors are omitted', () => {
    const mockMoxfieldPool: MoxfieldPool = {
      user1: {
        decklistUrl: 'https://moxfield.com/decks/dfc-test',
        moxfieldContent: {
          boards: {
            mainboard: {
              cards: {
                dfcTransform: {
                  card: {
                    card_faces: [
                      { colors: ['U'], mana_cost: '{1}{U}' },
                      { colors: ['U'], mana_cost: '' },
                    ],
                    colors: [],
                    name: 'Delver of Secrets // Insectile Aberration',
                    scryfall_id: null,
                  },
                  quantity: 2,
                },
                mdfcDual: {
                  card: {
                    card_faces: [
                      { colors: ['R'], mana_cost: '{2}{R}' },
                      { colors: ['W'], mana_cost: '{1}{W}' },
                    ],
                    name: 'Shatterskull Smashing // Shatterskull, the Hammer Pass',
                  },
                  quantity: 1,
                },
                nonBasicLand: {
                  card: {
                    colors: [],
                    name: 'Command Tower',
                  },
                  quantity: 1,
                },
              },
              count: 4,
            },
            maybeboard: { cards: {}, count: 0 },
            sideboard: { cards: {}, count: 0 },
          },
        },
      },
    };

    const pool = formatCardPool(mockMoxfieldPool);
    assert.deepEqual(pool.user1.cardList['Delver of Secrets // Insectile Aberration'], {
      colors: ['U'],
      mainboardQuantity: 2,
      mana_cost: '{1}{U}',
      name: 'Delver of Secrets // Insectile Aberration',
      quantity: 2,
      scryfall_id: undefined,
    });
    assert.deepEqual(pool.user1.cardList['Shatterskull Smashing // Shatterskull, the Hammer Pass'], {
      colors: ['W', 'R'],
      mainboardQuantity: 1,
      mana_cost: '{2}{R} // {1}{W}',
      name: 'Shatterskull Smashing // Shatterskull, the Hammer Pass',
      quantity: 1,
      scryfall_id: undefined,
    });
    assert.deepEqual(pool.user1.cardList['Command Tower'], {
      colors: [],
      mainboardQuantity: 1,
      mana_cost: '',
      name: 'Command Tower',
      quantity: 1,
      scryfall_id: undefined,
    });
    assert.deepEqual(pool.user1.colors, ['W', 'U', 'R']);
  });

  it('handler should read raw envelope from S3, format pool, and write to S3 with metadata', async () => {
    const rawEnvelope: RawPoolEnvelope = {
      cardCountsKey: 'counts-uuid',
      cardPoolKey: 'pool-uuid',
      hasSyncFailure: false,
      leaguename: 'Season 1',
      pool: {
        player1: {
          decklistUrl: 'https://moxfield.com/decks/p1',
          moxfieldContent: {
            boards: {
              mainboard: {
                cards: {
                  c1: {
                    card: {
                      cmc: 1,
                      colors: ['R'],
                      mana_cost: '{R}',
                      name: 'Shock',
                      scryfall_id: 'shock-id',
                      set_name: 'M21',
                    },
                    quantity: 2,
                  },
                },
                count: 2,
              },
              maybeboard: { cards: {}, count: 0 },
              sideboard: { cards: {}, count: 0 },
            },
          },
        },
      },
    };

    mock.method(s3Utils, 'getObject', async () => ({
      Body: {
        transformToString: async () => JSON.stringify(rawEnvelope),
      } as any,
    }) as any);

    const putSpy = mock.method(s3Utils, 'putObject', async () => ({} as any));

    const event: S3Event = {
      Records: [
        {
          s3: {
            bucket: { name: 'test-league-bucket' },
            object: { key: 'raw/Season%201.json' },
          },
        } as any,
      ],
    };

    await handler(event);

    assert.equal(putSpy.mock.callCount(), 1);
    const putCall = putSpy.mock.calls[0].arguments[0];
    if (!putCall) {
      assert.fail('Expected putObject to be called with input');
    }
    assert.equal(putCall.Bucket, 'test-league-bucket');
    assert.equal(putCall.Key, 'card-pools/pool-uuid');
    assert.deepEqual(putCall.Metadata, {
      cardcountskey: 'counts/counts-uuid',
      cardpoolkey: 'pools/pool-uuid',
      hassyncfailure: 'false',
      leaguename: 'Season 1',
    });

    const parsedBody = JSON.parse(putCall.Body as string);
    assert.equal(parsedBody.player1.cardList['Shock'].quantity, 2);
    assert.deepEqual(parsedBody.player1.cardList['Shock'].colors, ['R']);
  });

  it('handler should update DynamoDB poolSyncError when processing fails', async () => {
    mock.method(s3Utils, 'getObject', async () => ({
      Body: {
        transformToString: async () => JSON.stringify({
          cardCountsKey: 'c-1',
          cardPoolKey: 'p-1',
          hasSyncFailure: false,
          leaguename: 'Failed Season',
          pool: 'invalid-pool',
        }),
      } as any,
    }) as any);

    const updateItemSpy = mock.method(ddbUtils, 'updateItem', async () => ({} as any));

    const event: S3Event = {
      Records: [
        {
          s3: {
            bucket: { name: 'test-league-bucket' },
            object: { key: 'raw/Failed%20Season.json' },
          },
        } as any,
      ],
    };

    await assert.rejects(handler(event));
    assert.deepEqual(updateItemSpy.mock.calls[0].arguments, [
      'test-league-table',
      { leaguename: 'Failed Season' },
      { poolSyncError: true },
    ]);
  });
});
