import axios from 'axios';
import { MagicCardPool, MoxfieldBoard, MoxfieldContent, MoxfieldContentSchema } from '../../src/types';

const getMoxfieldContent = async (url: string): Promise<MoxfieldContent>  => {
  let content: MoxfieldContent;
  try {
    const id = url.split('/')[4];
    const result = await axios.get(`https://api2.moxfield.com/v3/decks/all/${id}`);
    if (result.status !== 200) {
      throw new Error('Request to Get decklist from Moxfield failed');
    }
    content = MoxfieldContentSchema.parse(result.data);
  } catch (e) {
    throw new Error(JSON.stringify(e));
  }
  
  return content;
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
  // scan league table
  // extract league name from active league
  // scan users table
  // extract all users in the active league
  // instantiate a record
  // for users in active league
  //   key = username
  //   get Moxfield Content for the users decklist
  const decklistUrl = 'https://www.moxfield.com/decks/QUoKeyN9CUiANOv24t2WtQ';
  const result = await getMoxfieldContent(decklistUrl);
  console.log(JSON.stringify(result));
  //   set record[key] to Moxfield Content
  // update active league in league table with record for pool
};