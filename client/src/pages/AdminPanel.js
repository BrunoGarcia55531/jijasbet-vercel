import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

function AdminPanel({ token }) {
  const [apuestas, setApuestas] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [recargas, setRecargas] = useState([]);
  const [estadisticas, setEstadisticas] = useState({});
  const [loading, setLoading] = useState(true);
  const [pestaña, setPestaña] = useState('eventos');

  // Recargas
  const [filtroRecargas, setFiltroRecargas] = useState('pendiente');
  const [recargaSeleccionada, setRecargaSeleccionada] = useState(null);
  const [mostrarModalRecarga, setMostrarModalRecarga] = useState(false);
  const [motivoRecarga, setMotivoRecarga] = useState('');

  // Eventos - crear
  const [nuevoEvento, setNuevoEvento] = useState({
    equipoLocal: '', equipoVisitante: '', liga: 'Primera División',
    fechaPartido: '', horaPartido: '', cuotaLocal: '', cuotaEmpate: '', cuotaVisitante: ''
  });
  const [cargandoEvento, setCargandoEvento] = useState(false);
  const [mensajeEvento, setMensajeEvento] = useState('');
  const [errorEvento, setErrorEvento] = useState('');

  // Eventos - editar cuotas en vivo
  const [eventoEditando, setEventoEditando] = useState(null);
  const [cuotasEdit, setCuotasEdit] = useState({ cuotaLocal: '', cuotaEmpate: '', cuotaVisitante: '' });

  // Eventos - cerrar resultado
  const [eventoResultado, setEventoResultado] = useState(null);
  const [resultadoSeleccionado, setResultadoSeleccionado] = useState('');
  const [cerrandoEvento, setCerrandoEvento] = useState(false);

  const ligas = ['Primera División', 'Copa Libertadores', 'Copa Sudamericana', 'LaLiga', 'Premier League', 'Serie A', 'Ligue 1', 'Bundesliga'];
  const equiposSugeridos = ['Alianza Lima', 'Universitario', 'Sporting Cristal', 'Boca Juniors', 'River Plate', 'Barcelona', 'Real Madrid', 'Bayern Munich', 'Manchester United', 'Liverpool', 'Manchester City', 'PSG', 'Inter Milan', 'Juventus', 'AC Milan'];

  const cargarDatos = useCallback(async () => {
    try {
      const [apuestasRes, estadRes, eventosRes, recargasRes] = await Promise.all([
        axios.get('/api/admin/todas-apuestas',  { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/admin/estadisticas',     { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/admin/eventos',          { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/recargas',               { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setApuestas(apuestasRes.data);
      setEstadisticas(estadRes.data);
      setEventos(eventosRes.data);
      setRecargas(recargasRes.data);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    cargarDatos();
    const intervalo = setInterval(cargarDatos, 5000);
    return () => clearInterval(intervalo);
  }, [cargarDatos]);

  // ── Crear evento ──
  const handleCrearEvento = async (e) => {
    e.preventDefault();
    setErrorEvento(''); setMensajeEvento('');
    if (!nuevoEvento.equipoLocal || !nuevoEvento.equipoVisitante || !nuevoEvento.fechaPartido ||
        !nuevoEvento.cuotaLocal || !nuevoEvento.cuotaEmpate || !nuevoEvento.cuotaVisitante) {
      setErrorEvento('Todos los campos son requeridos'); return;
    }
    setCargandoEvento(true);
    try {
      const fechaHora = nuevoEvento.horaPartido
        ? `${nuevoEvento.fechaPartido}T${nuevoEvento.horaPartido}:00`
        : `${nuevoEvento.fechaPartido}T00:00:00`;
      await axios.post('/api/admin/eventos', {
        equipoLocal: nuevoEvento.equipoLocal, equipoVisitante: nuevoEvento.equipoVisitante,
        liga: nuevoEvento.liga, fechaPartido: fechaHora,
        cuotaLocal: parseFloat(nuevoEvento.cuotaLocal),
        cuotaEmpate: parseFloat(nuevoEvento.cuotaEmpate),
        cuotaVisitante: parseFloat(nuevoEvento.cuotaVisitante)
      }, { headers: { Authorization: `Bearer ${token}` } });
      setMensajeEvento('✅ Evento creado exitosamente');
      setNuevoEvento({ equipoLocal: '', equipoVisitante: '', liga: 'Primera División', fechaPartido: '', horaPartido: '', cuotaLocal: '', cuotaEmpate: '', cuotaVisitante: '' });
      cargarDatos();
    } catch (err) {
      setErrorEvento(err.response?.data?.error || 'Error al crear el evento');
    } finally {
      setCargandoEvento(false);
    }
  };

  // ── Guardar cuotas en vivo ──
  const handleGuardarCuotas = async () => {
    try {
      await axios.put(`/api/admin/eventos/${eventoEditando.id}/cuotas`, {
        cuotaLocal:     parseFloat(cuotasEdit.cuotaLocal),
        cuotaEmpate:    parseFloat(cuotasEdit.cuotaEmpate),
        cuotaVisitante: parseFloat(cuotasEdit.cuotaVisitante)
      }, { headers: { Authorization: `Bearer ${token}` } });
      setEventoEditando(null);
      cargarDatos();
      alert('✅ Cuotas actualizadas');
    } catch (err) {
      alert('Error: ' + err.response?.data?.error);
    }
  };

  // ── Cerrar evento con resultado ──
  const handleCerrarEvento = async () => {
    if (!resultadoSeleccionado) { alert('Selecciona un resultado'); return; }
    setCerrandoEvento(true);
    try {
      const res = await axios.put(`/api/admin/eventos/${eventoResultado.id}/resultado`,
        { resultado: resultadoSeleccionado },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEventoResultado(null);
      setResultadoSeleccionado('');
      cargarDatos();
      alert(res.data.message);
    } catch (err) {
      alert('Error: ' + err.response?.data?.error);
    } finally {
      setCerrandoEvento(false);
    }
  };

  // ── Cancelar evento ──
  const handleCancelarEvento = async (eventoId) => {
    if (!window.confirm('¿Cancelar este evento? Se devolverá el saldo a todos los apostadores.')) return;
    try {
      await axios.put(`/api/admin/eventos/${eventoId}`,
        { estado: 'cancelado' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      cargarDatos();
      alert('Evento cancelado. Saldos devueltos.');
    } catch (err) {
      alert('Error: ' + err.response?.data?.error);
    }
  };

  if (loading) return (
    <div className="container" style={{ textAlign: 'center', marginTop: '2rem' }}>Cargando panel...</div>
  );

  const pendientesRecarga = recargas.filter(r => r.estado === 'pendiente').length;

  return (
    <div className="container">
      <h1 style={{ color: 'white', marginBottom: '2rem', textAlign: 'center' }}>⚙️ Panel Administrativo</h1>

      {/* Estadísticas */}
      <div className="stats-grid">
        <div className="stat-card"><h3>{estadisticas.totalApuestas}</h3><p>Total Apuestas</p></div>
        <div className="stat-card"><h3 style={{ color: '#f0c040' }}>{estadisticas.apuestasActivas}</h3><p>Activas</p></div>
        <div className="stat-card"><h3 style={{ color: '#4CAF50' }}>{estadisticas.apuestasGanadas}</h3><p>Ganadas</p></div>
        <div className="stat-card"><h3>S/. {Number(estadisticas.totalMonto || 0).toFixed(2)}</h3><p>Monto Total</p></div>
      </div>

      {/* Pestañas */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <button className={`btn ${pestaña === 'eventos' ? 'btn-primary' : 'btn-warning'}`} onClick={() => setPestaña('eventos')}>
          📅 Eventos
        </button>
        <button className={`btn ${pestaña === 'apuestas' ? 'btn-primary' : 'btn-warning'}`} onClick={() => setPestaña('apuestas')}>
          🎲 Apuestas
        </button>
        <button className={`btn ${pestaña === 'recargas' ? 'btn-primary' : 'btn-success'}`} onClick={() => setPestaña('recargas')}>
          💳 Recargas
          {pendientesRecarga > 0 && (
            <span style={{ background: '#e74c3c', color: 'white', borderRadius: '50%', padding: '0.1rem 0.4rem', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
              {pendientesRecarga}
            </span>
          )}
        </button>
      </div>

      {/* ═══ TAB: EVENTOS ═══ */}
      {pestaña === 'eventos' && (
        <>
          {/* Crear evento */}
          <div className="card" style={{ marginBottom: '2rem' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>📅 Crear Nuevo Evento</h2>
            {errorEvento && <div className="alert alert-error">{errorEvento}</div>}
            {mensajeEvento && <div className="alert alert-success">{mensajeEvento}</div>}

            <form onSubmit={handleCrearEvento}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label>Equipo Local</label>
                  <input list="eq1" type="text" value={nuevoEvento.equipoLocal} onChange={e => setNuevoEvento({...nuevoEvento, equipoLocal: e.target.value})} placeholder="Ej: Alianza Lima" required />
                  <datalist id="eq1">{equiposSugeridos.map(eq => <option key={eq} value={eq} />)}</datalist>
                </div>
                <div>
                  <label>Equipo Visitante</label>
                  <input list="eq2" type="text" value={nuevoEvento.equipoVisitante} onChange={e => setNuevoEvento({...nuevoEvento, equipoVisitante: e.target.value})} placeholder="Ej: Universitario" required />
                  <datalist id="eq2">{equiposSugeridos.map(eq => <option key={eq} value={eq} />)}</datalist>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label>Liga</label>
                  <select value={nuevoEvento.liga} onChange={e => setNuevoEvento({...nuevoEvento, liga: e.target.value})}>
                    {ligas.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label>Fecha</label>
                  <input type="date" value={nuevoEvento.fechaPartido} onChange={e => setNuevoEvento({...nuevoEvento, fechaPartido: e.target.value})} required />
                </div>
                <div>
                  <label>Hora (opcional)</label>
                  <input type="time" value={nuevoEvento.horaPartido} onChange={e => setNuevoEvento({...nuevoEvento, horaPartido: e.target.value})} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                {[
                  { key: 'cuotaLocal', label: '🏠 Cuota Local' },
                  { key: 'cuotaEmpate', label: '🤝 Cuota Empate' },
                  { key: 'cuotaVisitante', label: '✈️ Cuota Visitante' }
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label>{label}</label>
                    <input type="number" step="0.01" min="1.01" value={nuevoEvento[key]} onChange={e => setNuevoEvento({...nuevoEvento, [key]: e.target.value})} placeholder="Ej: 1.80" required />
                    <small style={{ color: '#999' }}>S/.100 → S/. {(100 * parseFloat(nuevoEvento[key] || 1)).toFixed(2)}</small>
                  </div>
                ))}
              </div>

              <button type="submit" className="btn btn-success" disabled={cargandoEvento}>
                {cargandoEvento ? 'Creando...' : '✅ Crear Evento'}
              </button>
            </form>
          </div>

          {/* Lista de eventos */}
          <div className="card">
            <h2 style={{ marginBottom: '1.5rem' }}>📋 Todos los Eventos</h2>
            {eventos.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>No hay eventos creados</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Partido</th>
                    <th>Liga / Fecha</th>
                    <th>Cuotas (L / E / V)</th>
                    <th>Estado</th>
                    <th>Resultado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {eventos.map(evento => (
                    <tr key={evento.id}>
                      <td><strong>{evento.equipoLocal} vs {evento.equipoVisitante}</strong></td>
                      <td>
                        <small>{evento.liga}</small><br />
                        <small style={{ color: '#999' }}>{new Date(evento.fechaPartido).toLocaleDateString('es-PE')}</small>
                      </td>
                      <td style={{ fontSize: '0.9rem' }}>
                        🏠 <strong>{Number(evento.cuotaLocal).toFixed(2)}x</strong> &nbsp;
                        🤝 {Number(evento.cuotaEmpate).toFixed(2)}x &nbsp;
                        ✈️ <strong>{Number(evento.cuotaVisitante).toFixed(2)}x</strong>
                      </td>
                      <td>
                        <span style={{
                          color: evento.estado === 'activo' ? '#4CAF50' : evento.estado === 'finalizado' ? '#888' : '#e74c3c',
                          fontWeight: 'bold', textTransform: 'capitalize'
                        }}>{evento.estado}</span>
                      </td>
                      <td>
                        {evento.resultadoPartido ? (
                          <span style={{ color: '#4CAF50' }}>
                            {evento.resultadoPartido === 'local' && `🏠 ${evento.equipoLocal}`}
                            {evento.resultadoPartido === 'empate' && '🤝 Empate'}
                            {evento.resultadoPartido === 'visitante' && `✈️ ${evento.equipoVisitante}`}
                          </span>
                        ) : (
                          <span style={{ color: '#666' }}>—</span>
                        )}
                      </td>
                      <td>
                        {evento.estado === 'activo' && (
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <button
                              className="btn btn-warning"
                              style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}
                              onClick={() => {
                                setEventoEditando(evento);
                                setCuotasEdit({ cuotaLocal: evento.cuotaLocal, cuotaEmpate: evento.cuotaEmpate, cuotaVisitante: evento.cuotaVisitante });
                              }}
                            >
                              📊 Cuotas
                            </button>
                            <button
                              className="btn btn-success"
                              style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}
                              onClick={() => { setEventoResultado(evento); setResultadoSeleccionado(''); }}
                            >
                              🏁 Resultado
                            </button>
                            <button
                              className="btn btn-danger"
                              style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}
                              onClick={() => handleCancelarEvento(evento.id)}
                            >
                              🚫 Cancelar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ═══ TAB: APUESTAS ═══ */}
      {pestaña === 'apuestas' && (
        <div className="card">
          <h2 style={{ marginBottom: '1.5rem' }}>🎲 Todas las Apuestas</h2>
          {apuestas.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>No hay apuestas aún</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Partido</th>
                  <th>Apuesta</th>
                  <th>Monto</th>
                  <th>Cuota</th>
                  <th>Ganancia</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {apuestas.map(apuesta => (
                  <tr key={apuesta.id}>
                    <td>{apuesta.nombreUsuario}</td>
                    <td>
                      <strong>{apuesta.Evento?.equipoLocal} vs {apuesta.Evento?.equipoVisitante}</strong>
                      <br /><small style={{ color: '#666' }}>{apuesta.Evento?.liga}</small>
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
                      <span style={{
                        color: apuesta.estado === 'ganada' ? '#4CAF50'
                             : apuesta.estado === 'perdida' ? '#e74c3c'
                             : apuesta.estado === 'cancelada' ? '#888' : '#f0c040',
                        fontWeight: 'bold', textTransform: 'capitalize'
                      }}>
                        {apuesta.estado === 'ganada'   && '✅ Ganada'}
                        {apuesta.estado === 'perdida'  && '❌ Perdida'}
                        {apuesta.estado === 'activa'   && '⏳ Activa'}
                        {apuesta.estado === 'cancelada'&& '🚫 Cancelada'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ═══ TAB: RECARGAS ═══ */}
      {pestaña === 'recargas' && (
        <div className="card">
          <h2 style={{ marginBottom: '1.5rem' }}>💳 Solicitudes de Recarga</h2>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            {['pendiente', 'verificado', 'rechazado', 'todas'].map(estado => (
              <button
                key={estado}
                className={`btn ${filtroRecargas === estado ? 'btn-primary' : estado === 'verificado' ? 'btn-success' : estado === 'rechazado' ? 'btn-danger' : 'btn-warning'}`}
                onClick={() => setFiltroRecargas(estado)}
              >
                {estado.charAt(0).toUpperCase() + estado.slice(1)}
                {estado !== 'todas' && <span style={{ marginLeft: '0.4rem' }}>({recargas.filter(r => r.estado === estado).length})</span>}
              </button>
            ))}
          </div>

          {recargas.filter(r => filtroRecargas === 'todas' || r.estado === filtroRecargas).length === 0 ? (
            <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>No hay recargas con este estado</p>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Usuario</th><th>Monto</th><th>N° Transacción</th><th>Comprobante</th><th>Estado</th><th>Fecha</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {recargas.filter(r => filtroRecargas === 'todas' || r.estado === filtroRecargas).map(recarga => (
                  <tr key={recarga.id}>
                    <td><strong>{recarga.nombreUsuario}</strong></td>
                    <td><strong style={{ color: '#4CAF50' }}>S/. {parseFloat(recarga.monto).toFixed(2)}</strong></td>
                    <td style={{ fontSize: '0.85rem' }}>{recarga.numeroTransaccion}</td>
                    <td>
                      {recarga.comprobante && (
                        <img src={recarga.comprobante} alt="Comprobante" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer' }} onClick={() => window.open(recarga.comprobante, '_blank')} />
                      )}
                    </td>
                    <td>
                      <span style={{ color: recarga.estado === 'verificado' ? '#4CAF50' : recarga.estado === 'rechazado' ? '#e74c3c' : '#f0c040', fontWeight: 'bold', textTransform: 'capitalize' }}>
                        {recarga.estado}
                      </span>
                      {recarga.estado === 'rechazado' && recarga.motivoRechazo && <p style={{ fontSize: '0.75rem', color: '#e74c3c', margin: 0 }}>{recarga.motivoRechazo}</p>}
                    </td>
                    <td style={{ fontSize: '0.85rem', color: '#999' }}>{new Date(recarga.createdAt).toLocaleDateString('es-PE')}</td>
                    <td>
                      {recarga.estado === 'pendiente' && (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn btn-success" style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem' }} onClick={() => { setRecargaSeleccionada(recarga); setMostrarModalRecarga('verificar'); }}>✅</button>
                          <button className="btn btn-danger"  style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem' }} onClick={() => { setRecargaSeleccionada(recarga); setMotivoRecarga(''); setMostrarModalRecarga('rechazar'); }}>❌</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ─── Modal: Editar cuotas en vivo ─── */}
      {eventoEditando && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1e2a3a', padding: '2rem', borderRadius: '12px', maxWidth: '450px', width: '90%' }}>
            <h3 style={{ color: 'white', marginBottom: '0.5rem' }}>📊 Actualizar Cuotas en Vivo</h3>
            <p style={{ color: '#ccc', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              {eventoEditando.equipoLocal} vs {eventoEditando.equipoVisitante}
              <br /><small style={{ color: '#f0c040' }}>⚠️ Las nuevas apuestas usarán estas cuotas. Las ya registradas mantienen su cuota original.</small>
            </p>
            {[
              { key: 'cuotaLocal', label: `🏠 ${eventoEditando.equipoLocal}` },
              { key: 'cuotaEmpate', label: '🤝 Empate' },
              { key: 'cuotaVisitante', label: `✈️ ${eventoEditando.equipoVisitante}` }
            ].map(({ key, label }) => (
              <div className="form-group" key={key}>
                <label>{label}</label>
                <input type="number" step="0.01" min="1.01" value={cuotasEdit[key]} onChange={e => setCuotasEdit({...cuotasEdit, [key]: e.target.value})} />
              </div>
            ))}
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button className="btn btn-warning" style={{ flex: 1 }} onClick={() => setEventoEditando(null)}>Cancelar</button>
              <button className="btn btn-success" style={{ flex: 1 }} onClick={handleGuardarCuotas}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Resultado del evento ─── */}
      {eventoResultado && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1e2a3a', padding: '2rem', borderRadius: '12px', maxWidth: '480px', width: '90%' }}>
            <h3 style={{ color: 'white', marginBottom: '0.5rem' }}>🏁 Cerrar Evento</h3>
            <p style={{ color: '#ccc', marginBottom: '0.5rem' }}>
              <strong style={{ color: 'white' }}>{eventoResultado.equipoLocal} vs {eventoResultado.equipoVisitante}</strong>
            </p>
            <p style={{ color: '#f0c040', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Se resolverán todas las apuestas activas y se acreditarán las ganancias automáticamente.
            </p>
            <p style={{ color: '#ccc', marginBottom: '1rem' }}><strong>¿Quién ganó?</strong></p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {[
                { value: 'local',     label: `🏠 Ganó ${eventoResultado.equipoLocal} (Local)` },
                { value: 'empate',    label: '🤝 Empate' },
                { value: 'visitante', label: `✈️ Ganó ${eventoResultado.equipoVisitante} (Visitante)` }
              ].map(opt => (
                <button
                  key={opt.value}
                  className={`btn ${resultadoSeleccionado === opt.value ? 'btn-success' : 'btn-warning'}`}
                  onClick={() => setResultadoSeleccionado(opt.value)}
                  style={{ textAlign: 'left' }}
                >
                  {resultadoSeleccionado === opt.value ? '✔ ' : ''}{opt.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn btn-warning" style={{ flex: 1 }} onClick={() => setEventoResultado(null)} disabled={cerrandoEvento}>Cancelar</button>
              <button className="btn btn-success" style={{ flex: 1 }} onClick={handleCerrarEvento} disabled={!resultadoSeleccionado || cerrandoEvento}>
                {cerrandoEvento ? 'Cerrando...' : '🏁 Confirmar Resultado'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Verificar/Rechazar Recarga ─── */}
      {mostrarModalRecarga && recargaSeleccionada && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1e2a3a', padding: '2rem', borderRadius: '12px', maxWidth: '450px', width: '90%' }}>
            {mostrarModalRecarga === 'verificar' ? (
              <>
                <h3 style={{ color: 'white', marginBottom: '1rem' }}>✅ Verificar Recarga</h3>
                <p style={{ color: '#ccc', marginBottom: '1.5rem' }}>
                  ¿Confirmas que <strong style={{ color: 'white' }}>{recargaSeleccionada.nombreUsuario}</strong> pagó <strong style={{ color: '#4CAF50' }}>S/. {parseFloat(recargaSeleccionada.monto).toFixed(2)}</strong>?
                  <br /><br />El saldo se acreditará automáticamente.
                </p>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button className="btn btn-warning" style={{ flex: 1 }} onClick={() => setMostrarModalRecarga(false)}>Cancelar</button>
                  <button className="btn btn-success" style={{ flex: 1 }} onClick={async () => {
                    try {
                      await axios.put(`/api/recargas/${recargaSeleccionada.id}/verificar`, {}, { headers: { Authorization: `Bearer ${token}` } });
                      setMostrarModalRecarga(false); cargarDatos();
                      alert(`✅ S/. ${parseFloat(recargaSeleccionada.monto).toFixed(2)} acreditados.`);
                    } catch (err) { alert('Error: ' + err.response?.data?.error); }
                  }}>Confirmar</button>
                </div>
              </>
            ) : (
              <>
                <h3 style={{ color: 'white', marginBottom: '1rem' }}>❌ Rechazar Recarga</h3>
                <p style={{ color: '#ccc', marginBottom: '1rem' }}>
                  Recarga de <strong style={{ color: 'white' }}>{recargaSeleccionada.nombreUsuario}</strong> por <strong style={{ color: '#e74c3c' }}>S/. {parseFloat(recargaSeleccionada.monto).toFixed(2)}</strong>
                </p>
                <div className="form-group">
                  <label>Motivo</label>
                  <input type="text" value={motivoRecarga} onChange={e => setMotivoRecarga(e.target.value)} placeholder="Ej: Comprobante no válido" />
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button className="btn btn-warning" style={{ flex: 1 }} onClick={() => setMostrarModalRecarga(false)}>Cancelar</button>
                  <button className="btn btn-danger" style={{ flex: 1 }} onClick={async () => {
                    if (!motivoRecarga.trim()) { alert('Ingresa el motivo'); return; }
                    try {
                      await axios.put(`/api/recargas/${recargaSeleccionada.id}/rechazar`, { motivo: motivoRecarga }, { headers: { Authorization: `Bearer ${token}` } });
                      setMostrarModalRecarga(false); cargarDatos(); alert('Recarga rechazada');
                    } catch (err) { alert('Error: ' + err.response?.data?.error); }
                  }}>Rechazar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPanel;
