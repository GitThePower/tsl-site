import { S3Event } from 'aws-lambda';
import { z } from 'zod';
import {
  MagicCard,
  MagicCardPool,
  MoxfieldPool,
  ProcessCardPoolLambdaEnvSchema,
  RawPoolEnvelopeSchema,
} from '../types';
import { updateItem } from '../utils/ddb';
import { getObject, putObject } from '../utils/s3';

const BASIC_LAND_NAMES = ['Forest', 'Island', 'Mountain', 'Plains', 'Swamp'];
const WUBRG_INDEX: Record<string, number> = {
  B: 2,
  G: 4,
  R: 3,
  U: 1,
  W: 0,
};

export const normalizeCardPoolKey = (key: string): string => {
  const stripped = key.replace(/^(pools|card-pools)\//, '');
  return `card-pools/${stripped}`;
};

export const normalizePoolKey = (key: string): string => {
  const stripped = key.replace(/^(pools|card-pools)\//, '');
  return `pools/${stripped}`;
};

export const normalizeCountsKey = (key: string): string => {
  const stripped = key.replace(/^counts\//, '');
  return `counts/${stripped}`;
};

export const formatCardPool = (leaguePool: MoxfieldPool): Record<string, MagicCardPool> => {
  const searchResults: Record<string, MagicCardPool> = {};
  Object.keys(leaguePool).forEach((username) => {
    searchResults[username] = {} as MagicCardPool;
    const userCardList = {} as Record<string, MagicCard>;
    const userColors = new Set<string>();
    searchResults[username].decklistUrl = leaguePool[username].decklistUrl;
    Object.entries(leaguePool[username].moxfieldContent.boards).forEach(([boardName, board]) => {
      Object.values(board.cards).forEach((card) => {
        const cardName = card.card.name;
        if (BASIC_LAND_NAMES.includes(cardName)) {
          return;
        }
        const mbQty = boardName === 'mainboard' ? card.quantity : 0;
        if (boardName === 'mainboard' && card.card.colors) {
          card.card.colors.forEach((c) => userColors.add(c));
        }
        if (cardName in userCardList) {
          if (!userCardList[cardName].colors && card.card.colors) {
            userCardList[cardName].colors = card.card.colors;
          }
          userCardList[cardName].mainboardQuantity = (userCardList[cardName].mainboardQuantity || 0) + mbQty;
          userCardList[cardName].quantity += card.quantity;
        } else {
          userCardList[cardName] = {
            colors: card.card.colors,
            mainboardQuantity: mbQty,
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
    searchResults[username].colors = Array.from(userColors).sort(
      (a, b) => (WUBRG_INDEX[a] ?? 99) - (WUBRG_INDEX[b] ?? 99),
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

export const handler = async (event: S3Event): Promise<void> => {
  const { LEAGUE_BUCKET_NAME, LEAGUE_TABLE_NAME } = ProcessCardPoolLambdaEnvSchema.parse(process.env);

  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const rawKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    let leaguename: string | undefined = rawKey.startsWith('raw/') && rawKey.endsWith('.json')
      ? rawKey.slice(4, -5)
      : undefined;

    try {
      console.log(`Processing raw pool from bucket: ${bucket}, key: ${rawKey}`);
      const s3Response = await getObject({
        Bucket: bucket,
        Key: rawKey,
      });

      const bodyString = z.string().parse(await s3Response.Body?.transformToString());
      const parsedJson = JSON.parse(bodyString);
      if (typeof parsedJson?.leaguename === 'string') {
        leaguename = parsedJson.leaguename;
      }
      const rawEnvelope = RawPoolEnvelopeSchema.parse(parsedJson);
      leaguename = rawEnvelope.leaguename;

      const cardPool = formatCardPool(rawEnvelope.pool);
      const stagedPoolKey = normalizeCardPoolKey(rawEnvelope.cardPoolKey);
      const targetFinalPoolKey = normalizePoolKey(rawEnvelope.cardPoolKey);
      const targetCountsKey = normalizeCountsKey(rawEnvelope.cardCountsKey);

      await putObject({
        Body: JSON.stringify(cardPool),
        Bucket: LEAGUE_BUCKET_NAME,
        Key: stagedPoolKey,
        Metadata: {
          cardcountskey: targetCountsKey,
          cardpoolkey: targetFinalPoolKey,
          hassyncfailure: String(rawEnvelope.hasSyncFailure),
          leaguename: rawEnvelope.leaguename,
        },
      });

      console.log(`Successfully processed and wrote card pool to ${stagedPoolKey} for ${leaguename}`);
    } catch (e) {
      console.error(`Failed to process raw pool for ${rawKey}: ${e instanceof Error ? e.message : e}`);
      if (leaguename) {
        try {
          await updateItem(
            LEAGUE_TABLE_NAME,
            { leaguename },
            { poolSyncError: true },
          );
        } catch (dbError) {
          console.error(`Failed to mark poolSyncError for ${leaguename}: ${dbError instanceof Error ? dbError.message : dbError}`);
        }
      }
      throw e;
    }
  }
};
