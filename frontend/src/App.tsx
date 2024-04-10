import { createContext, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import api from './actions/api';
import Header from './components/Header';
import Home from './pages/home';
import Login from './pages/login';
import Profile from './pages/profile';
import { Session } from '../../backend/src/types';
import { config } from '../../local-config';

export const AppContext = createContext({
  session: {} as Session,
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
    <AppContext.Provider value={{ session }}>
      <BrowserRouter>
        <header>
          <Header />
        </header>
        <main>
          <Routes>
            <Route path='/' element={<Home />} />
            <Route path='/login' element={<Login />} />
            <Route path='/profile' element={<Profile />} />
          </Routes>
        </main>
      </BrowserRouter>
    </AppContext.Provider>
  );
}

export default App;
