const getScryfallApiImageUrl = (scryfallId?: string): string | undefined => {
  if (!scryfallId) {
    return undefined;
  }
  return `https://api.scryfall.com/cards/${scryfallId}?format=image`;
};

const getScryfallImageUrl = (scryfallId?: string): string | undefined => {
  if (!scryfallId) {
    return undefined;
  }
  if (scryfallId.length >= 2) {
    const c1 = scryfallId[0];
    const c2 = scryfallId[1];
    return `https://cards.scryfall.io/normal/front/${c1}/${c2}/${scryfallId}.jpg`;
  }
  return `https://api.scryfall.com/cards/${scryfallId}?format=image`;
};

export default {
  getScryfallApiImageUrl,
  getScryfallImageUrl,
};
