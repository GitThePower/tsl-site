import { S3Event } from 'aws-lambda';
import { z } from 'zod';
import {
  LeagueSchema,
  MagicCard,
  MagicCardCounts,
  MagicCardPool,
  MagicCardPoolSchema,
  ProcessCardCountsLambdaEnvSchema,
} from '../types';
import { listItems, updateItem } from '../utils/ddb';
import { getObject, putObject } from '../utils/s3';

export const normalizeCountsKey = (key: string): string => {
  return key.startsWith('counts/') ? key : `counts/${key}`;
};

export const formatCardCounts = (cardPool: Record<string, MagicCardPool>): MagicCardCounts => {
  const cardCounts: Record<string, MagicCard> = {};
  Object.values(cardPool).forEach((userPool) => {
    Object.values(userPool.cardList).forEach((card) => {
      const mbQty = card.mainboardQuantity || 0;
      if (card.name in cardCounts) {
        cardCounts[card.name].mainboardQuantity = (cardCounts[card.name].mainboardQuantity || 0) + mbQty;
        cardCounts[card.name].quantity += card.quantity;
      } else {
        cardCounts[card.name] = {
          mainboardQuantity: mbQty,
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

export const handler = async (event: S3Event): Promise<void> => {
  const { LEAGUE_BUCKET_NAME, LEAGUE_TABLE_NAME } = ProcessCardCountsLambdaEnvSchema.parse(process.env);

  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const poolKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    let leaguename: string | undefined;

    try {
      console.log(`Processing card counts from bucket: ${bucket}, key: ${poolKey}`);
      const s3Response = await getObject({
        Bucket: bucket,
        Key: poolKey,
      });

      const bodyString = z.string().parse(await s3Response.Body?.transformToString());
      const cardPool = z.record(z.string(), MagicCardPoolSchema).parse(JSON.parse(bodyString));

      let cardCountsKey = s3Response.Metadata?.cardcountskey;
      let hasSyncFailure = s3Response.Metadata?.hassyncfailure === 'true';
      leaguename = s3Response.Metadata?.leaguename;

      if (!cardCountsKey || !leaguename) {
        console.log(`Metadata missing for ${poolKey}. Looking up league in DynamoDB...`);
        const leaguesList = await listItems(LEAGUE_TABLE_NAME);
        const leagues = z.array(LeagueSchema).parse(leaguesList.Items);
        const matchedLeague = leagues.find(
          (league) => league.cardPoolKey === poolKey || `pools/${league.cardPoolKey}` === poolKey,
        );

        if (matchedLeague?.leaguename) {
          leaguename = matchedLeague.leaguename;
          cardCountsKey = matchedLeague.cardCountsKey;
          hasSyncFailure = matchedLeague.poolSyncError ?? false;
        }
      }

      if (!cardCountsKey) {
        throw new Error(`Could not determine cardCountsKey for pool key ${poolKey}`);
      }

      const cardCounts = formatCardCounts(cardPool);
      const targetCountsKey = normalizeCountsKey(cardCountsKey);

      await putObject({
        Body: JSON.stringify(cardCounts),
        Bucket: LEAGUE_BUCKET_NAME,
        Key: targetCountsKey,
      });

      console.log(`Successfully updated card counts at ${targetCountsKey} for ${leaguename ?? poolKey}`);

      if (leaguename) {
        await updateItem(
          LEAGUE_TABLE_NAME,
          { leaguename },
          { poolSyncError: hasSyncFailure },
        );
        console.log(`Successfully updated poolSyncError=${hasSyncFailure} for ${leaguename}`);
      }
    } catch (e) {
      console.error(`Failed to process card counts for ${poolKey}: ${e instanceof Error ? e.message : e}`);
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
