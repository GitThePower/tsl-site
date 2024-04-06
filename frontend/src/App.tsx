import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Home from './pages/home';
import Login from './pages/login';
import Profile from './pages/profile';

const App = () => {
  return (
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
  );
}

export default App;
