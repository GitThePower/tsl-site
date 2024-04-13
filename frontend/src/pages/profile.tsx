import { Box, Grid } from '@mui/material';
import UpdatePassword from '../components/UpdatePassword';

const Profile = () => {
  return (
    <Box className='container'>
      <Grid container spacing={3} justifyContent='center'>
        <Grid item xs={12} sm={6} alignSelf='center'>
          <UpdatePassword />
        </Grid>
      </Grid>
    </Box>
  );
};

export default Profile;
