import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import logo from './assets/vite.svg';

import Login from './pages/login'
import Home from './pages/home'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <div>
    <header>
      <AppBar position="static">
        <Toolbar>
          <img src={logo} alt="Your Logo" style={{ height: '40px', marginRight: '10px' }} />
          <Typography variant="h6">TSL Site</Typography>
        </Toolbar>
      </AppBar>
    </header>
    <main>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </BrowserRouter>
    </main>
  </div>
)
