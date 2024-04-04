import {
  AppBar,
  Toolbar,
  Typography,
} from '@mui/material';
import { useLocation } from 'react-router-dom';
import LoginButton from './LoginButton';
import Logo from './Logo';
import '../main.css';

const Header = () => {
  const location = useLocation();

  return (
    <AppBar position="static">
      <Toolbar className='header-toolbar'>
        <Logo />
        <Typography variant="h6">TSL Site</Typography>
        {
          (location.pathname === '/login') ?
            <h1/> :
            <LoginButton />
        }
      </Toolbar>
    </AppBar>
  );
}

export default Header;
