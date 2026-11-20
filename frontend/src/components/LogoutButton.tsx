import { Button } from '@mui/material';
import { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../actions/api';
import { AppContext } from '../App';
import { config } from '../../../local-config';

const LogoutButton = () => {
  const { session, setCurrentUser, setSession } = useContext(AppContext);
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogoutButtonClick = async () => {
    setIsLoading(true);
    try {
      if (session.sessionid) {
        await api.deleteSession(session.sessionid);
      }
    } catch (e) {
      console.error(e);
    } finally {
      localStorage.removeItem(config.sessionIdLocalStorageKey);
      setSession({});
      setCurrentUser({});
      setIsLoading(false);
      navigate('/');
    }
  };

  return (
    <Button
      variant='contained'
      color='primary'
      type='button'
      disabled={isLoading}
      onClick={handleLogoutButtonClick}
    >
      {isLoading ? 'Logging out...' : 'Logout'}
    </Button>
  );
};

export default LogoutButton;
