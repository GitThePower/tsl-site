import { S3Event } from 'aws-lambda';
import { z } from 'zod';
import {
  MagicCard,
  MagicCardPool,
  MagicCardPoolSchema,
  ProcessDeckColorsLambdaEnvSchema,
} from '../types';
import { updateItem } from '../utils/ddb';
import { getObject, putObject } from '../utils/s3';

const COLOR_CODES = ['W', 'U', 'B', 'R', 'G'];
const COLOR_THRESHOLD = 0.10;
const WUBRG_INDEX: Record<string, number> = {
  B: 2,
  G: 4,
  R: 3,
  U: 1,
  W: 0,
};

export const isLand = (card: MagicCard): boolean => {
  return !card.mana_cost || card.mana_cost.trim().length === 0;
};

export const normalizeFinalPoolKey = (key: string): string => {
  const stripped = key.replace(/^(pools|card-pools)\//, '');
  return `pools/${stripped}`;
};

export const calculateDeckColors = (cardList: Record<string, MagicCard>): string[] => {
  const nonLandCards = Object.values(cardList).filter(
    (card) => (card.mainboardQuantity || 0) > 0 && !isLand(card),
  );

  const totalNonLandCards = nonLandCards.reduce(
    (sum, card) => sum + (card.mainboardQuantity || 0),
    0,
  );

  if (totalNonLandCards === 0) {
    return [];
  }

  const activeColors: string[] = [];

  for (const color of COLOR_CODES) {
    const colorCount = nonLandCards
      .filter((card) => {
        const hasColorInArray = card.colors?.includes(color);
        const hasColorInManaCost = card.mana_cost?.includes(color);
        return hasColorInArray || hasColorInManaCost;
      })
      .reduce((sum, card) => sum + (card.mainboardQuantity || 0), 0);

    const percentage = colorCount / totalNonLandCards;
    if (percentage >= COLOR_THRESHOLD) {
      activeColors.push(color);
    }
  }

  return activeColors.sort(
    (a, b) => (WUBRG_INDEX[a] ?? 99) - (WUBRG_INDEX[b] ?? 99),
  );
};

export const handler = async (event: S3Event): Promise<void> => {
  const { LEAGUE_BUCKET_NAME, LEAGUE_TABLE_NAME } = ProcessDeckColorsLambdaEnvSchema.parse(process.env);

  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const stageKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    let leaguename: string | undefined;

    try {
      console.log(`Processing deck colors from bucket: ${bucket}, key: ${stageKey}`);
      const s3Response = await getObject({
        Bucket: bucket,
        Key: stageKey,
      });

      leaguename = s3Response.Metadata?.leaguename;
      const cardCountsKey = s3Response.Metadata?.cardcountskey;
      const cardPoolKey = s3Response.Metadata?.cardpoolkey;
      const hasSyncFailure = s3Response.Metadata?.hassyncfailure ?? 'false';

      const bodyString = z.string().parse(await s3Response.Body?.transformToString());
      const cardPool = z.record(z.string(), MagicCardPoolSchema).parse(JSON.parse(bodyString));

      Object.keys(cardPool).forEach((username) => {
        const userPool = cardPool[username];
        userPool.colors = calculateDeckColors(userPool.cardList);
      });

      const targetPoolKey = normalizeFinalPoolKey(cardPoolKey ?? stageKey);

      await putObject({
        Body: JSON.stringify(cardPool),
        Bucket: LEAGUE_BUCKET_NAME,
        Key: targetPoolKey,
        Metadata: {
          cardcountskey: cardCountsKey ?? '',
          hassyncfailure: hasSyncFailure,
          leaguename: leaguename ?? '',
        },
      });

      console.log(`Successfully calculated deck colors and wrote final pool to ${targetPoolKey} for ${leaguename ?? stageKey}`);
    } catch (e) {
      console.error(`Failed to process deck colors for ${stageKey}: ${e instanceof Error ? e.message : e}`);
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
