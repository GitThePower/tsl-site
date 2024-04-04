import { Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/vite.svg';
import '../main.css';

const Logo = () => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate('/');
  };

  return (
    <Button onClick={handleClick}>
      <img src={logo} alt="Your Logo" className='header-toolbar-logo' />
    </Button>
  );
}

export default Logo;
