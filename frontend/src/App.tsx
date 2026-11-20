import { League, Session, User } from '../../backend/src/types';
import { config } from '../../local-config';
import api from './actions/api';
import conditions from './actions/conditions';
import localStorageHelpers from './actions/localStorageHelpers';
import Admin from './pages/admin';
import Home from './pages/home';
import Login from './pages/login';
import NotFound from './pages/not-found';
import Profile from './pages/profile';
import {
  Box,
  CircularProgress,
  CssBaseline,
  PaletteMode,
  ThemeProvider,
  createTheme,
} from '@mui/material';
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

export const AppContext = createContext({
  currentUser: {} as User,
  isLeagueLoading: true,
  isSessionLoading: true,
  league: {} as League,
  mode: 'light' as PaletteMode,
  refreshActiveLeague: async () => {},
  session: {} as Session,
  setCurrentUser: {} as React.Dispatch<React.SetStateAction<User>>,
  setLeague: {} as React.Dispatch<React.SetStateAction<League>>,
  setSession: {} as React.Dispatch<React.SetStateAction<Session>>,
  toggleColorMode: () => {},
});

const LoadingScreen = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
    <CircularProgress />
  </Box>
);

const App = () => {
  const [currentUser, setCurrentUser] = useState({} as User);
  const [isLeagueLoading, setIsLeagueLoading] = useState(true);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
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

  const refreshActiveLeague = useCallback(async () => {
    localStorage.removeItem(config.leagueLocalStorageKey);
    const activeLeague = await localStorageHelpers.setLeagueInLocalStorage();
    setLeague(activeLeague);
  }, []);

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
      } catch (e) {
        console.error(e);
      } finally {
        setIsLeagueLoading(false);
      }
    };
    const getSessionFromSessionKey = async () => {
      if (!sessionKey) {
        setSession({});
        setCurrentUser({});
        setIsSessionLoading(false);
        return;
      }

      setIsSessionLoading(true);
      try {
        const fetchedSession = await api.getSession(sessionKey);
        setSession(fetchedSession);
        if (conditions.sessionIsActive(fetchedSession) && fetchedSession.username) {
          const fetchedUser = await api.getUser(fetchedSession.username);
          setCurrentUser(fetchedUser);
        } else {
          setCurrentUser({});
        }
      } catch (e) {
        console.error(e);
        localStorage.removeItem(config.sessionIdLocalStorageKey);
        setSession({});
        setCurrentUser({});
      } finally {
        setIsSessionLoading(false);
      }
    };
    getActiveLeague();
    getSessionFromSessionKey();
  }, [sessionKey]);

  return (
    <AppContext.Provider
      value={{
        currentUser,
        isLeagueLoading,
        isSessionLoading,
        league,
        mode,
        refreshActiveLeague,
        session,
        setCurrentUser,
        setLeague,
        setSession,
        toggleColorMode,
      }}
    >
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <Routes>
            <Route path='/' element={<Home />} />
            <Route path='/login' element={<Login />} />
            <Route
              path='/profile'
              element={
                isSessionLoading ? (
                  <LoadingScreen />
                ) : conditions.sessionIsActive(session) ? (
                  <Profile />
                ) : (
                  <NotFound />
                )
              }
            />
            <Route
              path='/admin'
              element={
                isSessionLoading ? (
                  <LoadingScreen />
                ) : conditions.userIsAdmin(session, currentUser) ? (
                  <Admin />
                ) : (
                  <NotFound />
                )
              }
            />
            <Route path='*' element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </AppContext.Provider>
  );
};

export default App;
