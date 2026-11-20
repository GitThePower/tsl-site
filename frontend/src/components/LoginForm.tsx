import { Button, TextField } from '@mui/material';
import { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../actions/api.ts';
import { AppContext } from '../App.tsx';
import { config } from '../../../local-config/index.ts';

const LoginForm = () => {
  const { setCurrentUser, setSession } = useContext(AppContext);
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [loginFailed, setLoginFailed] = useState(false);
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');

  const handleLoginButtonClick = async () => {
    setIsLoading(true);
    setLoginFailed(false);
    try {
      const trimmedUsername = username.trim();
      const session = await api.login(trimmedUsername, password);
      if (session.sessionid) {
        localStorage.setItem(config.sessionIdLocalStorageKey, session.sessionid);
      }
      const user = session.username ? await api.getUser(session.username) : {};
      setSession(session);
      setCurrentUser(user);
      navigate('/');
    } catch (e) {
      setLoginFailed(true);
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={(event) => { event.preventDefault(); }}>
      <TextField
        label='Username'
        margin='normal'
        variant='outlined'
        fullWidth
        value={username}
        onChange={(event) => setUsername(event.target.value)}
      />
      <TextField
        label='Password'
        type='password'
        margin='normal'
        variant='outlined'
        fullWidth
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <Button
        variant='contained'
        type='submit'
        fullWidth
        onClick={handleLoginButtonClick}
        disabled={isLoading || !username.trim() || !password}
      >
        {isLoading ? 'Logging in...' : 'Login'}
      </Button>
      {loginFailed && (
        <h5>Login Failed</h5>
      )}
    </form>
  );
};

export default LoginForm;
