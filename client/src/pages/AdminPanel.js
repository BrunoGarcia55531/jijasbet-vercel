import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

function AdminPanel({ token }) {
  const [apuestas, setApuestas] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [estadisticas, setEstadisticas] = useState({});
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('pendiente');
  const [apuestaSeleccionada, setApuestaSeleccionada] = useState(null);
  const [motivo, setMotivo] = useState('');
  const [resultado, setResultado] = useState('');
  const [mostrarModal, setMostrarModal] = useState(false);
  const [tipoAccion, setTipoAccion] = useState(''); // 'verificar', 'rechazar', 'resultado'
  const [pestaña, setPestaña] = useState('apuestas'); // 'apuestas' o 'eventos'

  // Estado para crear eventos
  const [nuevoEvento, setNuevoEvento] = useState({
    equipoLocal: '',
    equipoVisitante: '',
    liga: 'Primera División',
    fechaPartido: '',
    horaPartido: '',
    cuotaLocal: '',
    cuotaEmpate: '',
    cuotaVisitante: ''
  });
  const [cargandoEvento, setCargandoEvento] = useState(false);
  const [mensajeEvento, setMensajeEvento] = useState('');
  const [errorEvento, setErrorEvento] = useState('');

  const ligas = [
    'Primera División',
    'Copa Libertadores',
    'Copa Sudamericana',
    'LaLiga',
    'Premier League',
    'Serie A',
    'Ligue 1',
    'Bundesliga'
  ];

  const equiposSugeridos = [
    'Alianza Lima', 'Universitario', 'Sporting Cristal', 'Boca Juniors', 'River Plate',
    'Barcelona', 'Real Madrid', 'Bayern Munich', 'Manchester United', 'Liverpool',
    'Manchester City', 'PSG', 'Inter Milan', 'Juventus', 'AC Milan'
  ];

  const cargarDatos = useCallback(async () => {
    try {
      const [apuestasRes, estadRes, eventosRes] = await Promise.all([
        axios.get('/api/admin/todas-apuestas', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('/api/admin/estadisticas', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('/api/admin/eventos', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      setApuestas(apuestasRes.data);
      setEstadisticas(estadRes.data);
      setEventos(eventosRes.data);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    cargarDatos();
    const intervalo = setInterval(cargarDatos, 3000); // Actualizar cada 3 segundos
    return () => clearInterval(intervalo);
  }, [cargarDatos]);

  const abrirModal = (apuesta, tipo) => {
    setApuestaSeleccionada(apuesta);
    setTipoAccion(tipo);
    setMostrarModal(true);
    setMotivo('');
    setResultado('');
  };

  const handleVerificar = async () => {
    try {
      await axios.put('api/admin/verificar/${apuestaSeleccionada.id}', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMostrarModal(false);
      cargarDatos();
      alert('✅ Pago verificado correctamente');
    } catch (error) {
      alert('❌ Error: ' + error.response?.data?.error);
    }
  };

  const handleRechazar = async () => {
    if (!motivo.trim()) {
      alert('Por favor ingresa el motivo del rechazo');
      return;
    }

    try {
      await axios.put('/api/admin/rechazar/${apuestaSeleccionada.id}', 
        { motivo },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMostrarModal(false);
      cargarDatos();
      alert('❌ Pago rechazado');
    } catch (error) {
      alert('Error: ' + error.response?.data?.error);
    }
  };

  const handleResultado = async () => {
    if (!resultado.trim()) {
      alert('Por favor selecciona el resultado');
      return;
    }

    try {
      await axios.put('/api/admin/resultado/${apuestaSeleccionada.id}', 
        { resultado },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMostrarModal(false);
      cargarDatos();
      alert('✓ Resultado establecido');
    } catch (error) {
      alert('Error: ' + error.response?.data?.error);
    }
  };

  const handleCrearEvento = async (e) => {
    e.preventDefault();
    setErrorEvento('');
    setMensajeEvento('');

    if (!nuevoEvento.equipoLocal || !nuevoEvento.equipoVisitante || !nuevoEvento.fechaPartido || !nuevoEvento.cuotaLocal || !nuevoEvento.cuotaEmpate || !nuevoEvento.cuotaVisitante) {
      setErrorEvento('Todos los campos son requeridos');
      return;
    }

    setCargandoEvento(true);
    try {
      const fechaHora = nuevoEvento.horaPartido 
        ? `${nuevoEvento.fechaPartido}T${nuevoEvento.horaPartido}:00`
        : `${nuevoEvento.fechaPartido}T12:00:00`;

      await axios.post('/api/admin/eventos', {
        equipoLocal: nuevoEvento.equipoLocal,
        equipoVisitante: nuevoEvento.equipoVisitante,
        liga: nuevoEvento.liga,
        fechaPartido: fechaHora,
        cuotaLocal: parseFloat(nuevoEvento.cuotaLocal),
        cuotaEmpate: parseFloat(nuevoEvento.cuotaEmpate),
        cuotaVisitante: parseFloat(nuevoEvento.cuotaVisitante)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setMensajeEvento('✅ Evento creado exitosamente');
      setNuevoEvento({
        equipoLocal: '',
        equipoVisitante: '',
        liga: 'Primera División',
        fechaPartido: '',
        horaPartido: '',
        cuotaLocal: '',
        cuotaEmpate: '',
        cuotaVisitante: ''
      });
      
      setTimeout(() => {
        cargarDatos();
        setMensajeEvento('');
      }, 1500);
    } catch (error) {
      setErrorEvento(error.response?.data?.error || 'Error al crear evento');
    } finally {
      setCargandoEvento(false);
    }
  };

  const apuestasFiltradas = apuestas.filter(a => {
    if (filtro === 'pendiente') return a.estadoPago === 'pendiente';
    if (filtro === 'verificadas') return a.estadoPago === 'verificado';
    if (filtro === 'rechazadas') return a.estadoPago === 'rechazado';
    if (filtro === 'sin-resultado') return a.estadoPago === 'verificado' && !a.resultadoPartido;
    return true;
  });

  if (loading) {
    return <div className="container" style={{ textAlign: 'center', marginTop: '2rem' }}>Cargando panel...</div>;
  }

  return (
    <div className="container">
      <h1 style={{ color: 'white', marginBottom: '2rem', textAlign: 'center' }}>⚙️ Panel Administrativo</h1>

      {/* Estadísticas */}
      <div className="stats-grid">
        <div className="stat-card">
          <h3>{estadisticas.totalApuestas}</h3>
          <p>Total de Apuestas</p>
        </div>
        <div className="stat-card">
          <h3>{estadisticas.apuestasPendientes}</h3>
          <p>Pendientes de Verificar</p>
        </div>
        <div className="stat-card">
          <h3>{estadisticas.apuestasVerificadas}</h3>
          <p>Verificadas</p>
        </div>
        <div className="stat-card">
          <h3>S/. {estadisticas.totalMonto}</h3>
          <p>Monto Total</p>
        </div>
      </div>

      {/* Pestañas */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <button
          className={`btn ${pestaña === 'eventos' ? 'btn-primary' : 'btn-warning'}`}
          onClick={() => setPestaña('eventos')}
        >
          📅 Crear Eventos
        </button>
        <button
          className={`btn ${pestaña === 'apuestas' ? 'btn-primary' : 'btn-warning'}`}
          onClick={() => setPestaña('apuestas')}
        >
          🎲 Gestionar Apuestas
        </button>
      </div>

      {/* SECCIÓN: CREAR EVENTOS */}
      {pestaña === 'eventos' && (
        <>
          <div className="card">
            <h2 style={{ marginBottom: '1.5rem' }}>📅 Crear Nuevo Evento</h2>

            {errorEvento && (
              <div style={{
                background: '#f8d7da',
                color: '#721c24',
                padding: '1rem',
                borderRadius: '4px',
                marginBottom: '1rem'
              }}>
                {errorEvento}
              </div>
            )}

            {mensajeEvento && (
              <div style={{
                background: '#d4edda',
                color: '#155724',
                padding: '1rem',
                borderRadius: '4px',
                marginBottom: '1rem'
              }}>
                {mensajeEvento}
              </div>
            )}

            <form onSubmit={handleCrearEvento}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label>Equipo Local</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      list="equipos-sugeridos"
                      type="text"
                      value={nuevoEvento.equipoLocal}
                      onChange={(e) => setNuevoEvento({ ...nuevoEvento, equipoLocal: e.target.value })}
                      placeholder="Ej: Alianza Lima"
                      required
                    />
                    <datalist id="equipos-sugeridos">
                      {equiposSugeridos.map(eq => (
                        <option key={eq} value={eq} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <div>
                  <label>Equipo Visitante</label>
                  <input
                    list="equipos-sugeridos2"
                    type="text"
                    value={nuevoEvento.equipoVisitante}
                    onChange={(e) => setNuevoEvento({ ...nuevoEvento, equipoVisitante: e.target.value })}
                    placeholder="Ej: Universitario"
                    required
                  />
                  <datalist id="equipos-sugeridos2">
                    {equiposSugeridos.map(eq => (
                      <option key={eq} value={eq} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label>Liga</label>
                  <select
                    value={nuevoEvento.liga}
                    onChange={(e) => setNuevoEvento({ ...nuevoEvento, liga: e.target.value })}
                  >
                    {ligas.map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label>Fecha del Partido</label>
                  <input
                    type="date"
                    value={nuevoEvento.fechaPartido}
                    onChange={(e) => setNuevoEvento({ ...nuevoEvento, fechaPartido: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label>Hora (opcional)</label>
                  <input
                    type="time"
                    value={nuevoEvento.horaPartido}
                    onChange={(e) => setNuevoEvento({ ...nuevoEvento, horaPartido: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label>Cuota - Ganador Local</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={nuevoEvento.cuotaLocal}
                  onChange={(e) => setNuevoEvento({ ...nuevoEvento, cuotaLocal: e.target.value })}
                  placeholder="Ej: 1.50"
                  required
                />
                <small style={{ display: 'block', marginTop: '0.3rem', color: '#999' }}>
                  Si apuesto S/. 100: S/. {(100 * parseFloat(nuevoEvento.cuotaLocal || 1)).toFixed(2)}
                </small>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label>Cuota - Empate</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={nuevoEvento.cuotaEmpate}
                  onChange={(e) => setNuevoEvento({ ...nuevoEvento, cuotaEmpate: e.target.value })}
                  placeholder="Ej: 3.00"
                  required
                />
                <small style={{ display: 'block', marginTop: '0.3rem', color: '#999' }}>
                  Si apuesto S/. 100: S/. {(100 * parseFloat(nuevoEvento.cuotaEmpate || 1)).toFixed(2)}
                </small>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label>Cuota - Ganador Visitante</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={nuevoEvento.cuotaVisitante}
                  onChange={(e) => setNuevoEvento({ ...nuevoEvento, cuotaVisitante: e.target.value })}
                  placeholder="Ej: 2.20"
                  required
                />
                <small style={{ display: 'block', marginTop: '0.3rem', color: '#999' }}>
                  Si apuesto S/. 100: S/. {(100 * parseFloat(nuevoEvento.cuotaVisitante || 1)).toFixed(2)}
                </small>
              </div>

              <button
                type="submit"
                className="btn btn-success"
                disabled={cargandoEvento}
              >
                {cargandoEvento ? 'Creando...' : '✅ Crear Evento'}
              </button>
            </form>
          </div>

          {/* Lista de eventos creados */}
          <div className="card" style={{ marginTop: '2rem' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>📋 Eventos Activos</h2>
            {eventos.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
                No hay eventos creados aún
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Partido</th>
                      <th>Liga</th>
                      <th>Fecha</th>
                      <th>Cuotas (L/E/V)</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventos.map(evento => (
                      <tr key={evento.id}>
                        <td>
                          <strong>{evento.equipoLocal} vs {evento.equipoVisitante}</strong>
                        </td>
                        <td>{evento.liga}</td>
                        <td>{new Date(evento.fechaPartido).toLocaleDateString('es-PE')}</td>
                        <td>
                          <strong>{Number(evento.cuotaLocal)?.toFixed(2) || Number(evento.cuota)?.toFixed(2) || 'N/A'}x</strong> / {Number(evento.cuotaEmpate)?.toFixed(2) || 'N/A'}x / <strong>{Number(evento.cuotaVisitante)?.toFixed(2) || 'N/A'}x</strong>
                        </td>
                        <td>
                          <span className={`status status-${evento.estado === 'activo' ? 'pendiente' : evento.estado}`}>
                            {evento.estado}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* SECCIÓN: GESTIONAR APUESTAS */}
      {pestaña === 'apuestas' && (
        <div className="card">
          <h2 style={{ marginBottom: '1.5rem' }}>🔍 Gestionar Apuestas</h2>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {['pendiente', 'verificadas', 'rechazadas', 'sin-resultado', 'todas'].map(f => (
            <button
              key={f}
              className={`btn ${filtro === f ? 'btn-primary' : 'btn-warning'}`}
              onClick={() => setFiltro(f)}
              style={{ fontSize: '0.9rem' }}
            >
              {f === 'pendiente' && `⏳ Pendientes (${apuestas.filter(a => a.estadoPago === 'pendiente').length})`}
              {f === 'verificadas' && `✅ Verificadas`}
              {f === 'rechazadas' && `❌ Rechazadas`}
              {f === 'sin-resultado' && `📊 Sin Resultado`}
              {f === 'todas' && `👁️ Todas`}
            </button>
          ))}
        </div>

        {apuestasFiltradas.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
            No hay apuestas para este filtro
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Partido</th>
                  <th>Tipo</th>
                  <th>Monto</th>
                  <th>Estado Pago</th>
                  <th>Comprobante</th>
                  <th>Resultado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {apuestasFiltradas.map(apuesta => (
                  <tr key={apuesta.id}>
                    <td>
                      <strong>{apuesta.nombreUsuario}</strong>
                      <br />
                      <small style={{ color: '#666' }}>{String(apuesta.id).slice(-6)}</small>
                    </td>
                    <td>
                      {apuesta.Evento ? (
                        <>
                          {apuesta.Evento.equipoLocal} vs {apuesta.Evento.equipoVisitante}
                          <br />
                          <small>{apuesta.Evento.liga}</small>
                        </>
                      ) : (
                        <small style={{ color: '#999' }}>Sin evento</small>
                      )}
                    </td>
                    <td>
                      {apuesta.tipoApuesta === 'local' && '🏠 Local'}
                      {apuesta.tipoApuesta === 'empate' && '🤝 Empate'}
                      {apuesta.tipoApuesta === 'visitante' && '✈️ Visitante'}
                    </td>
                    <td>S/. {Number(apuesta.montoApuesta).toFixed(2)}</td>
                    <td>
                      <span className={`status status-${apuesta.estadoPago}`}>
                        {apuesta.estadoPago}
                      </span>
                    </td>
                    <td>
                      {apuesta.comprobante && (
                        <button
                          className="btn btn-primary"
                          onClick={() => window.open(apuesta.comprobante)}
                          style={{ fontSize: '0.85rem' }}
                        >
                          Ver Imagen
                        </button>
                      )}
                    </td>
                    <td>
                      {apuesta.resultadoPartido ? (
                        <span style={{
                          background: apuesta.apuestaGanada ? '#d4edda' : '#f8d7da',
                          color: apuesta.apuestaGanada ? '#155724' : '#721c24',
                          padding: '0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.9rem'
                        }}>
                          {apuesta.apuestaGanada ? '✅ GANADA' : '❌ PERDIDA'}
                        </span>
                      ) : (
                        <span style={{ color: '#666' }}>-</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                        {apuesta.estadoPago === 'pendiente' && (
                          <>
                            <button
                              className="btn btn-success"
                              onClick={() => abrirModal(apuesta, 'verificar')}
                              style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                            >
                              ✅ Verificar
                            </button>
                            <button
                              className="btn btn-danger"
                              onClick={() => abrirModal(apuesta, 'rechazar')}
                              style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                            >
                              ❌ Rechazar
                            </button>
                          </>
                        )}
                        {apuesta.estadoPago === 'verificado' && !apuesta.resultadoPartido && (
                          <button
                            className="btn btn-primary"
                            onClick={() => abrirModal(apuesta, 'resultado')}
                            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                          >
                            📊 Resultado
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* Modal */}
      {mostrarModal && (
        <div className="modal show" onClick={() => setMostrarModal(false)}>
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: '600px', overflowY: 'auto' }}
          >
            {tipoAccion === 'verificar' && (
              <>
                <h2>✅ Verificar Pago</h2>
                <p style={{ marginTop: '1rem', marginBottom: '1rem' }}>
                  ¿Confirmar que el pago de <strong>S/. {Number(apuestaSeleccionada?.montoApuesta).toFixed(2)}</strong> ha sido recibido correctamente?
                </p>
                {apuestaSeleccionada?.comprobante && (
                  <img 
                    src={apuestaSeleccionada.comprobante} 
                    alt="Comprobante" 
                    className="image-preview"
                  />
                )}
                <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
                  <button
                    className="btn btn-warning"
                    onClick={() => setMostrarModal(false)}
                    style={{ flex: 1 }}
                  >
                    Cancelar
                  </button>
                  <button
                    className="btn btn-success"
                    onClick={handleVerificar}
                    style={{ flex: 1 }}
                  >
                    Confirmar Verificación
                  </button>
                </div>
              </>
            )}

            {tipoAccion === 'rechazar' && (
              <>
                <h2>❌ Rechazar Pago</h2>
                <p style={{ marginTop: '1rem', marginBottom: '1rem' }}>
                  Por favor ingresa el motivo del rechazo:
                </p>
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Comprobante inválido, monto no coincide, etc."
                  style={{ minHeight: '100px', marginBottom: '1rem' }}
                />
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => setMostrarModal(false)}
                    style={{ flex: 1 }}
                  >
                    Cancelar
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={handleRechazar}
                    style={{ flex: 1 }}
                  >
                    Rechazar Pago
                  </button>
                </div>
              </>
            )}

            {tipoAccion === 'resultado' && (
              <>
                <h2>📊 Establecer Resultado del Partido</h2>
                <p style={{ marginTop: '1rem', marginBottom: '1rem' }}>
                  <strong>
                    {apuestaSeleccionada?.Evento?.equipoLocal} vs {apuestaSeleccionada?.Evento?.equipoVisitante}
                  </strong>
                </p>
                <div>
                  <label style={{ marginBottom: '1rem' }}>Selecciona el resultado:</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                    <button
                      className={`btn ${resultado === 'local' ? 'btn-success' : 'btn-warning'}`}
                      onClick={() => setResultado('local')}
                    >
                      ✅ Ganó: {apuestaSeleccionada?.Evento?.equipoLocal} (Local)
                    </button>
                    <button
                      className={`btn ${resultado === 'empate' ? 'btn-success' : 'btn-warning'}`}
                      onClick={() => setResultado('empate')}
                    >
                      🤝 Empate
                    </button>
                    <button
                      className={`btn ${resultado === 'visitante' ? 'btn-success' : 'btn-warning'}`}
                      onClick={() => setResultado('visitante')}
                    >
                      ✅ Ganó: {apuestaSeleccionada?.Evento?.equipoVisitante} (Visitante)
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => setMostrarModal(false)}
                    style={{ flex: 1 }}
                  >
                    Cancelar
                  </button>
                  <button
                    className="btn btn-success"
                    onClick={handleResultado}
                    style={{ flex: 1 }}
                    disabled={!resultado}
                  >
                    Confirmar Resultado
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
};


export default AdminPanel;
