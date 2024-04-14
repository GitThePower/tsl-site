import { Box, Grid } from '@mui/material';
import Header from '../components/Header.tsx';
import LoginForm from '../components/LoginForm.tsx';

const Login = () => {
  return (
    <div>
      <header>
        <Header HeaderButton={() => <div />} />
      </header>
      <main>
        <Box className='container'>
          <Grid container spacing={3} justifyContent='center'>
            <Grid item xs={12} sm={6} alignSelf='center'>
              <LoginForm />
            </Grid>
          </Grid>
        </Box>
      </main>
    </div>
  );
};

export default Login;
