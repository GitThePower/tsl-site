import axios from 'axios';
import { z } from 'zod';
import { listItems } from '../utils/ddb';
import { FillPoolsLambdaEnvSchema, LeagueSchema, MoxfieldContent, MoxfieldContentSchema, MoxfieldPool, UserSchema } from '../../src/types';
import { putObject } from '../utils/s3';

export const getMoxfieldContent = async (url: string): Promise<MoxfieldContent> => {
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

export const handler = async (): Promise<void> => {
  const jobStartTime = Date.now();
  const { LEAGUE_BUCKET_NAME, LEAGUE_TABLE_NAME, USER_TABLE_NAME } = FillPoolsLambdaEnvSchema.parse(process.env);

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
  const fillPoolsPromises = activeLeagues.map(async (activeLeague) => {
    const leaguePool: MoxfieldPool = {};
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

    const s3Input = {
      Body: JSON.stringify(leaguePool),
      Bucket: LEAGUE_BUCKET_NAME,
      Key: activeLeague.cardPoolKey,
    };
    try {
      await putObject(s3Input);
      console.log(`Successfully updated pool for ${activeLeague.leaguename}!`);
    } catch (e) {
      console.error(`Failed to update pool for ${activeLeague.leaguename}: ${e}`);
    }
  });
  await Promise.all(fillPoolsPromises);
  const fillPoolsDuration = Date.now() - fillPoolsStartTime;
  
  const jobDuration = Date.now() - jobStartTime;
  console.log(`Fill Pools Job Complete - jobDuration:${jobDuration},leagueTableScanDuration:${leagueTableScanDuration},userTableScanDuration:${userTableScanDuration},fillPoolsDuration:${fillPoolsDuration}`);
};