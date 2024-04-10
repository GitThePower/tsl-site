import { Box, Button, Grid, TextField } from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 } from 'uuid';
import api from '../actions/api.ts';
import { Session, User } from '../../../backend/src/types.ts';
import { config } from '../../../local-config/index.ts';

const setSession = async (username: string) => {
  const sessionId = v4();
  const millisecondsIn30Days = 30 * 24 * 60 * 60 * 1000;  // Days * Hours * Minutes * Seconds * Milliseconds
  const session: Session = {
    sessionid: sessionId,
    username,
    expiration: `${Date.now() + millisecondsIn30Days}`,
  }
  await api.createSession(session);
  localStorage.setItem(config.localStorageKey, sessionId);
}

const Login = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [loginFailed, setLoginFailed] = useState(false);
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      const response: User = await api.getUser(username);
      if (response?.password === password) {
        await setSession(username);
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
    <Box className='container'>
      <Grid container spacing={3} justifyContent='center'>
        <Grid item xs={12} sm={6} alignSelf='center'>
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
              onClick={handleLogin}
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </Button>
            { loginFailed && (
              <h6>Login Failed</h6>
            )}
          </form>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Login;
