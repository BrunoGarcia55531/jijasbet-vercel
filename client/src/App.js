import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Registro from './pages/Registro';
import Dashboard from './pages/Dashboard';
import NuevaApuesta from './pages/NuevaApuesta';
import AdminPanel from './pages/AdminPanel';
import Recargar from './pages/Recargar';
import './App.css';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [usuario, setUsuario] = useState(() => {
    const saved = localStorage.getItem('usuario');
    return saved ? JSON.parse(saved) : null;
  });

  const handleLogin = (nuevoToken, nuevoUsuario) => {
    setToken(nuevoToken);
    setUsuario(nuevoUsuario);
    localStorage.setItem('token', nuevoToken);
    localStorage.setItem('usuario', JSON.stringify(nuevoUsuario));
  };

  const handleLogout = () => {
    setToken(null);
    setUsuario(null);
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
  };

  return (
    <Router>
      <div className="App">
        {token && (
          <nav className="navbar">
            <div className="navbar-container">
              <h1 className="logo">🎯 JIJASBET</h1>
              <div className="nav-links">
                <span>Hola, {usuario?.nombre}</span>
                {usuario?.esAdmin && <a href="/admin">Panel Admin</a>}
                <a href="/dashboard">Mis Apuestas</a>
                <a href="/nueva-apuesta">Nueva Apuesta</a>
                <a href="/recargar">💳 Recargar</a>
                <button onClick={handleLogout} className="btn-logout">Salir</button>
              </div>
            </div>
          </nav>
        )}
        
        <Routes>
          {!token ? (
            <>
              <Route path="/login" element={<Login onLogin={handleLogin} />} />
              <Route path="/registro" element={<Registro onLogin={handleLogin} />} />
              <Route path="*" element={<Navigate to="/login" />} />
            </>
          ) : (
            <>
              <Route path="/dashboard" element={<Dashboard token={token} />} />
              <Route path="/nueva-apuesta" element={<NuevaApuesta token={token} usuario={usuario} />} />
              <Route path="/recargar" element={<Recargar token={token} />} />
              {usuario?.esAdmin && <Route path="/admin" element={<AdminPanel token={token} />} />}
              <Route path="*" element={<Navigate to="/dashboard" />} />
            </>
          )}
        </Routes>
      </div>
    </Router>
  );
}

export default App;
