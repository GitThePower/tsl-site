import { Box, Grid } from '@mui/material';
import Header from '../components/Header';
import LogoutButton from '../components/LogoutButton';
import UpdatePassword from '../components/UpdatePassword';
import UpdateDecklist from '../components/UpdateDecklist';

const Profile = () => {
  return (
    <div>
      <header>
        <Header HeaderButton={LogoutButton} />
      </header>
      <main>
        <Box className='container'>
          <Grid container spacing={3} justifyContent='center'>
            <Grid item xs={12} sm={6} alignSelf='center'>
              <UpdatePassword />
              <UpdateDecklist />
            </Grid>
          </Grid>
        </Box>
      </main>
    </div>
  );
};

export default Profile;
