import {
  AppBar,
  Toolbar,
  Typography,
} from '@mui/material';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginButton from './components/LoginButton';
import Logo from './components/Logo';
import Home from './pages/home';
import Login from './pages/login';
import './main.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <header>
      <AppBar position="static">
        <Toolbar className='header-toolbar'>
          <Logo />
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
