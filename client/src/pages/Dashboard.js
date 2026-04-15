import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

function Dashboard({ token }) {
  const [apuestas, setApuestas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('todas');

  const cargarApuestas = useCallback(async () => {
    try {
      const response = await axios.get('/api/apuestas/mis-apuestas', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setApuestas(response.data);
    } catch (error) {
      console.error('Error cargando apuestas:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    cargarApuestas();
  }, [cargarApuestas]);

  const apuestasFiltradas = apuestas.filter(apuesta => {
    if (filtro === 'todas') return true;
    return apuesta.estadoPago === filtro;
  });

  const estadisticas = {
    total: apuestas.length,
    pendientes: apuestas.filter(a => a.estadoPago === 'pendiente').length,
    verificadas: apuestas.filter(a => a.estadoPago === 'verificado').length,
    rechazadas: apuestas.filter(a => a.estadoPago === 'rechazado').length,
    montoTotal: apuestas.reduce((sum, a) => sum + parseFloat(a.montoApuesta || 0), 0),
    montoGanancia: apuestas.filter(a => a.apuestaGanada).reduce((sum, a) => sum + parseFloat(a.montoGanancia || 0), 0)
  };

  if (loading) {
    return <div className="container" style={{ textAlign: 'center', marginTop: '2rem' }}>Cargando...</div>;
  }

  return (
    <div className="container">
      <h1 style={{ color: 'white', marginBottom: '2rem', textAlign: 'center' }}>📊 Mis Apuestas</h1>

      {/* Estadísticas */}
      <div className="stats-grid">
        <div className="stat-card">
          <h3>{estadisticas.total}</h3>
          <p>Total de Apuestas</p>
        </div>
        <div className="stat-card">
          <h3>S/. {estadisticas.montoTotal.toFixed(2)}</h3>
          <p>Monto Total Apostado</p>
        </div>
        <div className="stat-card">
          <h3>{estadisticas.verificadas}</h3>
          <p>Apuestas Verificadas</p>
        </div>
        <div className="stat-card">
          <h3>S/. {estadisticas.montoGanancia}</h3>
          <p>Ganancias Potenciales</p>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: '1.5rem' }}>Filtrar por estado</h2>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <button 
            className={`btn ${filtro === 'todas' ? 'btn-primary' : 'btn-warning'}`}
            onClick={() => setFiltro('todas')}
          >
            Todas
          </button>
          <button 
            className={`btn ${filtro === 'pendiente' ? 'btn-primary' : 'btn-warning'}`}
            onClick={() => setFiltro('pendiente')}
          >
            Pendientes
          </button>
          <button 
            className={`btn ${filtro === 'verificado' ? 'btn-primary' : 'btn-success'}`}
            onClick={() => setFiltro('verificado')}
          >
            Verificadas
          </button>
          <button 
            className={`btn ${filtro === 'rechazado' ? 'btn-primary' : 'btn-danger'}`}
            onClick={() => setFiltro('rechazado')}
          >
            Rechazadas
          </button>
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
                <th>Tipo Apuesta</th>
                <th>Monto</th>
                <th>Cuota</th>
                <th>Ganancia Potencial</th>
                <th>Estado Pago</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {apuestasFiltradas.map(apuesta => (
                <tr key={apuesta.id}>
                  <td>
                    <strong>{apuesta.Evento?.equipoLocal} vs {apuesta.Evento?.equipoVisitante}</strong>
                    <br />
                    <small style={{ color: '#666' }}>{apuesta.Evento?.liga}</small>
                  </td>
                  <td>
                    {apuesta.tipoApuesta === 'local' && '🏠 Local'}
                    {apuesta.tipoApuesta === 'empate' && '🤝 Empate'}
                    {apuesta.tipoApuesta === 'visitante' && '✈️ Visitante'}
                  </td>
                  <td>S/. {Number(apuesta.montoApuesta).toFixed(2)}</td>
                  <td>{Number(apuesta.cuota || apuesta.Evento?.cuota || 1).toFixed(2)}</td>
                  <td>S/. {Number(apuesta.montoGanancia).toFixed(2)}</td>
                  <td>
                    <span className={`status status-${apuesta.estadoPago}`}>
                      {apuesta.estadoPago}
                    </span>
                  </td>
                  <td>
                    {apuesta.estadoPago === 'pendiente' && (
                      <a href={`/nueva-apuesta?edit=${apuesta.id}`} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
                        Completar Pago
                      </a>
                    )}
                    {apuesta.estadoPago === 'rechazado' && (
                      <div style={{ color: '#e74c3c' }}>
                        <strong>Rechazado</strong>
                        <p style={{ fontSize: '0.85rem' }}>{apuesta.motivoRechazo}</p>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
