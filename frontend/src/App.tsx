import { createContext, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import api from './actions/api';
import conditions from './actions/conditions';
import Home from './pages/home';
import Login from './pages/login';
import NotFound from './pages/not-found';
import Profile from './pages/profile';
import { Session } from '../../backend/src/types';
import { config } from '../../local-config';

export const AppContext = createContext({
  session: {} as Session,
  setSession: {} as React.Dispatch<React.SetStateAction<Session>>,
});

const App = () => {
  const [session, setSession] = useState({} as Session);
  const sessionKey = localStorage.getItem(config.localStorageKey);

  useEffect(() => {
    const getSessionFromSessionKey = async () => {
      if (sessionKey) {
        setSession(await api.getSession(sessionKey));
      }
    };
    getSessionFromSessionKey();
  }, [sessionKey]);

  return (
    <AppContext.Provider value={{ session, setSession }}>
      <BrowserRouter>
        <Routes>
          <Route path='/' element={<Home />} />
          <Route path='/login' element={<Login />} />
          <Route path='/profile' element={(conditions.sessionIsActive(session)) ?
            <Profile /> :
            <NotFound />
          } />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AppContext.Provider>
  );
}

export default App;
