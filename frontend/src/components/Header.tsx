import {
  AppBar,
  Toolbar,
  Typography,
} from '@mui/material';
import { useLocation } from 'react-router-dom';
import LoginButton from './LoginButton';
import Logo from './Logo';
import ProfileButton from './ProfileButton';
import { config } from '../../../local-config';

const Header = () => {
  const location = useLocation();

  return (
    <AppBar position='static'>
      <Toolbar style={{ 'display': 'flex', 'justifyContent': 'space-between', 'alignItems': 'center' }}>
        <Logo />
        <Typography variant='h6'>TSL Site</Typography>
        {
          (location.pathname === '/login' || location.pathname === '/profile') ?
            <div /> :
            (localStorage.getItem(config.localStorageKey)) ?
              <ProfileButton /> :
              <LoginButton />
        }
      </Toolbar>
    </AppBar>
  );
}

export default Header;
