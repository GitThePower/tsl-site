import { Box, Button, Grid, TextField } from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../actions/api.ts';
import { config } from '../../../local-config/index.ts';

const Login = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [loginFailed, setLoginFailed] = useState(false);
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');

  const handleLogin = async () => {
    setIsLoading(true);

    try {
      const response = await api.getUser(username);
      if (response?.password === password) {
        localStorage.setItem(config.localStorageKey, 'true');
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
