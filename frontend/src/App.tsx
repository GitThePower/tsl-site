import { createContext, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import api from './actions/api';
import conditions from './actions/conditions';
import localStorageHelpers from './actions/localStorageHelpers';
import Home from './pages/home';
import Login from './pages/login';
import NotFound from './pages/not-found';
import Profile from './pages/profile';
import { League, Session } from '../../backend/src/types';
import { config } from '../../local-config';

export const AppContext = createContext({
  isLeagueLoading: true,
  league: {} as League,
  session: {} as Session,
  setLeague: {} as React.Dispatch<React.SetStateAction<League>>,
  setSession: {} as React.Dispatch<React.SetStateAction<Session>>,
});

const App = () => {
  const [isLeagueLoading, setIsLeagueLoading] = useState(true);
  const [league, setLeague] = useState({} as League);
  const [session, setSession] = useState({} as Session);
  const sessionKey = localStorage.getItem(config.sessionIdLocalStorageKey);

  useEffect(() => {
    const getActiveLeague = async () => {
      try {
        let activeLeague: League | undefined = localStorageHelpers.getLeagueFromLocalStorage();
        if (!activeLeague) {
          activeLeague = await localStorageHelpers.setLeagueInLocalStorage();
        }
        setLeague(activeLeague);
      } finally {
        setIsLeagueLoading(false);
      }
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
    <AppContext.Provider value={{ isLeagueLoading, league, session, setLeague, setSession }}>
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
