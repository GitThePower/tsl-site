import {
  buildGatewayUrl,
  formatCardCounts,
  formatCardPool,
  getMoxfieldContent,
  parseGatewayCredentials,
} from '../src/jobs/fillPools';
import {
  GatewayProvider,
  LeagueSchema,
  MagicCardCountsSchema,
  MoxfieldPool,
} from '../src/types';

describe('fillPools and LeagueSchema', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
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
    expect(parsed.leaguename).toBe('Season 1');
    expect(parsed.cardCountsKey).toBe('counts-uuid');
    expect(parsed.cardCounts?.['Lightning Bolt'].quantity).toBe(4);
    expect(parsed.poolSyncError).toBe(true);
  });

  it('buildGatewayUrl should construct URLs for scraperapi, scrapedo, scrapingant, and scrapingbee', () => {
    const target = 'https://api2.moxfield.com/v3/decks/all/abc123';
    const encoded = encodeURIComponent(target);

    expect(buildGatewayUrl(target, 'key1', 'scraperapi')).toBe(
      `https://api.scraperapi.com?api_key=key1&url=${encoded}`,
    );
    expect(buildGatewayUrl(target, 'key2', 'scrapedo')).toBe(
      `https://api.scrape.do?token=key2&url=${encoded}`,
    );
    expect(buildGatewayUrl(target, 'key3', 'scrapingant')).toBe(
      `https://api.scrapingant.com/v2/general?url=${encoded}&x-api-key=key3&browser=false`,
    );
    expect(buildGatewayUrl(target, 'key4', 'scrapingbee')).toBe(
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

    expect(parseGatewayCredentials(jsonSecret)).toEqual([
      { apiKey: 'sa-key', provider: 'scraperapi' },
      { apiKey: 'do-key', provider: 'scrapedo' },
      { apiKey: 'ant-key', provider: 'scrapingant' },
      { apiKey: 'bee-key', provider: 'scrapingbee' },
    ]);

    expect(() => parseGatewayCredentials('not-json')).toThrow();
    expect(parseGatewayCredentials('')).toEqual([]);
  });

  it('getMoxfieldContent should immediately fail over on 403 and mark provider exhausted without retrying it', async () => {
    const mockDeckResponse = {
      boards: {
        mainboard: { cards: {}, count: 0 },
        maybeboard: { cards: {}, count: 0 },
        sideboard: { cards: {}, count: 0 },
      },
    };

    const fetchMock = jest.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => 'Out of credits',
      })
      .mockResolvedValueOnce({
        json: async () => mockDeckResponse,
        ok: true,
        status: 200,
      });
    global.fetch = fetchMock as unknown as typeof fetch;

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

    expect(result.boards.mainboard.count).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('api.scraperapi.com');
    expect(fetchMock.mock.calls[1][0]).toContain('api.scrape.do');
    expect(exhaustedProviders.has('scraperapi')).toBe(true);
    expect(exhaustedProviders.has('scrapedo')).toBe(false);
  });

  it('getMoxfieldContent should retry once on 429 before failing over to the next provider', async () => {
    const mockDeckResponse = {
      boards: {
        mainboard: { cards: {}, count: 0 },
        maybeboard: { cards: {}, count: 0 },
        sideboard: { cards: {}, count: 0 },
      },
    };

    const fetchMock = jest.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limit',
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limit again',
      })
      .mockResolvedValueOnce({
        json: async () => mockDeckResponse,
        ok: true,
        status: 200,
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    const credentials = [
      { apiKey: 'sa-key', provider: 'scraperapi' as const },
      { apiKey: 'ant-key', provider: 'scrapingant' as const },
    ];

    const result = await getMoxfieldContent('https://moxfield.com/decks/testDeckId', {
      credentials,
      maxRetries: 2,
      retryDelayMs: 1,
    });

    expect(result.boards.mainboard.count).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toContain('api.scraperapi.com');
    expect(fetchMock.mock.calls[1][0]).toContain('api.scraperapi.com');
    expect(fetchMock.mock.calls[2][0]).toContain('api.scrapingant.com');
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
    expect(pool.user1.cardList['Mountain']).toBeUndefined();
    expect(pool.user1.cardList['Lightning Bolt']).toBeDefined();
    expect(pool.user1.cardList['Lightning Bolt'].quantity).toBe(4);
    expect(pool.user1.cardList['Lightning Bolt'].mainboardQuantity).toBe(3);
    expect(pool.user1.colors).toEqual(['R']);
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
});
