import { AppContext } from '../App';
import { DarkMode, LightMode } from '@mui/icons-material';
import { IconButton, Tooltip } from '@mui/material';
import { useContext } from 'react';

const ThemeToggle = () => {
  const { mode, toggleColorMode } = useContext(AppContext);

  return (
    <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
      <IconButton
        aria-label='toggle dark/light theme'
        color='inherit'
        onClick={toggleColorMode}
      >
        {mode === 'dark' ? <LightMode /> : <DarkMode />}
      </IconButton>
    </Tooltip>
  );
};

export default ThemeToggle;
