import { Button } from '@mui/material';
import { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../App';
import { config } from '../../../local-config';

const LogoutButton = () => {
  const { setSession } = useContext(AppContext);
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogoutButtonClick = () => {
    setIsLoading(true);
    try {
      localStorage.removeItem(config.sessionIdLocalStorageKey);
      setSession({});
      navigate('/');
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant='contained'
      color='primary'
      type='submit'
      onClick={handleLogoutButtonClick}
    >
      {isLoading ? 'Logging out...' : 'Logout'}
    </Button>
  );
}

export default LogoutButton;
