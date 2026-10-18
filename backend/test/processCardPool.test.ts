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
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('normalizePoolKey, normalizeCardPoolKey, and normalizeCountsKey should format prefixes correctly', () => {
    expect(normalizeCardPoolKey('uuid-123')).toBe('card-pools/uuid-123');
    expect(normalizeCardPoolKey('pools/uuid-123')).toBe('card-pools/uuid-123');
    expect(normalizeCardPoolKey('card-pools/uuid-123')).toBe('card-pools/uuid-123');
    expect(normalizePoolKey('uuid-123')).toBe('pools/uuid-123');
    expect(normalizePoolKey('pools/uuid-123')).toBe('pools/uuid-123');
    expect(normalizeCountsKey('uuid-456')).toBe('counts/uuid-456');
    expect(normalizeCountsKey('counts/uuid-456')).toBe('counts/uuid-456');
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
    expect(pool.user1.cardList['Mountain']).toBeUndefined();
    expect(pool.user1.cardList['Lightning Helix']).toBeDefined();
    expect(pool.user1.cardList['Lightning Helix'].quantity).toBe(4);
    expect(pool.user1.cardList['Lightning Helix'].mainboardQuantity).toBe(3);
    expect(pool.user1.colors).toEqual(['W', 'R']);
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

    jest.spyOn(s3Utils, 'getObject').mockResolvedValue({
      Body: {
        transformToString: async () => JSON.stringify(rawEnvelope),
      } as any,
    } as any);

    const putSpy = jest.spyOn(s3Utils, 'putObject').mockResolvedValue({} as any);

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

    expect(putSpy).toHaveBeenCalledTimes(1);
    const putCall = putSpy.mock.calls[0][0];
    expect(putCall.Bucket).toBe('test-league-bucket');
    expect(putCall.Key).toBe('card-pools/pool-uuid');
    expect(putCall.Metadata).toEqual({
      cardcountskey: 'counts/counts-uuid',
      cardpoolkey: 'pools/pool-uuid',
      hassyncfailure: 'false',
      leaguename: 'Season 1',
    });

    const parsedBody = JSON.parse(putCall.Body as string);
    expect(parsedBody.player1.cardList['Shock'].quantity).toBe(2);
    expect(parsedBody.player1.cardList['Shock'].colors).toEqual(['R']);
  });

  it('handler should update DynamoDB poolSyncError when processing fails', async () => {
    jest.spyOn(s3Utils, 'getObject').mockResolvedValue({
      Body: {
        transformToString: async () => JSON.stringify({
          cardCountsKey: 'c-1',
          cardPoolKey: 'p-1',
          hasSyncFailure: false,
          leaguename: 'Failed Season',
          pool: 'invalid-pool',
        }),
      } as any,
    } as any);

    const updateItemSpy = jest.spyOn(ddbUtils, 'updateItem').mockResolvedValue({} as any);

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

    await expect(handler(event)).rejects.toThrow();
    expect(updateItemSpy).toHaveBeenCalledWith(
      'test-league-table',
      { leaguename: 'Failed Season' },
      { poolSyncError: true },
    );
  });
});
