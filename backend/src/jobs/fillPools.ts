import { z } from 'zod';
import {
  FillPoolsLambdaEnvSchema,
  GatewayProvider,
  LeagueSchema,
  MoxfieldContent,
  MoxfieldContentSchema,
  MoxfieldPool,
  RawPoolEnvelope,
  UserSchema,
} from '../../src/types';
import { listItems, updateItem } from '../utils/ddb';
import { putObject } from '../utils/s3';
import { getSecretValue } from '../utils/secrets';
import { formatCardCounts } from './processCardCounts';
import { formatCardPool } from './processCardPool';

export { formatCardCounts, formatCardPool };

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export interface GatewayCredential {
  apiKey: string;
  provider: GatewayProvider;
}

export interface FetchMoxfieldOptions {
  apiKey?: string;
  credentials?: GatewayCredential[];
  exhaustedProviders?: Set<GatewayProvider>;
  maxRetries?: number;
  provider?: GatewayProvider;
  retryDelayMs?: number;
}

export const DEFAULT_PROVIDER_ORDER: GatewayProvider[] = [
  'scraperapi',
  'scrapedo',
  'scrapingant',
  'scrapingbee',
];

export const parseGatewayCredentials = (secretString?: string): GatewayCredential[] => {
  if (!secretString || !secretString.trim()) {
    return [];
  }

  const parsed = JSON.parse(secretString.trim());
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Gateway secret must be a JSON object mapping provider names to API keys');
  }

  const credentials: GatewayCredential[] = [];
  for (const provider of DEFAULT_PROVIDER_ORDER) {
    const key = (parsed as Record<string, unknown>)[provider];
    if (typeof key === 'string' && key.trim().length > 0) {
      credentials.push({
        apiKey: key.trim(),
        provider,
      });
    }
  }
  return credentials;
};

export const buildGatewayUrl = (
  targetUrl: string,
  apiKey: string,
  provider: GatewayProvider = 'scraperapi',
): string => {
  if (provider === 'scrapedo') {
    return `https://api.scrape.do?token=${apiKey}&url=${encodeURIComponent(targetUrl)}`;
  }
  if (provider === 'scrapingant') {
    return `https://api.scrapingant.com/v2/general?url=${encodeURIComponent(targetUrl)}&x-api-key=${apiKey}&browser=false`;
  }
  if (provider === 'scrapingbee') {
    return `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(targetUrl)}&render_js=false`;
  }
  return `https://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(targetUrl)}`;
};

export const getMoxfieldContent = async (url: string, options?: FetchMoxfieldOptions): Promise<MoxfieldContent> => {
  const id = url.split('/')[4];
  const targetUrl = `https://api2.moxfield.com/v3/decks/all/${id}`;

  const defaultProvider = options?.provider ?? (process.env.GATEWAY_PROVIDER as GatewayProvider) ?? 'scraperapi';
  const configuredCredentials: GatewayCredential[] =
    options?.credentials && options.credentials.length > 0
      ? options.credentials
      : options?.apiKey
        ? [{ apiKey: options.apiKey, provider: defaultProvider }]
        : parseGatewayCredentials(process.env.SCRAPING_GATEWAY_API_KEY);

  const exhaustedProviders = options?.exhaustedProviders;
  const availableCredentials = configuredCredentials.filter(
    (cred) => !exhaustedProviders?.has(cred.provider),
  );

  if (configuredCredentials.length > 0 && availableCredentials.length === 0) {
    throw new Error(`All configured scraping gateway providers are exhausted for ${url}`);
  }

  const candidates: Array<GatewayCredential | undefined> =
    availableCredentials.length > 0 ? availableCredentials : [undefined];

  const headers: Record<string, string> = {
    'Accept': 'application/json, text/plain, */*',
    'Origin': 'https://www.moxfield.com',
    'Referer': 'https://www.moxfield.com/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };

  const maxRetries = options?.maxRetries ?? 2;
  const baseRetryDelay = options?.retryDelayMs ?? 3000;
  let lastError: Error | undefined;

  for (const credential of candidates) {
    const fetchUrl = credential
      ? buildGatewayUrl(targetUrl, credential.apiKey, credential.provider)
      : targetUrl;
    const providerLabel = credential?.provider ?? 'direct';

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await fetch(fetchUrl, { headers });
        if (result.status === 401 || result.status === 403) {
          const errText = await result.text().catch(() => '');
          if (credential && exhaustedProviders) {
            exhaustedProviders.add(credential.provider);
          }
          lastError = new Error(
            `Request to Get decklist from Moxfield via ${providerLabel} failed with status ${result.status}: ${errText.slice(0, 200)}`,
          );
          console.warn(
            `[${result.status} Quota/Auth Failure] Provider ${providerLabel} failed for ${url}. Marking provider exhausted and failing over. Gateway message: ${errText.slice(0, 150)}`,
          );
          break;
        }
        if (result.status === 429) {
          const errText = await result.text().catch(() => '');
          lastError = new Error(
            `Request to Get decklist from Moxfield via ${providerLabel} failed with status 429: ${errText.slice(0, 200)}`,
          );
          if (attempt < maxRetries) {
            const delay = baseRetryDelay * attempt;
            console.warn(
              `[429 Rate Limited] Attempt ${attempt}/${maxRetries} via ${providerLabel} for ${url}. Backing off for ${delay}ms before retrying. Gateway message: ${errText.slice(0, 150)}`,
            );
            await sleep(delay);
            continue;
          }
          console.warn(`[429 Rate Limited] Provider ${providerLabel} exhausted retries for ${url}. Failing over if another provider is available.`);
          break;
        }
        if (!result.ok) {
          const errText = await result.text().catch(() => '');
          throw new Error(
            `Request to Get decklist from Moxfield via ${providerLabel} failed with status ${result.status}: ${errText.slice(0, 200)}`,
          );
        }
        return MoxfieldContentSchema.parse(await result.json());
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(JSON.stringify(e));
        if (attempt >= maxRetries) {
          console.warn(
            `Provider ${providerLabel} failed after ${maxRetries} attempts for ${url}: ${lastError.message}`,
          );
          break;
        }
        console.warn(
          `Fetch error on attempt ${attempt}/${maxRetries} via ${providerLabel} for ${url}: ${lastError.message}. Retrying...`,
        );
        await sleep(baseRetryDelay);
      }
    }
  }

  throw lastError ?? new Error(`Failed to retrieve Moxfield content for ${url}`);
};

