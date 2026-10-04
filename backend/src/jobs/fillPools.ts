import { z } from 'zod';
import { listItems } from '../utils/ddb';
import {
  FillPoolsLambdaEnvSchema,
  LeagueSchema,
  MagicCard,
  MagicCardCounts,
  MagicCardPool,
  MoxfieldContent,
  MoxfieldContentSchema,
  MoxfieldPool,
  UserSchema,
} from '../../src/types';
import { putObject } from '../utils/s3';
import { getSecretValue } from '../utils/secrets';

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export interface FetchMoxfieldOptions {
  apiKey?: string;
  provider?: 'scraperapi' | 'scrapingbee';
  maxRetries?: number;
  retryDelayMs?: number;
}

export const buildGatewayUrl = (targetUrl: string, apiKey: string, provider: 'scraperapi' | 'scrapingbee' = 'scraperapi'): string => {
  if (provider === 'scrapingbee') {
    return `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(targetUrl)}&render_js=false`;
  }
  return `https://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(targetUrl)}`;
};

export const getMoxfieldContent = async (url: string, options?: FetchMoxfieldOptions): Promise<MoxfieldContent> => {
  const id = url.split('/')[4];
  const targetUrl = `https://api2.moxfield.com/v3/decks/all/${id}`;

  const apiKey = options?.apiKey ?? process.env.SCRAPING_GATEWAY_API_KEY;
  const provider = options?.provider ?? (process.env.GATEWAY_PROVIDER as 'scraperapi' | 'scrapingbee') ?? 'scraperapi';

  let fetchUrl = targetUrl;
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://www.moxfield.com/',
    'Origin': 'https://www.moxfield.com',
    'Accept': 'application/json, text/plain, */*',
  };

  if (apiKey) {
    fetchUrl = buildGatewayUrl(targetUrl, apiKey, provider);
  }

  const maxRetries = options?.maxRetries ?? 3;
  const baseRetryDelay = options?.retryDelayMs ?? 3000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await fetch(fetchUrl, { headers });
      if (result.status === 429) {
        const errText = await result.text().catch(() => '');
        if (attempt < maxRetries) {
          const delay = baseRetryDelay * attempt;
          console.warn(`[429 Rate Limited] Attempt ${attempt}/${maxRetries} for ${url}. Backing off for ${delay}ms before retrying. Gateway message: ${errText.slice(0, 150)}`);
          await sleep(delay);
          continue;
        }
        throw new Error(`Request to Get decklist from Moxfield failed with status 429: ${errText.slice(0, 200)}`);
      }
      if (!result.ok) {
        const errText = await result.text().catch(() => '');
        throw new Error(`Request to Get decklist from Moxfield failed with status ${result.status}: ${errText.slice(0, 200)}`);
      }
      return MoxfieldContentSchema.parse(await result.json());
    } catch (e) {
      if (attempt >= maxRetries) {
        throw new Error(e instanceof Error ? e.message : JSON.stringify(e));
      }
      console.warn(`Fetch error on attempt ${attempt}/${maxRetries} for ${url}: ${e instanceof Error ? e.message : e}. Retrying...`);
      await sleep(baseRetryDelay);
    }
  }

  throw new Error(`Failed to retrieve Moxfield content for ${url} after ${maxRetries} attempts`);
};

export const formatCardPool = (leaguePool: MoxfieldPool): Record<string, MagicCardPool> => {
  const searchResults: Record<string, MagicCardPool> = {};
  Object.keys(leaguePool).forEach((username) => {
    searchResults[username] = {} as MagicCardPool;
    const userCardList = {} as Record<string, MagicCard>;
    searchResults[username].decklistUrl = leaguePool[username].decklistUrl;
    Object.values(leaguePool[username].moxfieldContent.boards).forEach((board) => {
      Object.values(board.cards).forEach((card) => {
        const cardName = card.card.name;
        if (['Forest', 'Island', 'Mountain', 'Plains', 'Swamp'].includes(cardName)) {
          // Do not add basics to the pool
        } else if (cardName in userCardList) {
          userCardList[cardName].quantity += card.quantity;
        } else {
          userCardList[cardName] = {
            mana_cost: card.card.mana_cost,
            name: cardName,
            quantity: card.quantity,
            scryfall_id: card.card?.scryfall_id,
          };
        }
      });
    });
    searchResults[username].cardList = Object.keys(userCardList).sort().reduce(
      (sorted, key) => {
        sorted[key] = userCardList[key];
        return sorted;
      },
      {} as Record<string, MagicCard>,
    );
  });
  return Object.keys(searchResults).sort().reduce(
    (sorted, key) => {
      sorted[key] = searchResults[key];
      return sorted;
    },
    {} as Record<string, MagicCardPool>,
  );
};

