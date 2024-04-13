import {
  AppBar,
  Toolbar,
  Typography,
} from '@mui/material';
import { useContext } from 'react';
import { useLocation } from 'react-router-dom';
import LoginPageButton from './LoginPageButton.tsx';
import Logo from './Logo';
import ProfileButton from './ProfileButton';
import conditions from '../actions/conditions.ts';
import { AppContext } from '../App.tsx';
import LogoutButton from './LogoutButton.tsx';

const Header = () => {
  const { session } = useContext(AppContext);
  const location = useLocation();

  return (
    <AppBar position='static'>
      <Toolbar style={{ 'display': 'flex', 'justifyContent': 'space-between', 'alignItems': 'center' }}>
        <Logo />
        <Typography variant='h6'>TSL Site</Typography>
        {
          (location.pathname === '/login') ?
            <div /> :
            (location.pathname === '/profile') ?
              <LogoutButton /> :
              (conditions.sessionIsActive(session)) ?
                <ProfileButton /> :
                <LoginPageButton />
        }
      </Toolbar>
    </AppBar>
  );
}

export default Header;
