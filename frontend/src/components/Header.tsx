import Logo from './Logo';
import ThemeToggle from './ThemeToggle';
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
} from '@mui/material';

interface HeaderProps {
  HeaderButton: () => JSX.Element;
}

const Header = (props: HeaderProps) => {
  return (
    <AppBar position='static'>
      <Toolbar sx={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
        <Logo />
        <Typography variant='h6'>TSL Site</Typography>
        <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
          <ThemeToggle />
          <props.HeaderButton />
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;

