import { Button, TextField } from '@mui/material';
import { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 } from 'uuid';
import api from '../actions/api.ts';
import { AppContext } from '../App.tsx';
import { User } from '../../../backend/src/types.ts';
import { config } from '../../../local-config/index.ts';

const getSessionValues = (username: string) => {
  const sessionId = v4();
  const millisecondsIn30Days = 30 * 24 * 60 * 60 * 1000;  // Days * Hours * Minutes * Seconds * Milliseconds
  return {
    sessionid: sessionId,
    username,
    expiration: `${Date.now() + millisecondsIn30Days}`,
  };
};

const LoginForm = () => {
  const { setSession } = useContext(AppContext);
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [loginFailed, setLoginFailed] = useState(false);
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');


  const handleLoginButtonClick = async () => {
    setIsLoading(true);
    try {
      const response: User = await api.getUser(username);
      if (response?.password === password) {
        const session = getSessionValues(username);
        await api.createSession(session);
        localStorage.setItem(config.localStorageKey, session.sessionid);
        setSession(session);
        navigate('/');
      } else {
        setLoginFailed(true);
      }
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
        disabled={isLoading}
      >
        {isLoading ? 'Logging in...' : 'Login'}
      </Button>
      { loginFailed && (
        <h5>Login Failed</h5>
      )}
    </form>
  );
}

export default LoginForm;
