import axios, { AxiosResponse } from "axios";
import { MagicCardPool, MoxfieldBoard, MoxfieldContentSchema } from "../../src/types";

const getMoxfieldBoards = async (id: string): Promise<MoxfieldBoard[]>  => {
  let result: AxiosResponse<any, any>;
  try {
    result = await axios.get(`https://api2.moxfield.com/v3/decks/all/${id}`);
    if (result.status !== 200) {
      throw new Error('Request to Get decklist from Moxfield failed');
    }
  } catch (e) {
    throw new Error(JSON.stringify(e));
  }
  
  const content = MoxfieldContentSchema.parse(result.data);
  const { boards: { mainboard, sideboard, maybeboard } } = content;
  return [mainboard, sideboard, maybeboard];
};

const fillPool = async (boards: MoxfieldBoard[]): Promise<MagicCardPool> => {
  const pool: MagicCardPool = {};
  const boardsP = boards.map(async (board) => {
    const cardsP = Object.keys(board.cards).map((key) => {
      const cardName = board.cards[key].card.name;
      const quantity = board.cards[key].quantity;
      if (pool.hasOwnProperty(cardName)) pool[cardName] = pool[cardName] + quantity;
      else pool[cardName] = quantity;
    });
    await Promise.all(cardsP);
  });
  await Promise.all(boardsP);
  return pool;
};

export const handler = async (): Promise<void> => {
    const pool: MagicCardPool = {};
};