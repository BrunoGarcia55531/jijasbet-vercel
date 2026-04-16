import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

function Dashboard({ token }) {
  const [apuestas, setApuestas] = useState([]);
  const [saldo, setSaldo] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todas');

  const cargarDatos = useCallback(async () => {
    try {
      const [apuestasRes, recargasRes] = await Promise.all([
        axios.get('/api/apuestas/mis-apuestas', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/recargas/mis-recargas',  { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setApuestas(apuestasRes.data);
      setSaldo(recargasRes.data.saldo);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  const apuestasFiltradas = apuestas.filter(a =>
    filtro === 'todas' ? true : a.estado === filtro
  );

  const estadisticas = {
    total:    apuestas.length,
    activas:  apuestas.filter(a => a.estado === 'activa').length,
    ganadas:  apuestas.filter(a => a.estado === 'ganada').length,
    perdidas: apuestas.filter(a => a.estado === 'perdida').length,
    montoApostado: apuestas
      .filter(a => a.estado !== 'cancelada')
      .reduce((s, a) => s + parseFloat(a.montoApuesta || 0), 0),
    gananciasObtenidas: apuestas
      .filter(a => a.estado === 'ganada')
      .reduce((s, a) => s + parseFloat(a.montoGanancia || 0), 0)
  };

  const estadoConfig = {
    activa:   { label: 'Activa',    color: '#f0c040', icon: '⏳' },
    ganada:   { label: 'Ganada',    color: '#4CAF50', icon: '✅' },
    perdida:  { label: 'Perdida',   color: '#e74c3c', icon: '❌' },
    cancelada:{ label: 'Cancelada', color: '#888',    icon: '🚫' }
  };

  const filtros = [
    { key: 'todas',    label: 'TODAS' },
    { key: 'activa',   label: '⏳ ACTIVAS' },
    { key: 'ganada',   label: '✅ GANADAS' },
    { key: 'perdida',  label: '❌ PERDIDAS' },
    { key: 'cancelada',label: '🚫 CANCELADAS' }
  ];

  if (loading) return (
    <div className="container" style={{ textAlign: 'center', marginTop: '2rem' }}>Cargando...</div>
  );

  return (
    <div className="container">
      <h1 style={{ color: 'white', marginBottom: '2rem', textAlign: 'center' }}>📊 Mis Apuestas</h1>

      <div className="stats-grid">
        <div className="stat-card">
          <h3 style={{ color: '#4CAF50' }}>S/. {parseFloat(saldo).toFixed(2)}</h3>
          <p>Saldo Disponible</p>
        </div>
        <div className="stat-card">
          <h3>{estadisticas.activas}</h3>
          <p>Apuestas Activas</p>
        </div>
        <div className="stat-card">
          <h3 style={{ color: '#4CAF50' }}>{estadisticas.ganadas}</h3>
          <p>Ganadas</p>
        </div>
        <div className="stat-card">
          <h3 style={{ color: '#e74c3c' }}>{estadisticas.perdidas}</h3>
          <p>Perdidas</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ color: '#ccc', fontSize: '0.9rem' }}>Total apostado: </span>
          <strong style={{ color: 'white' }}>S/. {estadisticas.montoApostado.toFixed(2)}</strong>
          <span style={{ color: '#ccc', fontSize: '0.9rem', marginLeft: '1.5rem' }}>Ganancias cobradas: </span>
          <strong style={{ color: '#4CAF50' }}>S/. {estadisticas.gananciasObtenidas.toFixed(2)}</strong>
        </div>
        <a href="/recargar" className="btn btn-success" style={{ fontSize: '0.9rem' }}>+ Recargar Saldo</a>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: '1.5rem' }}>Filtrar por estado</h2>
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {filtros.map(f => (
            <button
              key={f.key}
              className={`btn ${filtro === f.key ? 'btn-primary' : 'btn-warning'}`}
              onClick={() => setFiltro(f.key)}
            >
              {f.label}
              {f.key !== 'todas' && (
                <span style={{ marginLeft: '0.4rem', opacity: 0.8 }}>
                  ({apuestas.filter(a => a.estado === f.key).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {apuestasFiltradas.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
            No hay apuestas con este estado
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Partido</th>
                <th>Mi Apuesta</th>
                <th>Monto</th>
                <th>Cuota</th>
                <th>Ganancia Potencial</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {apuestasFiltradas.map(apuesta => {
                const cfg = estadoConfig[apuesta.estado] || estadoConfig.activa;
                return (
                  <tr key={apuesta.id}>
                    <td>
                      <strong>{apuesta.Evento?.equipoLocal} vs {apuesta.Evento?.equipoVisitante}</strong>
                      <br />
                      <small style={{ color: '#666' }}>{apuesta.Evento?.liga}</small>
                    </td>
                    <td>
                      {apuesta.tipoApuesta === 'local'     && `🏠 ${apuesta.Evento?.equipoLocal}`}
                      {apuesta.tipoApuesta === 'empate'    && '🤝 Empate'}
                      {apuesta.tipoApuesta === 'visitante' && `✈️ ${apuesta.Evento?.equipoVisitante}`}
                    </td>
                    <td>S/. {Number(apuesta.montoApuesta).toFixed(2)}</td>
                    <td>{Number(apuesta.cuota || 1).toFixed(2)}x</td>
                    <td>S/. {Number(apuesta.montoGanancia).toFixed(2)}</td>
                    <td>
                      <span style={{ color: cfg.color, fontWeight: 'bold' }}>
                        {cfg.icon} {cfg.label}
                      </span>
                      {apuesta.estado === 'ganada' && (
                        <div style={{ fontSize: '0.8rem', color: '#4CAF50', marginTop: '0.2rem' }}>
                          +S/. {Number(apuesta.montoGanancia).toFixed(2)} acreditados
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
