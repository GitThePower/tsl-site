import { Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const LoginButton = () => {
  const navigate = useNavigate();

  const handleLoginButtonClick = () => {
    navigate('/login');
  };

  return (
    <Button variant='contained' color='primary' onClick={handleLoginButtonClick}>
      Login
    </Button>
  );
}

export default LoginButton;
