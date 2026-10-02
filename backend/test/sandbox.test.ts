import { buildGatewayUrl, getMoxfieldContent } from '../src/jobs/fillPools';
import { MoxfieldContentSchema } from '../src/types';

describe('Moxfield Integration', () => {
  test('buildGatewayUrl correctly formats ScraperAPI and ScrapingBee URLs', () => {
    const target = 'https://api2.moxfield.com/v3/decks/all/test123';
    const scraperApiUrl = buildGatewayUrl(target, 'my-key', 'scraperapi');
    expect(scraperApiUrl).toBe(`https://api.scraperapi.com?api_key=my-key&url=${encodeURIComponent(target)}`);

    const scrapingBeeUrl = buildGatewayUrl(target, 'my-key', 'scrapingbee');
    expect(scrapingBeeUrl).toBe(`https://app.scrapingbee.com/api/v1/?api_key=my-key&url=${encodeURIComponent(target)}&render_js=false`);
  });

  test('validates sample Moxfield deck data with MoxfieldContentSchema', () => {
    const mockMoxfieldData = {
      boards: {
        mainboard: {
          count: 2,
          cards: {
            card1: {
              quantity: 1,
              card: {
                name: 'Sol Ring',
                mana_cost: '{1}',
                cmc: 1,
                colors: [],
                set_name: 'Commander',
                scryfall_id: 'e672d408-99e8-4842-8157-a18d7367731a',
              },
            },
            card2: {
              quantity: 1,
              card: {
                name: 'Counterspell',
                mana_cost: '{U}{U}',
                cmc: 2,
                colors: ['U'],
                set_name: 'Masters 25',
                scryfall_id: '11e8d2ee-aa3f-454e-ab6e-4e0b09efa217',
              },
            },
          },
        },
        sideboard: { count: 0, cards: {} },
        maybeboard: { count: 0, cards: {} },
      },
    };

    const parsed = MoxfieldContentSchema.parse(mockMoxfieldData);
    expect(parsed.boards.mainboard.count).toBe(2);
    expect(parsed.boards.mainboard.cards.card1.card.name).toBe('Sol Ring');
  });

  test('validates FillPoolsLambdaEnvSchema with REQUEST_DELAY_MS', () => {
    const { FillPoolsLambdaEnvSchema } = require('../src/types');
    const validEnv = {
      LEAGUE_BUCKET_NAME: 'test-bucket',
      LEAGUE_TABLE_NAME: 'test-league-table',
      USER_TABLE_NAME: 'test-user-table',
      GATEWAY_SECRET_NAME: 'test/secret',
      GATEWAY_PROVIDER: 'scraperapi',
      REQUEST_DELAY_MS: '2500',
    };
    const parsed = FillPoolsLambdaEnvSchema.parse(validEnv);
    expect(parsed.REQUEST_DELAY_MS).toBe('2500');
  });

  test('retries on 429 before succeeding', async () => {
    const mockMoxfieldData = {
      boards: {
        mainboard: { count: 0, cards: {} },
        sideboard: { count: 0, cards: {} },
        maybeboard: { count: 0, cards: {} },
      },
    };

    let callCount = 0;
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          status: 429,
          ok: false,
          text: async () => 'Too many requests',
        } as any;
      }
      return {
        status: 200,
        ok: true,
        json: async () => mockMoxfieldData,
      } as any;
    });

    try {
      const result = await getMoxfieldContent('https://www.moxfield.com/decks/test-id', {
        apiKey: 'dummy',
        maxRetries: 2,
        retryDelayMs: 10,
      });
      expect(callCount).toBe(2);
      expect(result.boards.mainboard).toBeDefined();
    } finally {
      global.fetch = originalFetch;
    }
  });

  // If SCRAPING_GATEWAY_API_KEY is provided in the environment, run a live integration check
  const apiKey = process.env.SCRAPING_GATEWAY_API_KEY;
  if (apiKey) {
    test('live gateway fetch from Moxfield', async () => {
      const id = 'xzs5-2PKSkyCVx_kQrgaiA';
      const content = await getMoxfieldContent(`https://www.moxfield.com/decks/${id}`, { apiKey });
      expect(content.boards.mainboard).toBeDefined();
      expect(Object.keys(content.boards.mainboard.cards).length).toBeGreaterThan(0);
    }, 30000);
  }
});
