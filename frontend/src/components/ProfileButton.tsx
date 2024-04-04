import { Button } from '@mui/material';
// import { useNavigate } from 'react-router-dom';

const ProfileButton = () => {
  // const navigate = useNavigate();

  const handleProfileButtonButtonClick = () => {
    // navigate('/');
  };

  return (
    <Button variant="contained" color="primary" onClick={handleProfileButtonButtonClick}>
      Profile
    </Button>
  );
}

export default ProfileButton;
