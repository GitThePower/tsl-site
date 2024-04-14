import {
  AppBar,
  Toolbar,
  Typography,
} from '@mui/material';
import Logo from './Logo';

interface HeaderProps {
  HeaderButton: () => JSX.Element;
}

const Header = (props: HeaderProps) => {
  return (
    <AppBar position='static'>
      <Toolbar style={{ 'display': 'flex', 'justifyContent': 'space-between', 'alignItems': 'center' }}>
        <Logo />
        <Typography variant='h6'>TSL Site</Typography>
        <props.HeaderButton />
      </Toolbar>
    </AppBar>
  );
}

export default Header;
