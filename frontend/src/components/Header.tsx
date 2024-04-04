import {
  AppBar,
  Toolbar,
  Typography,
} from '@mui/material';
import { useContext } from 'react';
import { useLocation } from 'react-router-dom';
import GlobalStateContext from './GlobalStateContext';
import LoginButton from './LoginButton';
import Logo from './Logo';
import ProfileButton from './ProfileButton';
import '../main.css';

const Header = () => {
  const globalStateContext = useContext(GlobalStateContext);
  const location = useLocation();

  return (
    <AppBar position="static">
      <Toolbar className='header-toolbar'>
        <Logo />
        <Typography variant="h6">TSL Site</Typography>
        {
          (location.pathname === '/login') ?
            <div /> :
            (globalStateContext.isLoggedIn) ?
              <ProfileButton /> :
              <LoginButton />
        }
      </Toolbar>
    </AppBar>
  );
}

export default Header;
