import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Home from './pages/home';
import Login from './pages/login';
import { GlobalStateProvider } from './components/GlobalStateContext';

const App = () => {
  return (
    <GlobalStateProvider>
      <BrowserRouter>
        <header>
          <Header />
        </header>
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
          </Routes>
        </main>
      </BrowserRouter>
    </GlobalStateProvider>
  );
}

export default App;
