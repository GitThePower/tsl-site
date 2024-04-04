import { Box, Button, Grid, TextField } from '@mui/material';
import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GlobalStateContext from '../components/GlobalStateContext';

const Login = () => {
  const globalStateContext = useContext(GlobalStateContext);
  const navigate = useNavigate();
  const [isLoading, setisLoading] = useState(false);
  const [loginClicked, setLoginClicked] = useState(false);
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');

  useEffect(() => {
    const getUser = async () => {
      globalStateContext.setIsLoggedIn(true);
      setisLoading(false);
    };
    if (loginClicked && password && username) {
      setisLoading(true);
      getUser()
      if (!isLoading) {
        setLoginClicked(false);
        setPassword('');
        setUsername('');
        navigate('/');
      }
    }
  }, [globalStateContext, isLoading, loginClicked, navigate, password, username]);

  const handleLoginClick = () => {
    setLoginClicked(true);
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
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
            <TextField
              label="Password"
              type="password"
              margin="normal"
              variant="outlined"
              fullWidth
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Button
              variant="contained"
              type="submit"
              fullWidth
              onClick={handleLoginClick}
            >
              Login
            </Button>
          </form>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Login;
