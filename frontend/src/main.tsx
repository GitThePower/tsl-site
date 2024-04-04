import {
  AppBar,
  Toolbar,
  Typography,
} from '@mui/material';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import logo from './assets/vite.svg';
import LoginButton from './components/LoginButton';
import Home from './pages/home';
import Login from './pages/login';
import './main.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <header>
      <AppBar position="static">
        <Toolbar className='header-toolbar'>
          <img src={logo} alt="Your Logo" className='header-toolbar-logo' />
          <Typography variant="h6">TSL Site</Typography>
          <LoginButton />
        </Toolbar>
      </AppBar>
    </header>
    <main>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </main>
  </BrowserRouter>
)
