import { Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/vite.svg';

const Logo = () => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate('/');
  };

  return (
    <Button onClick={handleClick}>
      <img src={logo} alt='Your Logo' style={{ 'height': '40px', 'marginRight': '10px' }} />
    </Button>
  );
}

export default Logo;
