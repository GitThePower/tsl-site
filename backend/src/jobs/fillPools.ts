import axios from 'axios';
import { z } from 'zod';
import { listItems, updateItem } from '../utils/ddb';
import { LeagueSchema, MoxfieldContent, MoxfieldContentSchema, FillPoolsLambdaEnvSchema, UserSchema } from '../../src/types';

const getMoxfieldContent = async (url: string): Promise<MoxfieldContent> => {
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

const extractTableContents = async (tableName: string): Promise<object> => {
  const listTableResult = await listItems(tableName);
  if (listTableResult.statusCode !== 200)
    throw new Error(listTableResult.body);
  return JSON.parse(listTableResult.body);
};

export const handler = async (): Promise<void> => {
  const jobStartTime = Date.now();
  const { LEAGUE_TABLE_NAME, USER_TABLE_NAME } = FillPoolsLambdaEnvSchema.parse(process.env);

  const leagueTableScanStartTime = Date.now();
  const allLeagues = await extractTableContents(LEAGUE_TABLE_NAME);
  const leagueTableScanDuration = Date.now() - leagueTableScanStartTime;

  const validatedLeagues = z.array(LeagueSchema).parse(allLeagues);
  const activeLeagues = validatedLeagues.filter((league) => league.isActive && league.isActive === true);

  const userTableScanStartTime = Date.now();
  const usersList = await extractTableContents(USER_TABLE_NAME);
  const userTableScanDuration = Date.now() - userTableScanStartTime;

  const validatedUsers = z.array(UserSchema).parse(usersList);

  const fillPoolsStartTime = Date.now();
  const fillPoolsPromises = activeLeagues.map(async (activeLeague) => {
    const leaguePool: Record<string, { decklistUrl: string, moxfieldContent: MoxfieldContent}> = {};
    const assemblePoolPromises = validatedUsers.map(async (user) => {
      const username = user.username ?? '';
      const userLeagues = user.leagues;
      const filteredUserLeagues = userLeagues?.filter((league) => league.leaguename === activeLeague.leaguename);
      if (filteredUserLeagues && filteredUserLeagues.length > 0) {
        const decklistUrl = filteredUserLeagues[0].decklistUrl;
        try {
          const userContent = await getMoxfieldContent(decklistUrl);
          leaguePool[username] = {
            decklistUrl,
            moxfieldContent: userContent
          };
        } catch (e) {
          console.error(`Failed to get Moxfield content for ${username}: ${JSON.stringify(e)}`);
        }
      }
    });
    await Promise.all(assemblePoolPromises);
    const leagueQuery = LeagueSchema.safeParse({ leaguename: activeLeague.leaguename });
    const leagueUpdate = LeagueSchema.safeParse({ cardPool: leaguePool });
    const updatePoolResult = await updateItem(LEAGUE_TABLE_NAME, leagueQuery, leagueUpdate);
    if (updatePoolResult.statusCode === 200) {
      console.log(`Successfully updated pool for ${activeLeague.leaguename}!`);
    } else {
      console.error(`Failed to update pool for ${activeLeague.leaguename}: ${updatePoolResult.body}`);
    }
  });
  await Promise.all(fillPoolsPromises);
  const fillPoolsDuration = Date.now() - fillPoolsStartTime;
  
  const jobDuration = Date.now() - jobStartTime;
  console.log(`Fill Pools Job Complete - jobDuration:${jobDuration},leagueTableScanDuration:${leagueTableScanDuration},userTableScanDuration:${userTableScanDuration},fillPoolsDuration:${fillPoolsDuration}`);
};