import { Box, Button, Grid, TextField } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { ChangeEvent, useState } from 'react';

const Login = () => {
  const navigate = useNavigate();

  // Create state for username and password
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleUsernameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setUsername(event.target.value);
  };

  const handlePasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value);
  };

  const handleLoginClick = () => {
    // Include your login validation logic here using the username and password from the state

    navigate('/');
  };

  return (
    <Box className="container">
      <Grid container spacing={3} justifyContent="center">
        <Grid item xs={12} sm={6} alignSelf="center">
          <form>
            <TextField
              label="Username"
              margin="normal"
              variant="outlined"
              fullWidth
              value={username} // Bind input value to the state
              onChange={handleUsernameChange} // Update state on change 
            />
            <TextField
              label="Password"
              type="password"
              margin="normal"
              variant="outlined"
              fullWidth
              value={password} 
              onChange={handlePasswordChange} 
            />
            <Button variant="contained" type="submit" fullWidth onClick={handleLoginClick}>
              Login
            </Button>
          </form>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Login;
