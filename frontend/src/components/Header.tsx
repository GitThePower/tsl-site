import {
  AppBar,
  Toolbar,
  Typography,
} from '@mui/material';
import { useContext } from 'react';
import { useLocation } from 'react-router-dom';
import LoginButton from './LoginButton';
import Logo from './Logo';
import ProfileButton from './ProfileButton';
import conditions from '../actions/conditions.ts';
import { AppContext } from '../App.tsx';

const Header = () => {
  const { session } = useContext(AppContext);
  const location = useLocation();

  return (
    <AppBar position='static'>
      <Toolbar style={{ 'display': 'flex', 'justifyContent': 'space-between', 'alignItems': 'center' }}>
        <Logo />
        <Typography variant='h6'>TSL Site</Typography>
        {
          (location.pathname === '/login' || location.pathname === '/profile') ?
            <div /> :
            (conditions.sessionIsActive(session)) ?
              <ProfileButton /> :
              <LoginButton />
        }
      </Toolbar>
    </AppBar>
  );
}

export default Header;
