import conditions from '../actions/conditions';
import { AppContext } from '../App';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';
import {
  AppBar,
  Box,
  Button,
  Toolbar,
  Typography,
} from '@mui/material';
import { useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface HeaderProps {
  HeaderButton: () => JSX.Element;
}

const Header = (props: HeaderProps) => {
  const { currentUser, session } = useContext(AppContext);
  const location = useLocation();
  const navigate = useNavigate();
  const showAdminButton = conditions.userIsAdmin(session, currentUser) && location.pathname !== '/admin';

  return (
    <AppBar position='static'>
      <Toolbar sx={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
        <Logo />
        <Typography variant='h6'>TSL Site</Typography>
        <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
          <ThemeToggle />
          {showAdminButton && (
            <Button color='secondary' variant='contained' onClick={() => navigate('/admin')}>
              Admin
            </Button>
          )}
          <props.HeaderButton />
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
