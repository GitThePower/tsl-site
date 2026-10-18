import { S3Event } from 'aws-lambda';
import {
  calculateDeckColors,
  handler,
  isLand,
  normalizeFinalPoolKey,
} from '../src/jobs/processDeckColors';
import { MagicCard, MagicCardPool } from '../src/types';
import * as ddbUtils from '../src/utils/ddb';
import * as s3Utils from '../src/utils/s3';

describe('processDeckColors job', () => {
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

  it('isLand should return true for empty mana costs and false otherwise', () => {
    expect(isLand({ mana_cost: '', name: 'Steam Vents', quantity: 1 } as MagicCard)).toBe(true);
    expect(isLand({ mana_cost: '   ', name: 'Command Tower', quantity: 1 } as MagicCard)).toBe(true);
    expect(isLand({ mana_cost: '{R}', name: 'Lightning Bolt', quantity: 1 } as MagicCard)).toBe(false);
    expect(isLand({ mana_cost: '{0}', name: 'Mox Diamond', quantity: 1 } as MagicCard)).toBe(false);
  });

  it('normalizeFinalPoolKey should ensure pools/ prefix', () => {
    expect(normalizeFinalPoolKey('uuid-123')).toBe('pools/uuid-123');
    expect(normalizeFinalPoolKey('card-pools/uuid-123')).toBe('pools/uuid-123');
    expect(normalizeFinalPoolKey('pools/uuid-123')).toBe('pools/uuid-123');
  });

  it('calculateDeckColors should exclude colors representing less than 10% of non-land mainboard cards', () => {
    const cardList: Record<string, MagicCard> = {
      // 10 Red cards (50% of 20)
      'Lightning Bolt': {
        colors: ['R'],
        mainboardQuantity: 4,
        mana_cost: '{R}',
        name: 'Lightning Bolt',
        quantity: 4,
      },
      'Monastery Swiftspear': {
        colors: ['R'],
        mainboardQuantity: 4,
        mana_cost: '{R}',
        name: 'Monastery Swiftspear',
        quantity: 4,
      },
      'Searing Spear': {
        colors: ['R'],
        mainboardQuantity: 2,
        mana_cost: '{1}{R}',
        name: 'Searing Spear',
        quantity: 2,
      },
      // 8 Green cards (40% of 20)
      'Llanowar Elves': {
        colors: ['G'],
        mainboardQuantity: 4,
        mana_cost: '{G}',
        name: 'Llanowar Elves',
        quantity: 4,
      },
      'Giant Growth': {
        colors: ['G'],
        mainboardQuantity: 4,
        mana_cost: '{G}',
        name: 'Giant Growth',
        quantity: 4,
      },
      // 1 Blue card (5% of 20 -> < 10% splash, must be excluded)
      'Opt': {
        colors: ['U'],
        mainboardQuantity: 1,
        mana_cost: '{U}',
        name: 'Opt',
        quantity: 1,
      },
      // 1 Black card (5% of 20 -> < 10% splash, must be excluded)
      'Dark Ritual': {
        colors: ['B'],
        mainboardQuantity: 1,
        mana_cost: '{B}',
        name: 'Dark Ritual',
        quantity: 1,
      },
      // Land (no mana cost -> must not be included in non-land total)
      'Command Tower': {
        colors: [],
        mainboardQuantity: 4,
        mana_cost: '',
        name: 'Command Tower',
        quantity: 4,
      },
      // Sideboard only card (mainboardQuantity 0 -> must not count)
      'Blue Elemental Blast': {
        colors: ['U'],
        mainboardQuantity: 0,
        mana_cost: '{U}',
        name: 'Blue Elemental Blast',
        quantity: 4,
      },
    };

    const colors = calculateDeckColors(cardList);
    expect(colors).toEqual(['R', 'G']);
  });

  it('calculateDeckColors should include a color at exactly 10% and handle multi-color cards', () => {
    const cardList: Record<string, MagicCard> = {
      // 8 Red cards
      'Shock': {
        colors: ['R'],
        mainboardQuantity: 8,
        mana_cost: '{R}',
        name: 'Shock',
        quantity: 8,
      },
      // 2 Azorius cards (2 out of 10 non-land cards = 20% for both W and U)
      'Dovin\'s Veto': {
        colors: ['W', 'U'],
        mainboardQuantity: 2,
        mana_cost: '{W}{U}',
        name: 'Dovin\'s Veto',
        quantity: 2,
      },
    };

    const colors = calculateDeckColors(cardList);
    // Ordered by WUBRG: W, U, R
    expect(colors).toEqual(['W', 'U', 'R']);
  });

  it('calculateDeckColors should return empty array for all-land decks', () => {
    const cardList: Record<string, MagicCard> = {
      'Sulfur Falls': {
        colors: [],
        mainboardQuantity: 4,
        mana_cost: '',
        name: 'Sulfur Falls',
        quantity: 4,
      },
    };

    expect(calculateDeckColors(cardList)).toEqual([]);
  });

  it('handler should read from card-pools, compute colors, and write to pools with metadata', async () => {
    const mockPool: Record<string, MagicCardPool> = {
      alice: {
        cardList: {
          'Opt': {
            colors: ['U'],
            mainboardQuantity: 10,
            mana_cost: '{U}',
            name: 'Opt',
            quantity: 10,
          },
          'Shock': {
            colors: ['R'],
            mainboardQuantity: 1,
            mana_cost: '{R}',
            name: 'Shock',
            quantity: 1,
          },
        },
        colors: ['U', 'R'],
        decklistUrl: 'https://moxfield.com/decks/alice',
      },
    };

    jest.spyOn(s3Utils, 'getObject').mockResolvedValue({
      Body: {
        transformToString: async () => JSON.stringify(mockPool),
      } as any,
      Metadata: {
        cardcountskey: 'counts/counts-uuid',
        cardpoolkey: 'pools/final-pool-uuid',
        hassyncfailure: 'false',
        leaguename: 'Season 1',
      },
    } as any);

    const putSpy = jest.spyOn(s3Utils, 'putObject').mockResolvedValue({} as any);

    const event: S3Event = {
      Records: [
        {
          s3: {
            bucket: { name: 'test-league-bucket' },
            object: { key: 'card-pools/final-pool-uuid' },
          },
        } as any,
      ],
    };

    await handler(event);

    expect(putSpy).toHaveBeenCalledTimes(1);
    const putCall = putSpy.mock.calls[0][0];
    expect(putCall.Bucket).toBe('test-league-bucket');
    expect(putCall.Key).toBe('pools/final-pool-uuid');
    expect(putCall.Metadata).toEqual({
      cardcountskey: 'counts/counts-uuid',
      hassyncfailure: 'false',
      leaguename: 'Season 1',
    });

    const parsedBody = JSON.parse(putCall.Body as string);
    // Shock was 1 out of 11 non-land cards (9.09% < 10%), so Red is excluded!
    expect(parsedBody.alice.colors).toEqual(['U']);
  });

  it('handler should update DynamoDB poolSyncError when an error occurs', async () => {
    jest.spyOn(s3Utils, 'getObject').mockResolvedValue({
      Body: {
        transformToString: async () => 'invalid-json',
      } as any,
      Metadata: {
        leaguename: 'Failing Colors Season',
      },
    } as any);

    const updateItemSpy = jest.spyOn(ddbUtils, 'updateItem').mockResolvedValue({} as any);

    const event: S3Event = {
      Records: [
        {
          s3: {
            bucket: { name: 'test-league-bucket' },
            object: { key: 'card-pools/failed-uuid' },
          },
        } as any,
      ],
    };

    await expect(handler(event)).rejects.toThrow();
    expect(updateItemSpy).toHaveBeenCalledWith(
      'test-league-table',
      { leaguename: 'Failing Colors Season' },
      { poolSyncError: true },
    );
  });
});
