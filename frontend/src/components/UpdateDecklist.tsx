import { Button, TextField } from '@mui/material';
import { useContext, useState } from 'react';
import api from '../actions/api.ts';
import { AppContext } from '../App.tsx';

const UpdateDecklist = () => {
  const { session } = useContext(AppContext);
  const [isLoading, setIsLoading] = useState(false);
  const [updateDecklistMsg, setUpdateDecklistMsg] = useState('');
  const [decklist, setDecklist] = useState('');


  const handleUpdateDecklistButtonClick = async () => {
    setIsLoading(true);
    try {
      const username = session.username ?? '';
      const update = {
        decklist,
      };
      const response = await api.updateUser(username, update);
      if (response?.decklist === decklist) {
        setUpdateDecklistMsg('Successfully updated decklist!');
      } else {
        setUpdateDecklistMsg('Failed to update decklist.');
      }
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
