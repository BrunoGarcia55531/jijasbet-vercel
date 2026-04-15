import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [contraseña, setContraseña] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await axios.post('/api/auth/login', { email, contraseña });
      onLogin(response.data.token, response.data.usuario);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '2.5rem',
        width: '100%',
        maxWidth: '420px',
        position: 'relative',
        boxShadow: '0 25px 60px rgba(0,0,0,0.5)'
      }}>
        {/* Top accent line */}
        <div style={{
          position: 'absolute', top: 0, left: '10%', right: '10%', height: '1px',
          background: 'linear-gradient(90deg, transparent, var(--gold), transparent)'
        }} />

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            fontFamily: 'Rajdhani, sans-serif', fontSize: '2.2rem', fontWeight: 700,
            color: 'var(--gold)', letterSpacing: '4px', textTransform: 'uppercase',
            textShadow: '0 0 30px rgba(240,180,41,0.4)'
          }}>🎯 JIJASBET</div>
          <div style={{
            fontSize: '0.72rem', color: 'var(--text-muted)', letterSpacing: '3px',
            textTransform: 'uppercase', marginTop: '0.3rem', paddingBottom: '1.5rem',
            borderBottom: '1px solid var(--border)', marginBottom: '0'
          }}>Plataforma de Apuestas</div>
        </div>

        <h2 style={{ fontSize: '1.3rem', marginBottom: '1.5rem', color: 'var(--text)' }}>Iniciar Sesión</h2>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} required placeholder="tu@email.com" />
          </div>
          <div className="form-group">
            <label htmlFor="contraseña">Contraseña</label>
            <input id="contraseña" type="password" value={contraseña}
              onChange={(e) => setContraseña(e.target.value)} required placeholder="••••••••" />
          </div>
          <button type="submit" className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.5rem', padding: '0.9rem' }} disabled={loading}>
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          ¿No tienes cuenta?{' '}
          <Link to="/registro" style={{ color: 'var(--gold)', textDecoration: 'none', fontWeight: 600 }}>
            Regístrate aquí
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
