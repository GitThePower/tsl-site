import { Box, Grid } from '@mui/material';
import LoginForm from '../components/LoginForm.tsx';

const Login = () => {
  return (
    <Box className='container'>
      <Grid container spacing={3} justifyContent='center'>
        <Grid item xs={12} sm={6} alignSelf='center'>
          <LoginForm />
        </Grid>
      </Grid>
    </Box>
  );
};

export default Login;
