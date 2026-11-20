import * as assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import {
  buildGatewayUrl,
  formatCardCounts,
  formatCardPool,
  getMoxfieldContent,
  handler,
  parseGatewayCredentials,
} from '../src/jobs/fillPools';
import {
  GatewayProvider,
  LeagueSchema,
  MagicCardCountsSchema,
  MoxfieldPool,
} from '../src/types';
import * as ddbUtils from '../src/utils/ddb';
import * as s3Utils from '../src/utils/s3';

describe('fillPools and LeagueSchema', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    mock.restoreAll();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
    mock.restoreAll();
  });

  it('LeagueSchema should validate objects with cardCounts, cardCountsKey, and poolSyncError', () => {
    const validLeague = {
      cardCounts: {
        'Lightning Bolt': {
          mana_cost: '{R}',
          name: 'Lightning Bolt',
          quantity: 4,
          scryfall_id: '1234',
        },
      },
      cardCountsKey: 'counts-uuid',
      cardPool: {
        user1: {
          cardList: {
            'Lightning Bolt': {
              mana_cost: '{R}',
              name: 'Lightning Bolt',
              quantity: 4,
              scryfall_id: '1234',
            },
          },
          decklistUrl: 'https://moxfield.com/decks/abc',
        },
      },
      cardPoolKey: 'pool-uuid',
      isActive: true,
      leaguename: 'Season 1',
      poolSyncError: true,
    };

    const parsed = LeagueSchema.parse(validLeague);
    assert.equal(parsed.leaguename, 'Season 1');
    assert.equal(parsed.cardCountsKey, 'counts-uuid');
    assert.equal(parsed.cardCounts?.['Lightning Bolt'].quantity, 4);
    assert.equal(parsed.poolSyncError, true);
  });

  it('buildGatewayUrl should construct URLs for scraperapi, scrapedo, scrapingant, and scrapingbee', () => {
    const target = 'https://api2.moxfield.com/v3/decks/all/abc123';
    const encoded = encodeURIComponent(target);

    assert.equal(
      buildGatewayUrl(target, 'key1', 'scraperapi'),
      `https://api.scraperapi.com?api_key=key1&url=${encoded}`,
    );
    assert.equal(
      buildGatewayUrl(target, 'key2', 'scrapedo'),
      `https://api.scrape.do?token=key2&url=${encoded}`,
    );
    assert.equal(
      buildGatewayUrl(target, 'key3', 'scrapingant'),
      `https://api.scrapingant.com/v2/general?url=${encoded}&x-api-key=key3&browser=false`,
    );
    assert.equal(
      buildGatewayUrl(target, 'key4', 'scrapingbee'),
      `https://app.scrapingbee.com/api/v1/?api_key=key4&url=${encoded}&render_js=false`,
    );
  });

  it('parseGatewayCredentials should parse JSON provider keys in failover order and throw on non-JSON input', () => {
    const jsonSecret = JSON.stringify({
      scrapedo: 'do-key',
      scraperapi: 'sa-key',
      scrapingant: 'ant-key',
      scrapingbee: 'bee-key',
    });

    assert.deepEqual(parseGatewayCredentials(jsonSecret), [
      { apiKey: 'sa-key', provider: 'scraperapi' },
      { apiKey: 'do-key', provider: 'scrapedo' },
      { apiKey: 'ant-key', provider: 'scrapingant' },
      { apiKey: 'bee-key', provider: 'scrapingbee' },
    ]);

    assert.throws(() => parseGatewayCredentials('not-json'));
    assert.deepEqual(parseGatewayCredentials(''), []);
  });

  it('getMoxfieldContent should immediately fail over on 403 and mark provider exhausted without retrying it', async () => {
    const mockDeckResponse = {
      boards: {
        mainboard: { cards: {}, count: 0 },
        maybeboard: { cards: {}, count: 0 },
        sideboard: { cards: {}, count: 0 },
      },
    };

    const fetchMock = mock.fn<typeof fetch>();
    fetchMock.mock.mockImplementationOnce(async () => ({
      ok: false,
      status: 403,
      text: async () => 'Out of credits',
    } as Response), 0);
    fetchMock.mock.mockImplementationOnce(async () => ({
      json: async () => mockDeckResponse,
      ok: true,
      status: 200,
    } as Response), 1);
    global.fetch = fetchMock;

    const exhaustedProviders = new Set<GatewayProvider>();
    const credentials = [
      { apiKey: 'sa-key', provider: 'scraperapi' as const },
      { apiKey: 'do-key', provider: 'scrapedo' as const },
    ];

    const result = await getMoxfieldContent('https://moxfield.com/decks/testDeckId', {
      credentials,
      exhaustedProviders,
      retryDelayMs: 1,
    });

    assert.equal(result.boards.mainboard.count, 0);
    assert.equal(fetchMock.mock.callCount(), 2);
    assert.equal(new URL(String(fetchMock.mock.calls[0].arguments[0])).hostname, 'api.scraperapi.com');
    assert.equal(new URL(String(fetchMock.mock.calls[1].arguments[0])).hostname, 'api.scrape.do');
    assert.equal(exhaustedProviders.has('scraperapi'), true);
    assert.equal(exhaustedProviders.has('scrapedo'), false);
  });

  it('getMoxfieldContent should retry once on 429 before failing over to the next provider', async () => {
    const mockDeckResponse = {
      boards: {
        mainboard: { cards: {}, count: 0 },
        maybeboard: { cards: {}, count: 0 },
        sideboard: { cards: {}, count: 0 },
      },
    };

    const fetchMock = mock.fn<typeof fetch>();
    fetchMock.mock.mockImplementationOnce(async () => ({
      ok: false,
      status: 429,
      text: async () => 'Rate limit',
    } as Response), 0);
    fetchMock.mock.mockImplementationOnce(async () => ({
      ok: false,
      status: 429,
      text: async () => 'Rate limit again',
    } as Response), 1);
    fetchMock.mock.mockImplementationOnce(async () => ({
      json: async () => mockDeckResponse,
      ok: true,
      status: 200,
    } as Response), 2);
    global.fetch = fetchMock;

    const credentials = [
      { apiKey: 'sa-key', provider: 'scraperapi' as const },
      { apiKey: 'ant-key', provider: 'scrapingant' as const },
    ];

    const result = await getMoxfieldContent('https://moxfield.com/decks/testDeckId', {
      credentials,
      maxRetries: 2,
      retryDelayMs: 1,
    });

    assert.equal(result.boards.mainboard.count, 0);
    assert.equal(fetchMock.mock.callCount(), 3);
    assert.equal(new URL(String(fetchMock.mock.calls[0].arguments[0])).hostname, 'api.scraperapi.com');
    assert.equal(new URL(String(fetchMock.mock.calls[1].arguments[0])).hostname, 'api.scraperapi.com');
    assert.equal(new URL(String(fetchMock.mock.calls[2].arguments[0])).hostname, 'api.scrapingant.com');
  });

  it('getMoxfieldContent should parse cards with omitted mana_cost and optional card_faces', async () => {
    const mockDeckResponse = {
      boards: {
        mainboard: {
          cards: {
            dfc1: {
              card: {
                card_faces: [
                  { colors: ['B'], mana_cost: '{1}{B}' },
                  { colors: ['B'], mana_cost: '' },
                ],
                cmc: 2,
                colors: [],
                name: 'Valakut Awakening // Valakut Stoneforge',
                scryfall_id: 'dfc-id',
                set_name: 'ZNR',
              },
              quantity: 1,
            },
            land1: {
              card: {
                colors: [],
                name: 'Command Tower',
              },
              quantity: 1,
            },
          },
          count: 2,
        },
        maybeboard: { cards: {}, count: 0 },
        sideboard: { cards: {}, count: 0 },
      },
    };

    const fetchMock = mock.fn<typeof fetch>(async () => ({
      json: async () => mockDeckResponse,
      ok: true,
      status: 200,
    } as Response));
    global.fetch = fetchMock;

    const result = await getMoxfieldContent('https://moxfield.com/decks/testDeckId', {
      credentials: [{ apiKey: 'sa-key', provider: 'scraperapi' }],
      retryDelayMs: 1,
    });

    assert.equal(result.boards.mainboard.cards.land1.card.mana_cost, undefined);
    assert.equal(result.boards.mainboard.cards.dfc1.card.card_faces?.length, 2);
  });

  it('getMoxfieldContent should fail fast on ZodError without retrying or failing over', async () => {
    const fetchMock = mock.fn<typeof fetch>(async () => ({
      json: async () => ({ unexpected: 'shape' }),
      ok: true,
      status: 200,
    } as Response));
    global.fetch = fetchMock;

    await assert.rejects(
      getMoxfieldContent('https://moxfield.com/decks/testDeckId', {
        credentials: [
          { apiKey: 'sa-key', provider: 'scraperapi' },
          { apiKey: 'do-key', provider: 'scrapedo' },
        ],
        maxRetries: 2,
        retryDelayMs: 1,
      }),
    );

    assert.equal(fetchMock.mock.callCount(), 1);
  });

  it('formatCardPool should ignore basic lands and combine quantities within boards', () => {
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
                    colors: ['R'],
                    mana_cost: '{R}',
                    name: 'Lightning Bolt',
                    scryfall_id: 'bolt-id',
                    set_name: 'Alpha',
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
                    colors: ['R'],
                    mana_cost: '{R}',
                    name: 'Lightning Bolt',
                    scryfall_id: 'bolt-id',
                    set_name: 'Alpha',
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
    assert.notEqual(pool.user1.cardList['Lightning Bolt'], undefined);
    assert.equal(pool.user1.cardList['Lightning Bolt'].quantity, 4);
    assert.equal(pool.user1.cardList['Lightning Bolt'].mainboardQuantity, 3);
    assert.deepEqual(pool.user1.colors, ['R']);
  });

  it('formatCardCounts should aggregate card quantities across all users and sort alphabetically', () => {
    const mockCardPool = {
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

  it('handler should fetch decklists and write raw envelope to S3', async () => {
    process.env = {
      ...originalEnv,
      GATEWAY_PROVIDER: 'scraperapi',
      LEAGUE_BUCKET_NAME: 'test-league-bucket',
      LEAGUE_TABLE_NAME: 'test-league-table',
      REQUEST_DELAY_MS: '0',
      USER_TABLE_NAME: 'test-user-table',
    };

    mock.method(ddbUtils, 'listItems', async (tableName: string) => {
      if (tableName === 'test-league-table') {
        return {
          Items: [
            {
              cardCountsKey: 'counts-uuid-1',
              cardPoolKey: 'pool-uuid-1',
              isActive: true,
              leaguename: 'Season 1',
            },
            {
              cardCountsKey: 'counts-uuid-2',
              cardPoolKey: 'pool-uuid-2',
              isActive: false,
              leaguename: 'Inactive Season',
            },
          ],
        } as any;
      }
      return {
        Items: [
          {
            leagues: [
              {
                decklistUrl: 'https://moxfield.com/decks/testDeck',
                leaguename: 'Season 1',
              },
            ],
            username: 'testUser',
          },
        ],
      } as any;
    });

    global.fetch = mock.fn<typeof fetch>(async () => ({
      json: async () => ({
        boards: {
          mainboard: { cards: {}, count: 0 },
          maybeboard: { cards: {}, count: 0 },
          sideboard: { cards: {}, count: 0 },
        },
      }),
      ok: true,
      status: 200,
    } as Response));

    const putSpy = mock.method(s3Utils, 'putObject', async () => ({} as any));

    await handler();

    assert.equal(putSpy.mock.callCount(), 1);
    const putCall = putSpy.mock.calls[0].arguments[0];
    if (!putCall) {
      assert.fail('Expected putObject to be called with input');
    }
    assert.equal(putCall.Bucket, 'test-league-bucket');
    assert.equal(putCall.Key, 'raw/Season 1.json');
    assert.deepEqual(JSON.parse(putCall.Body as string), {
      cardCountsKey: 'counts-uuid-1',
      cardPoolKey: 'pool-uuid-1',
      hasSyncFailure: false,
      leaguename: 'Season 1',
      pool: {
        testUser: {
          decklistUrl: 'https://moxfield.com/decks/testDeck',
          moxfieldContent: {
            boards: {
              mainboard: { cards: {}, count: 0 },
              maybeboard: { cards: {}, count: 0 },
              sideboard: { cards: {}, count: 0 },
            },
          },
        },
      },
    });
  });

  it('handler should mark poolSyncError in DynamoDB if S3 putObject fails', async () => {
    process.env = {
      ...originalEnv,
      GATEWAY_PROVIDER: 'scraperapi',
      LEAGUE_BUCKET_NAME: 'test-league-bucket',
      LEAGUE_TABLE_NAME: 'test-league-table',
      REQUEST_DELAY_MS: '0',
      USER_TABLE_NAME: 'test-user-table',
    };

    mock.method(ddbUtils, 'listItems', async (tableName: string) => {
      if (tableName === 'test-league-table') {
        return {
          Items: [
            {
              cardCountsKey: 'counts-uuid-1',
              cardPoolKey: 'pool-uuid-1',
              isActive: true,
              leaguename: 'Failing S3 Season',
            },
          ],
        } as any;
      }
      return { Items: [] } as any;
    });

    mock.method(s3Utils, 'putObject', async () => {
      throw new Error('S3 network error');
    });
    const updateItemSpy = mock.method(ddbUtils, 'updateItem', async () => ({} as any));

    await handler();

    assert.deepEqual(updateItemSpy.mock.calls[0].arguments, [
      'test-league-table',
      { leaguename: 'Failing S3 Season' },
      { poolSyncError: true },
    ]);
  });
});
