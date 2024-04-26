import { Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const LoginPageButton = () => {
  const navigate = useNavigate();

  const handleLoginPageButtonClick = () => {
    navigate('/login');
  };

  return (
    <Button variant='contained' color='primary' onClick={handleLoginPageButtonClick}>
      Login
    </Button>
  );
}

export default LoginPageButton;
