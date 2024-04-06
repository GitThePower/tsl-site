import { Box, Button, Grid, TextField } from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');

  const handleSubmit = async () => {
    setIsLoading(true);

    try {
      // const response = await authenticateUser(username, password); // Your async function
      localStorage.setItem('tavernSealedLeagueDotComToken', 'true');
      if (localStorage.getItem('tavernSealedLeagueDotComToken')) { // response success
        // Successful login
        navigate('/');
      } else {
        // Handle failed login, display error message
      }
    } catch (error) {
      // Handle errors, display error message
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box className='container'>
      <Grid container spacing={3} justifyContent='center'>
        <Grid item xs={12} sm={6} alignSelf='center'>
          <form>
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
              onClick={handleSubmit}
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </Button>
          </form>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Login;
