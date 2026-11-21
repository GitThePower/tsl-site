import { MagicCard, MagicCardPool } from '../../../backend/src/types';

export const CARD_TYPES = [
  'Artifact',
  'Battle',
  'Creature',
  'Enchantment',
  'Instant',
  'Land',
  'Planeswalker',
  'Sorcery',
] as const;
export type CardType = (typeof CARD_TYPES)[number];

export const COLOR_MATCH_MODES = ['include', 'exclude', 'exactly'] as const;
export type ColorMatchMode = (typeof COLOR_MATCH_MODES)[number];

export const COLOR_OPTIONS = ['W', 'U', 'B', 'R', 'G', 'C'] as const;
export type CardColorCode = (typeof COLOR_OPTIONS)[number];

export const RARITY_OPTIONS = ['common', 'uncommon', 'rare', 'mythic'] as const;
export type CardRarity = (typeof RARITY_OPTIONS)[number];

export interface CardPoolFilters {
  colorMatchMode: ColorMatchMode;
  colors: CardColorCode[];
  maxManaValue: string;
  minManaValue: string;
  name: string;
  rarities: CardRarity[];
  subtype: string;
  types: CardType[];
}

export const DEFAULT_CARD_POOL_FILTERS: CardPoolFilters = {
  colorMatchMode: 'include',
  colors: [],
  maxManaValue: '',
  minManaValue: '',
  name: '',
  rarities: [],
  subtype: '',
  types: [],
};

export interface FilterPoolResult {
  filteredPool: Record<string, MagicCardPool>;
  matchingCardEntries: number;
  matchingPlayerCount: number;
  totalCardCopies: number;
}

const haveSameElements = <T extends string>(a: readonly T[], b: readonly T[]): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, index) => value === sortedB[index]);
};

export const areFiltersEqual = (a: CardPoolFilters, b: CardPoolFilters): boolean => (
  a.colorMatchMode === b.colorMatchMode &&
  a.maxManaValue.trim() === b.maxManaValue.trim() &&
  a.minManaValue.trim() === b.minManaValue.trim() &&
  a.name.trim() === b.name.trim() &&
  a.subtype.trim() === b.subtype.trim() &&
  haveSameElements(a.colors, b.colors) &&
  haveSameElements(a.rarities, b.rarities) &&
  haveSameElements(a.types, b.types)
);

const parseManaValueBound = (raw: string): number | undefined => {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const isManaValueRangeInvalid = (minRaw: string, maxRaw: string): boolean => {
  const min = parseManaValueBound(minRaw);
  const max = parseManaValueBound(maxRaw);
  return min !== undefined && max !== undefined && min > max;
};

export const getCardColors = (card: MagicCard): string[] => {
  // Empty array explicitly denotes a colorless card; only fall back to mana_cost when omitted.
  if (card.colors !== undefined) {
    return Array.from(new Set(card.colors));
  }
  const matched = card.mana_cost.match(/[WUBRG]/g);
  return matched ? Array.from(new Set(matched)) : [];
};

export const matchesColorFilter = (
  card: MagicCard,
  selectedColors: CardColorCode[],
  mode: ColorMatchMode,
): boolean => {
  if (selectedColors.length === 0) {
    return true;
  }
  const cardColors = getCardColors(card);

  if (mode === 'include') {
    return selectedColors.some((color) =>
      color === 'C' ? cardColors.length === 0 : cardColors.includes(color),
    );
  }

  if (mode === 'exclude') {
    return selectedColors.every((color) =>
      color === 'C' ? cardColors.length > 0 : !cardColors.includes(color),
    );
  }

  if (selectedColors.includes('C')) {
    return selectedColors.length === 1 ? cardColors.length === 0 : false;
  }

  return (
    cardColors.length === selectedColors.length &&
    selectedColors.every((color) => cardColors.includes(color))
  );
};

export const extractCoreCardTypes = (typeLine: string): Set<string> => {
  const types = new Set<string>();
  for (const face of typeLine.split('//')) {
    const corePart = face.split(/\s*(?:—|–)\s*|\s+-\s+/)[0] ?? '';
    for (const token of corePart.split(/\s+/)) {
      const normalized = token.trim().toLowerCase();
      if (normalized) {
        types.add(normalized);
      }
    }
  }
  return types;
};

export const matchesTypeFilter = (
  card: MagicCard,
  selectedTypes: CardType[],
  subtypeText: string,
): boolean => {
  const trimmedSubtype = subtypeText.trim();
  if (selectedTypes.length === 0 && trimmedSubtype === '') {
    return true;
  }
  if (!card.type_line) {
    return false;
  }
  if (selectedTypes.length > 0) {
    const faceTypes = extractCoreCardTypes(card.type_line);
    if (!selectedTypes.some((cardType) => faceTypes.has(cardType.toLowerCase()))) {
      return false;
    }
  }
  if (trimmedSubtype !== '') {
    const lowerTypeLine = card.type_line.toLowerCase();
    const tokens = trimmedSubtype.toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.every((token) => lowerTypeLine.includes(token))) {
      return false;
    }
  }
  return true;
};

