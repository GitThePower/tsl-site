import { createContext, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import api from './actions/api';
import conditions from './actions/conditions';
import Home from './pages/home';
import Login from './pages/login';
import NotFound from './pages/not-found';
import Profile from './pages/profile';
import { League, Session } from '../../backend/src/types';
import { config } from '../../local-config';

export const AppContext = createContext({
  league: {} as League,
  session: {} as Session,
  setLeague: {} as React.Dispatch<React.SetStateAction<League>>,
  setSession: {} as React.Dispatch<React.SetStateAction<Session>>,
});

const App = () => {
  const [league, setLeague] = useState({} as League);
  const [session, setSession] = useState({} as Session);
  const sessionKey = localStorage.getItem(config.localStorageKey);

  useEffect(() => {
    const getActiveLeague = async () => {
      const leagues = await api.listLeagues();
      const activeLeague = leagues.filter((league) => league.isActive === true)[0];
      setLeague(activeLeague);
    };
    const getSessionFromSessionKey = async () => {
      if (sessionKey) {
        setSession(await api.getSession(sessionKey));
      }
    };
    getActiveLeague();
    getSessionFromSessionKey();
  }, [sessionKey]);

  return (
    <AppContext.Provider value={{ league, session, setLeague, setSession }}>
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
