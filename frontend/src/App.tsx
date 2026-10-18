import { League, Session } from '../../backend/src/types';
import { config } from '../../local-config';
import api from './actions/api';
import conditions from './actions/conditions';
import localStorageHelpers from './actions/localStorageHelpers';
import Home from './pages/home';
import Login from './pages/login';
import NotFound from './pages/not-found';
import Profile from './pages/profile';
import {
  createTheme,
  CssBaseline,
  PaletteMode,
  ThemeProvider,
} from '@mui/material';
import {
  createContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

export const AppContext = createContext({
  isLeagueLoading: true,
  league: {} as League,
  mode: 'light' as PaletteMode,
  session: {} as Session,
  setLeague: {} as React.Dispatch<React.SetStateAction<League>>,
  setSession: {} as React.Dispatch<React.SetStateAction<Session>>,
  toggleColorMode: () => {},
});

const App = () => {
  const [isLeagueLoading, setIsLeagueLoading] = useState(true);
  const [league, setLeague] = useState({} as League);
  const [mode, setMode] = useState<PaletteMode>(() => localStorageHelpers.getThemeModeFromLocalStorage());
  const [session, setSession] = useState({} as Session);
  const sessionKey = localStorage.getItem(config.sessionIdLocalStorageKey);

  const toggleColorMode = () => {
    setMode((prevMode) => {
      const nextMode = prevMode === 'light' ? 'dark' : 'light';
      localStorageHelpers.setThemeModeInLocalStorage(nextMode);
      return nextMode;
    });
  };

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
        },
      }),
    [mode],
  );

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
    <AppContext.Provider value={{ isLeagueLoading, league, mode, session, setLeague, setSession, toggleColorMode }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
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
      </ThemeProvider>
    </AppContext.Provider>
  );
};

export default App;