export const matchesManaValueFilter = (
  card: MagicCard,
  minRaw: string,
  maxRaw: string,
): boolean => {
  const min = parseManaValueBound(minRaw);
  const max = parseManaValueBound(maxRaw);
  if (min === undefined && max === undefined) {
    return true;
  }
  if (typeof card.cmc !== 'number') {
    return false;
  }
  return (min === undefined || card.cmc >= min) && (max === undefined || card.cmc <= max);
};

export const matchesRarityFilter = (
  card: MagicCard,
  selectedRarities: CardRarity[],
): boolean => {
  if (selectedRarities.length === 0) {
    return true;
  }
  if (!card.rarity) {
    return false;
  }
  return selectedRarities.includes(card.rarity.toLowerCase() as CardRarity);
};

export const matchesNameFilter = (card: MagicCard, nameQuery: string): boolean => {
  const trimmed = nameQuery.trim().toLowerCase();
  if (!trimmed) {
    return true;
  }
  return card.name.toLowerCase().includes(trimmed);
};

export const filterCardPool = (
  pool: Record<string, MagicCardPool>,
  filters: CardPoolFilters,
): FilterPoolResult => {
  const filteredPool: Record<string, MagicCardPool> = {};
  let matchingCardEntries = 0;
  let matchingPlayerCount = 0;
  let totalCardCopies = 0;

  for (const [username, userPool] of Object.entries(pool)) {
    const filteredCardList: Record<string, MagicCard> = {};
    for (const [cardName, card] of Object.entries(userPool.cardList)) {
      if (
        matchesNameFilter(card, filters.name) &&
        matchesColorFilter(card, filters.colors, filters.colorMatchMode) &&
        matchesTypeFilter(card, filters.types, filters.subtype) &&
        matchesManaValueFilter(card, filters.minManaValue, filters.maxManaValue) &&
        matchesRarityFilter(card, filters.rarities)
      ) {
        filteredCardList[cardName] = card;
        matchingCardEntries += 1;
        totalCardCopies += card.quantity;
      }
    }

    if (Object.keys(filteredCardList).length > 0) {
      filteredPool[username] = {
        ...userPool,
        cardList: filteredCardList,
      };
      matchingPlayerCount += 1;
    }
  }

  return {
    filteredPool,
    matchingCardEntries,
    matchingPlayerCount,
    totalCardCopies,
  };
};

export const detectMissingFilterMetadata = (
  pool: Record<string, MagicCardPool>,
  filters: CardPoolFilters,
): string[] => {
  const isTypeActive = filters.types.length > 0 || filters.subtype.trim().length > 0;
  const isManaValueActive =
    parseManaValueBound(filters.minManaValue) !== undefined ||
    parseManaValueBound(filters.maxManaValue) !== undefined;
  const isRarityActive = filters.rarities.length > 0;

  if (!isTypeActive && !isManaValueActive && !isRarityActive) {
    return [];
  }

  let hasAnyCard = false;
  let missingCmc = false;
  let missingRarity = false;
  let missingTypeLine = false;

  for (const userPool of Object.values(pool)) {
    for (const card of Object.values(userPool.cardList)) {
      hasAnyCard = true;
      if (!card.type_line) {
        missingTypeLine = true;
      }
      if (typeof card.cmc !== 'number') {
        missingCmc = true;
      }
      if (!card.rarity) {
        missingRarity = true;
      }
      if (missingTypeLine && missingCmc && missingRarity) {
        break;
      }
    }
    if (missingTypeLine && missingCmc && missingRarity) {
      break;
    }
  }

  if (!hasAnyCard) {
    return [];
  }

  const missingLabels: string[] = [];
  if (isTypeActive && missingTypeLine) {
    missingLabels.push('Card Type');
  }
  if (isManaValueActive && missingCmc) {
    missingLabels.push('Mana Value');
  }
  if (isRarityActive && missingRarity) {
    missingLabels.push('Rarity');
  }
  return missingLabels;
};

export const formatCardSecondaryText = (card: MagicCard): string | undefined => {
  const parts: string[] = [];
  if (card.type_line && card.type_line.trim().length > 0) {
    parts.push(card.type_line.trim());
  }
  if (card.rarity && card.rarity.trim().length > 0) {
    const trimmed = card.rarity.trim();
    parts.push(`${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1).toLowerCase()}`);
  }
  return parts.length > 0 ? parts.join(' • ') : undefined;
};