export const handler = async (): Promise<void> => {
  const jobStartTime = Date.now();
  const DEFAULT_STAGGER_INTERVAL_MS = 2500;
  const {
    GATEWAY_PROVIDER,
    GATEWAY_SECRET_NAME,
    LEAGUE_BUCKET_NAME,
    LEAGUE_TABLE_NAME,
    REQUEST_DELAY_MS,
    USER_TABLE_NAME,
  } = FillPoolsLambdaEnvSchema.parse(process.env);
  const staggerIntervalMs = REQUEST_DELAY_MS ? parseInt(REQUEST_DELAY_MS, 10) : DEFAULT_STAGGER_INTERVAL_MS;

  let rawSecret = process.env.SCRAPING_GATEWAY_API_KEY;
  if (!rawSecret && GATEWAY_SECRET_NAME) {
    try {
      rawSecret = await getSecretValue(GATEWAY_SECRET_NAME);
    } catch (e) {
      console.warn(`Could not load gateway secret ${GATEWAY_SECRET_NAME}: ${e instanceof Error ? e.message : e}`);
    }
  }

  const credentials = parseGatewayCredentials(rawSecret);
  const exhaustedProviders = new Set<GatewayProvider>();

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
    let hasSyncFailure = false;

    for (const user of validatedUsers) {
      const username = user.username ?? '';
      const userLeagues = user.leagues;
      const filteredUserLeagues = userLeagues?.filter((league) => league.leaguename === activeLeague.leaguename);
      if (filteredUserLeagues && filteredUserLeagues.length > 0) {
        const decklistUrl = filteredUserLeagues[0].decklistUrl;
        console.log(`Fetching decklist for ${username} in ${activeLeague.leaguename}: ${decklistUrl}`);
        try {
          const userContent = await getMoxfieldContent(decklistUrl, {
            credentials,
            exhaustedProviders,
            provider: GATEWAY_PROVIDER,
          });
          leaguePool[username] = {
            decklistUrl,
            moxfieldContent: userContent,
          };
          console.log(`Successfully fetched decklist for ${username}`);
        } catch (e) {
          hasSyncFailure = true;
          console.error(`Failed to get Moxfield content for ${username}: ${e instanceof Error ? e.message : JSON.stringify(e)}`);
        }

        // Stutter each request by a configurable interval to avoid exceeding gateway concurrency limits
        if (staggerIntervalMs > 0) {
          await sleep(staggerIntervalMs);
        }
      }
    }

    const rawEnvelope: RawPoolEnvelope = {
      cardCountsKey: activeLeague.cardCountsKey ?? '',
      cardPoolKey: activeLeague.cardPoolKey ?? '',
      hasSyncFailure,
      leaguename: activeLeague.leaguename ?? '',
      pool: leaguePool,
    };
    const rawKey = `raw/${activeLeague.leaguename}.json`;
    const s3Input = {
      Body: JSON.stringify(rawEnvelope),
      Bucket: LEAGUE_BUCKET_NAME,
      Key: rawKey,
    };
    try {
      await putObject(s3Input);
      console.log(`Successfully wrote raw pool for ${activeLeague.leaguename} to ${rawKey}!`);
    } catch (e) {
      console.error(`Failed to write raw pool for ${activeLeague.leaguename}: ${e}`);
      if (activeLeague.leaguename) {
        try {
          await updateItem(
            LEAGUE_TABLE_NAME,
            { leaguename: activeLeague.leaguename },
            { poolSyncError: true },
          );
        } catch (dbError) {
          console.error(`Failed to update poolSyncError for ${activeLeague.leaguename}: ${dbError}`);
        }
      }
    }
  }
  const fillPoolsDuration = Date.now() - fillPoolsStartTime;

  const jobDuration = Date.now() - jobStartTime;
  console.log(`Fill Pools Job Complete - jobDuration:${jobDuration},leagueTableScanDuration:${leagueTableScanDuration},userTableScanDuration:${userTableScanDuration},fillPoolsDuration:${fillPoolsDuration}`);
};