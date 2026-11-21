import { S3Event } from 'aws-lambda';
import { z } from 'zod';
import {
  MagicCard,
  MagicCardPool,
  MoxfieldCardDetails,
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

export const resolveCardManaCost = (card: MoxfieldCardDetails): string => {
  if (card.mana_cost && card.mana_cost.trim().length > 0) {
    return card.mana_cost.trim();
  }
  const faceCosts = (card.card_faces ?? [])
    .map((face) => face.mana_cost?.trim() ?? '')
    .filter((cost) => cost.length > 0);
  return faceCosts.join(' // ');
};

export const resolveCardColors = (card: MoxfieldCardDetails): string[] => {
  if (card.colors && card.colors.length > 0) {
    return card.colors;
  }
  const faceColors = new Set<string>();
  for (const face of card.card_faces ?? []) {
    for (const color of face.colors ?? []) {
      faceColors.add(color);
    }
  }
  return Array.from(faceColors).sort(
    (a, b) => (WUBRG_INDEX[a] ?? 99) - (WUBRG_INDEX[b] ?? 99),
  );
};

export const resolveCardRarity = (card: MoxfieldCardDetails): string | undefined => {
  if (card.rarity && card.rarity.trim().length > 0) {
    return card.rarity.trim().toLowerCase();
  }
  return undefined;
};

export const resolveCardTypeLine = (card: MoxfieldCardDetails): string | undefined => {
  if (card.type_line && card.type_line.trim().length > 0) {
    return card.type_line.trim();
  }
  const faceTypeLines = (card.card_faces ?? [])
    .map((face) => face.type_line?.trim() ?? '')
    .filter((line) => line.length > 0);
  return faceTypeLines.length > 0 ? faceTypeLines.join(' // ') : undefined;
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
        const cardCmc = typeof card.card.cmc === 'number' ? card.card.cmc : undefined;
        const cardColors = resolveCardColors(card.card);
        const cardRarity = resolveCardRarity(card.card);
        const cardTypeLine = resolveCardTypeLine(card.card);
        const manaCost = resolveCardManaCost(card.card);
        const mbQty = boardName === 'mainboard' ? card.quantity : 0;
        if (boardName === 'mainboard') {
          cardColors.forEach((c) => userColors.add(c));
        }
        if (cardName in userCardList) {
          if (userCardList[cardName].cmc === undefined && cardCmc !== undefined) {
            userCardList[cardName].cmc = cardCmc;
          }
          if ((!userCardList[cardName].colors || userCardList[cardName].colors.length === 0) && cardColors.length > 0) {
            userCardList[cardName].colors = cardColors;
          }
          userCardList[cardName].mainboardQuantity = (userCardList[cardName].mainboardQuantity || 0) + mbQty;
          userCardList[cardName].quantity += card.quantity;
          if (!userCardList[cardName].rarity && cardRarity !== undefined) {
            userCardList[cardName].rarity = cardRarity;
          }
          if (!userCardList[cardName].type_line && cardTypeLine !== undefined) {
            userCardList[cardName].type_line = cardTypeLine;
          }
        } else {
          userCardList[cardName] = {
            ...(cardCmc !== undefined ? { cmc: cardCmc } : {}),
            colors: cardColors,
            mainboardQuantity: mbQty,
            mana_cost: manaCost,
            name: cardName,
            quantity: card.quantity,
            ...(cardRarity !== undefined ? { rarity: cardRarity } : {}),
            scryfall_id: card.card.scryfall_id ?? undefined,
            ...(cardTypeLine !== undefined ? { type_line: cardTypeLine } : {}),
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