export const formatCardCounts = (cardPool: Record<string, MagicCardPool>): MagicCardCounts => {
  const cardCounts: Record<string, MagicCard> = {};
  Object.values(cardPool).forEach((userPool) => {
    Object.values(userPool.cardList).forEach((card) => {
      if (card.name in cardCounts) {
        cardCounts[card.name].quantity += card.quantity;
      } else {
        cardCounts[card.name] = {
          mana_cost: card.mana_cost,
          name: card.name,
          quantity: card.quantity,
          scryfall_id: card.scryfall_id,
        };
      }
    });
  });
  return Object.keys(cardCounts).sort().reduce(
    (sorted, key) => {
      sorted[key] = cardCounts[key];
      return sorted;
    },
    {} as MagicCardCounts,
  );
};

export const handler = async (): Promise<void> => {
  const jobStartTime = Date.now();
  const DEFAULT_STAGGER_INTERVAL_MS = 2500;
  const {
    LEAGUE_BUCKET_NAME,
    LEAGUE_TABLE_NAME,
    USER_TABLE_NAME,
    GATEWAY_SECRET_NAME,
    GATEWAY_PROVIDER,
    REQUEST_DELAY_MS,
  } = FillPoolsLambdaEnvSchema.parse(process.env);
  const staggerIntervalMs = REQUEST_DELAY_MS ? parseInt(REQUEST_DELAY_MS, 10) : DEFAULT_STAGGER_INTERVAL_MS;

  let apiKey = process.env.SCRAPING_GATEWAY_API_KEY;
  if (!apiKey && GATEWAY_SECRET_NAME) {
    try {
      apiKey = await getSecretValue(GATEWAY_SECRET_NAME);
    } catch (e) {
      console.warn(`Could not load gateway secret ${GATEWAY_SECRET_NAME}: ${e instanceof Error ? e.message : e}`);
    }
  }

  const leagueTableScanStartTime = Date.now();
  const allLeagues = await listItems(LEAGUE_TABLE_NAME);
  const leagueTableScanDuration = Date.now() - leagueTableScanStartTime;

  const validatedLeagues = z.array(LeagueSchema).parse(allLeagues.Items);
  const activeLeagues = validatedLeagues.filter((league) => league.isActive && league.isActive === true);

  const userTableScanStartTime = Date.now();
  const usersList = await listItems(USER_TABLE_NAME);
  const userTableScanDuration = Date.now() - userTableScanStartTime;

  const validatedUsers = z.array(UserSchema).parse(usersList.Items);

  const fillPoolsStartTime = Date.now();
  for (const activeLeague of activeLeagues) {
    const leaguePool: MoxfieldPool = {};
    for (const user of validatedUsers) {
      const username = user.username ?? '';
      const userLeagues = user.leagues;
      const filteredUserLeagues = userLeagues?.filter((league) => league.leaguename === activeLeague.leaguename);
      if (filteredUserLeagues && filteredUserLeagues.length > 0) {
        const decklistUrl = filteredUserLeagues[0].decklistUrl;
        console.log(`Fetching decklist for ${username} in ${activeLeague.leaguename}: ${decklistUrl}`);
        try {
          const userContent = await getMoxfieldContent(decklistUrl, { apiKey, provider: GATEWAY_PROVIDER });
          leaguePool[username] = {
            decklistUrl,
            moxfieldContent: userContent
          };
          console.log(`Successfully fetched decklist for ${username}`);
        } catch (e) {
          console.error(`Failed to get Moxfield content for ${username}: ${e instanceof Error ? e.message : JSON.stringify(e)}`);
        }

        // Stutter each request by a configurable interval to avoid exceeding gateway concurrency limits
        if (staggerIntervalMs > 0) {
          await sleep(staggerIntervalMs);
        }
      }
    }

    const cardPool = formatCardPool(leaguePool);
    const s3Input = {
      Body: JSON.stringify(cardPool),
      Bucket: LEAGUE_BUCKET_NAME,
      Key: activeLeague.cardPoolKey,
    };
    try {
      await putObject(s3Input);
      console.log(`Successfully updated pool for ${activeLeague.leaguename}!`);
    } catch (e) {
      console.error(`Failed to update pool for ${activeLeague.leaguename}: ${e}`);
    }

    if (activeLeague.cardCountsKey) {
      const cardCounts = formatCardCounts(cardPool);
      const s3CountsInput = {
        Body: JSON.stringify(cardCounts),
        Bucket: LEAGUE_BUCKET_NAME,
        Key: activeLeague.cardCountsKey,
      };
      try {
        await putObject(s3CountsInput);
        console.log(`Successfully updated card counts for ${activeLeague.leaguename}!`);
      } catch (e) {
        console.error(`Failed to update card counts for ${activeLeague.leaguename}: ${e}`);
      }
    }
  }
  const fillPoolsDuration = Date.now() - fillPoolsStartTime;
  
  const jobDuration = Date.now() - jobStartTime;
  console.log(`Fill Pools Job Complete - jobDuration:${jobDuration},leagueTableScanDuration:${leagueTableScanDuration},userTableScanDuration:${userTableScanDuration},fillPoolsDuration:${fillPoolsDuration}`);
};