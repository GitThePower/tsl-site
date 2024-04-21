import { Button, TextField } from '@mui/material';
import { useContext, useState } from 'react';
import api from '../actions/api.ts';
import { AppContext } from '../App.tsx';

const UpdateDecklist = () => {
  const { league, session } = useContext(AppContext);
  const [isLoading, setIsLoading] = useState(false);
  const [updateDecklistMsg, setUpdateDecklistMsg] = useState('');
  const [decklist, setDecklist] = useState('');


  const handleUpdateDecklistButtonClick = async () => {
    setIsLoading(true);
    try {
      const username = session.username ?? '';
      const user = await api.getUser(username);
      if (!user.leagues) { // User does not have any league memberships
        const update = {
          leagues: [
            {
              leaguename: league.leaguename || '',
              decklistUrl: decklist,
            }
          ],
        };
        await api.updateUser(username, update);
      } else if (user.leagues.filter((userLeague) => userLeague.leaguename === league.leaguename).length < 1) { // User is not a member of the active league
        const currLeagues = user.leagues;
        currLeagues.push({
          leaguename: league.leaguename || '',
          decklistUrl: decklist,
        });
        const update = {
          leagues: currLeagues,
        };
        await api.updateUser(username, update);
      } else { // User is a member of the active league
        const currLeagues = user.leagues.filter((userLeague) => userLeague.leaguename !== league.leaguename);
        currLeagues.push({
          leaguename: league.leaguename || '',
          decklistUrl: decklist,
        });
        const update = {
          leagues: currLeagues,
        };
        await api.updateUser(username, update);
      }
      setUpdateDecklistMsg('Successfully updated decklist!');
    } catch (e) {
      setUpdateDecklistMsg('Failed to update decklist.');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={(event) => { event.preventDefault(); }}>
      <TextField
        label='Enter Decklist URL'
        margin='normal'
        variant='outlined'
        fullWidth
        value={decklist}
        onChange={(event) => setDecklist(event.target.value)}
      />
      <Button
        variant='contained'
        type='submit'
        fullWidth
        onClick={handleUpdateDecklistButtonClick}
        disabled={isLoading}
      >
        {isLoading ? 'Updating Decklist...' : 'Update Decklist'}
      </Button>
      {updateDecklistMsg && (
        <h5>{updateDecklistMsg}</h5>
      )}
    </form>
  );
}

export default UpdateDecklist;
