import { Button, TextField } from '@mui/material';
import { useContext, useState } from 'react';
import api from '../actions/api.ts';
import { AppContext } from '../App.tsx';

const UpdatePassword = () => {
  const { session } = useContext(AppContext);
  const [isLoading, setIsLoading] = useState(false);
  const [changePasswordMsg, setChangePasswordMsg] = useState('');
  const [currPassword, setCurrPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');


  const handleChangePasswordButtonClick = async () => {
    setIsLoading(true);
    try {
      const username = session.username ?? '';
      const currUser = await api.getUser(username);
      if (currUser?.password !== currPassword) {
        setChangePasswordMsg('Password does not match existing.');
      } else {
        const update = {
          password: nextPassword,
        };
        const response = await api.updateUser(username, update);
        if (response?.password === nextPassword) {
          setChangePasswordMsg('Successfully changed password!');
        } else {
          setChangePasswordMsg('Failed to change password.');
        }
      }
    } catch (e) {
      setChangePasswordMsg('Failed to change password.');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={(event) => { event.preventDefault(); }}>
      <TextField
        label='Current Password'
        type='password'
        margin='normal'
        variant='outlined'
        fullWidth
        value={currPassword}
        onChange={(event) => setCurrPassword(event.target.value)}
      />
      <TextField
        label='New Password'
        type='password'
        margin='normal'
        variant='outlined'
        fullWidth
        value={nextPassword}
        onChange={(event) => setNextPassword(event.target.value)}
      />
      <Button
        variant='contained'
        type='submit'
        fullWidth
        onClick={handleChangePasswordButtonClick}
        disabled={isLoading}
      >
        {isLoading ? 'Changing Password...' : 'Change Password'}
      </Button>
      {changePasswordMsg && (
        <h5>{changePasswordMsg}</h5>
      )}
    </form>
  );
}

export default UpdatePassword;
