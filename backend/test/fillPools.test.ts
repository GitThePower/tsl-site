import {
  formatCardCounts,
  formatCardPool,
} from '../src/jobs/fillPools';
import {
  LeagueSchema,
  MagicCardCountsSchema,
  MoxfieldPool,
} from '../src/types';

describe('fillPools and LeagueSchema', () => {
  it('LeagueSchema should validate objects with cardCounts and cardCountsKey', () => {
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
    };

    const parsed = LeagueSchema.parse(validLeague);
    expect(parsed.leaguename).toBe('Season 1');
    expect(parsed.cardCountsKey).toBe('counts-uuid');
    expect(parsed.cardCounts?.['Lightning Bolt'].quantity).toBe(4);
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
  });

  it('formatCardCounts should aggregate card quantities across all users and sort alphabetically', () => {
    const mockCardPool = {
      alice: {
        cardList: {
          'Counterspell': {
            mana_cost: '{U}{U}',
            name: 'Counterspell',
            quantity: 2,
            scryfall_id: 'cs-id',
          },
          'Lightning Bolt': {
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
            mana_cost: '{B}',
            name: 'Dark Ritual',
            quantity: 4,
            scryfall_id: 'ritual-id',
          },
          'Lightning Bolt': {
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
    expect(parsedCounts['Dark Ritual'].quantity).toBe(4);
    expect(parsedCounts['Lightning Bolt'].quantity).toBe(4);
  });
});
