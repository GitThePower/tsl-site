import { useNavigate } from 'react-router-dom';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';

const Login = () => {
  const navigate = useNavigate();

  const handleLoginClick = () => {
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
            />
            <TextField
              label="Password"
              type="password"
              margin="normal"
              variant="outlined"
              fullWidth
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
