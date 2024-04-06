import { Box, Button, Grid } from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Profile = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    setIsLoading(true);

    try {
      // const response = await authenticateUser(username, password); // Your async function
      localStorage.removeItem('tavernSealedLeagueDotComToken');
      if (!localStorage.getItem('tavernSealedLeagueDotComToken')) { // response success
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
            <Button
              variant='contained'
              type='submit'
              fullWidth
              onClick={handleSubmit}
            >
              {isLoading ? 'Logging out...' : 'Logout'}
            </Button>
          </form>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Profile;
