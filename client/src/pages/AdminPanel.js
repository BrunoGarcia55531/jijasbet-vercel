import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const MARGEN_DEFAULT = 8;

// ── Calculadora de cuotas en el frontend (misma lógica que el backend) ──
function calcularCuotasLocal(pL, pE, pV, margenPct = MARGEN_DEFAULT) {
  const suma = pL + pE + pV;
  if (suma <= 0) return null;
  const nL = pL/suma, nE = pE/suma, nV = pV/suma;
  const m = margenPct / 100;
  const cL = Math.max(1.05, Math.min(50, 1 / (nL * (1 + m))));
  const cE = Math.max(1.05, Math.min(50, 1 / (nE * (1 + m))));
  const cV = Math.max(1.05, Math.min(50, 1 / (nV * (1 + m))));
  const ovr = 1/cL + 1/cE + 1/cV;
  return {
    cuotaLocal:     +cL.toFixed(3),
    cuotaEmpate:    +cE.toFixed(3),
    cuotaVisitante: +cV.toFixed(3),
    margenEfectivo: +((ovr - 1) * 100).toFixed(2)
  };
}

function AdminPanel({ token }) {
  const [apuestas, setApuestas]     = useState([]);
  const [eventos, setEventos]       = useState([]);
  const [recargas, setRecargas]     = useState([]);
  const [estadisticas, setEstadisticas] = useState({});
  const [loading, setLoading]       = useState(true);
  const [pestaña, setPestaña]       = useState('eventos');

  // Recargas
  const [filtroRecargas, setFiltroRecargas]         = useState('pendiente');
  const [recargaSeleccionada, setRecargaSeleccionada] = useState(null);
  const [mostrarModalRecarga, setMostrarModalRecarga] = useState(false);
  const [motivoRecarga, setMotivoRecarga]             = useState('');

  // Crear evento — usando probabilidades
  const [nuevoEvento, setNuevoEvento] = useState({
    equipoLocal: '', equipoVisitante: '', liga: 'Primera División',
    fechaPartido: '', horaPartido: '',
    probLocal: '45', probEmpate: '25', probVisitante: '30',
    margen: String(MARGEN_DEFAULT)
  });
  const [cargandoEvento, setCargandoEvento] = useState(false);
  const [mensajeEvento, setMensajeEvento]   = useState('');
  const [errorEvento, setErrorEvento]       = useState('');

  // Editar probabilidades base en vivo
  const [eventoEditando, setEventoEditando] = useState(null);
  const [probsEdit, setProbsEdit] = useState({ probLocal: '', probEmpate: '', probVisitante: '', margen: '' });

  // Cerrar resultado
  const [eventoResultado, setEventoResultado]       = useState(null);
  const [resultadoSeleccionado, setResultadoSeleccionado] = useState('');
  const [cerrandoEvento, setCerrandoEvento]         = useState(false);

  const ligas = ['Primera División', 'Copa Libertadores', 'Copa Sudamericana', 'LaLiga', 'Premier League', 'Serie A', 'Ligue 1', 'Bundesliga'];
  const equiposSugeridos = ['Alianza Lima', 'Universitario', 'Sporting Cristal', 'Boca Juniors', 'River Plate', 'Barcelona', 'Real Madrid', 'Bayern Munich', 'Manchester United', 'Liverpool', 'Manchester City', 'PSG', 'Inter Milan', 'Juventus', 'AC Milan'];

  const cargarDatos = useCallback(async () => {
    try {
      const [apuestasRes, estadRes, eventosRes, recargasRes] = await Promise.all([
        axios.get('/api/admin/todas-apuestas', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/admin/estadisticas',   { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/admin/eventos',        { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/recargas',             { headers: { Authorization: `Bearer ${token}` } })
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

  // ── Preview cuotas del formulario de creación ──
  const previewCrear = calcularCuotasLocal(
    parseFloat(nuevoEvento.probLocal)     || 0,
    parseFloat(nuevoEvento.probEmpate)    || 0,
    parseFloat(nuevoEvento.probVisitante) || 0,
    parseFloat(nuevoEvento.margen)        || MARGEN_DEFAULT
  );

  const sumaProbs = (parseFloat(nuevoEvento.probLocal) || 0) +
                    (parseFloat(nuevoEvento.probEmpate) || 0) +
                    (parseFloat(nuevoEvento.probVisitante) || 0);

  // ── Preview cuotas del modal de edición ──
  const previewEdit = probsEdit.probLocal ? calcularCuotasLocal(
    parseFloat(probsEdit.probLocal)     || 0,
    parseFloat(probsEdit.probEmpate)    || 0,
    parseFloat(probsEdit.probVisitante) || 0,
    parseFloat(probsEdit.margen)        || MARGEN_DEFAULT
  ) : null;

  // ── Crear evento ──
  const handleCrearEvento = async (e) => {
    e.preventDefault();
    setErrorEvento(''); setMensajeEvento('');
    if (!nuevoEvento.equipoLocal || !nuevoEvento.equipoVisitante || !nuevoEvento.fechaPartido)
      return setErrorEvento('Completa los campos requeridos');
    if (sumaProbs < 90 || sumaProbs > 110)
      return setErrorEvento(`Las probabilidades deben sumar ~100% (ahora suman ${sumaProbs.toFixed(1)}%)`);

    setCargandoEvento(true);
    try {
      const fechaHora = nuevoEvento.horaPartido
        ? `${nuevoEvento.fechaPartido}T${nuevoEvento.horaPartido}:00`
        : `${nuevoEvento.fechaPartido}T00:00:00`;

      const res = await axios.post('/api/admin/eventos', {
        equipoLocal: nuevoEvento.equipoLocal,
        equipoVisitante: nuevoEvento.equipoVisitante,
        liga: nuevoEvento.liga, fechaPartido: fechaHora,
        probLocal:      parseFloat(nuevoEvento.probLocal),
        probEmpate:     parseFloat(nuevoEvento.probEmpate),
        probVisitante:  parseFloat(nuevoEvento.probVisitante),
        margen:         parseFloat(nuevoEvento.margen) || MARGEN_DEFAULT
      }, { headers: { Authorization: `Bearer ${token}` } });

      const c = res.data.cuotasCalculadas;
      setMensajeEvento(`✅ Evento creado — Cuotas: L ${c.cuotaLocal} / E ${c.cuotaEmpate} / V ${c.cuotaVisitante} (margen ${c.margenEfectivo}%)`);
      setNuevoEvento({ equipoLocal: '', equipoVisitante: '', liga: 'Primera División', fechaPartido: '', horaPartido: '', probLocal: '45', probEmpate: '25', probVisitante: '30', margen: String(MARGEN_DEFAULT) });
      cargarDatos();
    } catch (err) {
      setErrorEvento(err.response?.data?.error || 'Error al crear el evento');
    } finally {
      setCargandoEvento(false);
    }
  };

  // ── Guardar nuevas probs base ──
  const handleGuardarCuotas = async () => {
    try {
      const res = await axios.put(`/api/admin/eventos/${eventoEditando.id}/cuotas`, {
        probLocal:     parseFloat(probsEdit.probLocal),
        probEmpate:    parseFloat(probsEdit.probEmpate),
        probVisitante: parseFloat(probsEdit.probVisitante),
        margen:        parseFloat(probsEdit.margen) || MARGEN_DEFAULT
      }, { headers: { Authorization: `Bearer ${token}` } });
      setEventoEditando(null);
      cargarDatos();
      const c = res.data.cuotas;
      alert(`✅ Cuotas actualizadas: L ${c.cuotaLocal} / E ${c.cuotaEmpate} / V ${c.cuotaVisitante}`);
    } catch (err) {
      alert('Error: ' + err.response?.data?.error);
    }
  };

  // ── Cerrar evento con resultado ──
  const handleCerrarEvento = async () => {
    if (!resultadoSeleccionado) return alert('Selecciona un resultado');
    setCerrandoEvento(true);
    try {
      const res = await axios.put(`/api/admin/eventos/${eventoResultado.id}/resultado`,
        { resultado: resultadoSeleccionado },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEventoResultado(null); setResultadoSeleccionado('');
      cargarDatos();
      alert(res.data.message);
    } catch (err) {
      alert('Error: ' + err.response?.data?.error);
    } finally {
      setCerrandoEvento(false);
    }
  };

  const handleCancelarEvento = async (eventoId) => {
    if (!window.confirm('¿Cancelar este evento? Se devolverá el saldo a todos los apostadores.')) return;
    try {
      await axios.put(`/api/admin/eventos/${eventoId}`, { estado: 'cancelado' }, { headers: { Authorization: `Bearer ${token}` } });
      cargarDatos(); alert('Evento cancelado. Saldos devueltos.');
    } catch (err) { alert('Error: ' + err.response?.data?.error); }
  };

  if (loading) return <div className="container" style={{ textAlign: 'center', marginTop: '2rem' }}>Cargando panel...</div>;

  const pendientesRecarga = recargas.filter(r => r.estado === 'pendiente').length;

  return (
    <div className="container">
      <h1 style={{ color: 'white', marginBottom: '2rem', textAlign: 'center' }}>⚙️ Panel Administrativo</h1>

      <div className="stats-grid">
        <div className="stat-card"><h3>{estadisticas.totalApuestas}</h3><p>Total Apuestas</p></div>
        <div className="stat-card"><h3 style={{ color: '#f0c040' }}>{estadisticas.apuestasActivas}</h3><p>Activas</p></div>
        <div className="stat-card"><h3 style={{ color: '#4CAF50' }}>{estadisticas.apuestasGanadas}</h3><p>Ganadas</p></div>
        <div className="stat-card"><h3>S/. {Number(estadisticas.totalMonto || 0).toFixed(2)}</h3><p>Monto Total</p></div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <button className={`btn ${pestaña === 'eventos'   ? 'btn-primary' : 'btn-warning'}`} onClick={() => setPestaña('eventos')}>📅 Eventos</button>
        <button className={`btn ${pestaña === 'apuestas'  ? 'btn-primary' : 'btn-warning'}`} onClick={() => setPestaña('apuestas')}>🎲 Apuestas</button>
        <button className={`btn ${pestaña === 'recargas'  ? 'btn-primary' : 'btn-success'}`} onClick={() => setPestaña('recargas')}>
          💳 Recargas {pendientesRecarga > 0 && <span style={{ background: '#e74c3c', color: 'white', borderRadius: '50%', padding: '0.1rem 0.4rem', fontSize: '0.75rem', marginLeft: '0.5rem' }}>{pendientesRecarga}</span>}
        </button>
      </div>

      {/* ═══ EVENTOS ═══ */}
      {pestaña === 'eventos' && (
        <>
          {/* Crear evento */}
          <div className="card" style={{ marginBottom: '2rem' }}>
            <h2 style={{ marginBottom: '0.5rem' }}>📅 Crear Nuevo Evento</h2>
            <p style={{ color: '#999', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Ingresa las probabilidades estimadas (%) — las cuotas se calculan automáticamente con margen del {nuevoEvento.margen || MARGEN_DEFAULT}%.
            </p>

            {errorEvento   && <div className="alert alert-error">{errorEvento}</div>}
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
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

              {/* Probabilidades + preview de cuotas */}
              <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <strong style={{ color: 'white' }}>🎯 Probabilidades estimadas (%)</strong>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ color: '#999', fontSize: '0.85rem' }}>Margen casa:</label>
                    <input type="number" step="0.5" min="2" max="25" value={nuevoEvento.margen}
                      onChange={e => setNuevoEvento({...nuevoEvento, margen: e.target.value})}
                      style={{ width: '70px' }} />
                    <span style={{ color: '#999', fontSize: '0.85rem' }}>%</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  {[
                    { key: 'probLocal',     label: `🏠 ${nuevoEvento.equipoLocal || 'Local'}`,      cuota: previewCrear?.cuotaLocal },
                    { key: 'probEmpate',    label: '🤝 Empate',                                      cuota: previewCrear?.cuotaEmpate },
                    { key: 'probVisitante', label: `✈️ ${nuevoEvento.equipoVisitante || 'Visitante'}`, cuota: previewCrear?.cuotaVisitante }
                  ].map(({ key, label, cuota }) => (
                    <div key={key}>
                      <label style={{ fontSize: '0.85rem' }}>{label}</label>
                      <input type="number" step="0.5" min="1" max="98" value={nuevoEvento[key]}
                        onChange={e => setNuevoEvento({...nuevoEvento, [key]: e.target.value})} />
                      {cuota && (
                        <div style={{ textAlign: 'center', marginTop: '0.3rem' }}>
                          <span style={{ background: '#f0c040', color: '#1a1a2e', borderRadius: '4px', padding: '0.15rem 0.5rem', fontWeight: 'bold', fontSize: '0.95rem' }}>
                            {cuota}x
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Suma de probabilidades */}
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#999', fontSize: '0.85rem' }}>Suma: <strong style={{ color: Math.abs(sumaProbs - 100) <= 5 ? '#4CAF50' : '#e74c3c' }}>{sumaProbs.toFixed(1)}%</strong> (debe ser ~100%)</span>
                  {previewCrear && (
                    <span style={{ color: '#999', fontSize: '0.85rem' }}>Margen efectivo: <strong style={{ color: '#f0c040' }}>{previewCrear.margenEfectivo}%</strong></span>
                  )}
                </div>
              </div>

              <button type="submit" className="btn btn-success" disabled={cargandoEvento || !previewCrear}>
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
                    <th>Cuotas actuales (L / E / V)</th>
                    <th>Volumen apostado</th>
                    <th>Estado</th>
                    <th>Resultado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {eventos.map(evento => {
                    const mL = parseFloat(evento.montoApostadoLocal    || 0);
                    const mE = parseFloat(evento.montoApostadoEmpate   || 0);
                    const mV = parseFloat(evento.montoApostadoVisitante|| 0);
                    const mT = mL + mE + mV;
                    return (
                      <tr key={evento.id}>
                        <td><strong>{evento.equipoLocal} vs {evento.equipoVisitante}</strong></td>
                        <td>
                          <small>{evento.liga}</small><br />
                          <small style={{ color: '#999' }}>{new Date(evento.fechaPartido).toLocaleDateString('es-PE')}</small>
                        </td>
                        <td style={{ fontSize: '0.9rem' }}>
                          🏠 <strong style={{ color: '#f0c040' }}>{Number(evento.cuotaLocal).toFixed(3)}x</strong><br />
                          🤝 {Number(evento.cuotaEmpate).toFixed(3)}x<br />
                          ✈️ <strong style={{ color: '#f0c040' }}>{Number(evento.cuotaVisitante).toFixed(3)}x</strong>
                        </td>
                        <td style={{ fontSize: '0.82rem', color: '#ccc' }}>
                          {mT > 0 ? (
                            <>
                              🏠 S/. {mL.toFixed(2)} ({mT > 0 ? ((mL/mT)*100).toFixed(0) : 0}%)<br />
                              🤝 S/. {mE.toFixed(2)} ({mT > 0 ? ((mE/mT)*100).toFixed(0) : 0}%)<br />
                              ✈️ S/. {mV.toFixed(2)} ({mT > 0 ? ((mV/mT)*100).toFixed(0) : 0}%)
                            </>
                          ) : <span style={{ color: '#555' }}>Sin apuestas</span>}
                        </td>
                        <td>
                          <span style={{ color: evento.estado === 'activo' ? '#4CAF50' : evento.estado === 'finalizado' ? '#888' : '#e74c3c', fontWeight: 'bold', textTransform: 'capitalize' }}>
                            {evento.estado}
                          </span>
                        </td>
                        <td>
                          {evento.resultadoPartido ? (
                            <span style={{ color: '#4CAF50' }}>
                              {evento.resultadoPartido === 'local'     && `🏠 ${evento.equipoLocal}`}
                              {evento.resultadoPartido === 'empate'    && '🤝 Empate'}
                              {evento.resultadoPartido === 'visitante' && `✈️ ${evento.equipoVisitante}`}
                            </span>
                          ) : <span style={{ color: '#555' }}>—</span>}
                        </td>
                        <td>
                          {evento.estado === 'activo' && (
                            <div style={{ display: 'flex', gap: '0.4rem', flexDirection: 'column' }}>
                              <button className="btn btn-warning" style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}
                                onClick={() => {
                                  setEventoEditando(evento);
                                  setProbsEdit({
                                    probLocal:     (parseFloat(evento.probBaseLocal)     * 100).toFixed(1),
                                    probEmpate:    (parseFloat(evento.probBaseEmpate)    * 100).toFixed(1),
                                    probVisitante: (parseFloat(evento.probBaseVisitante) * 100).toFixed(1),
                                    margen:        (parseFloat(evento.margen)            * 100).toFixed(1)
                                  });
                                }}>
                                📊 Ajustar cuotas
                              </button>
                              <button className="btn btn-success" style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}
                                onClick={() => { setEventoResultado(evento); setResultadoSeleccionado(''); }}>
                                🏁 Resultado
                              </button>
                              <button className="btn btn-danger" style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}
                                onClick={() => handleCancelarEvento(evento.id)}>
                                🚫 Cancelar
                              </button>
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
        </>
      )}

      {/* ═══ APUESTAS ═══ */}
      {pestaña === 'apuestas' && (
        <div className="card">
          <h2 style={{ marginBottom: '1.5rem' }}>🎲 Todas las Apuestas</h2>
          {apuestas.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>No hay apuestas aún</p>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Usuario</th><th>Partido</th><th>Apuesta</th><th>Monto</th><th>Cuota</th><th>Ganancia</th><th>Estado</th></tr>
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
                    <td>{Number(apuesta.cuota || 1).toFixed(3)}x</td>
                    <td>S/. {Number(apuesta.montoGanancia).toFixed(2)}</td>
                    <td>
                      <span style={{ color: apuesta.estado === 'ganada' ? '#4CAF50' : apuesta.estado === 'perdida' ? '#e74c3c' : apuesta.estado === 'cancelada' ? '#888' : '#f0c040', fontWeight: 'bold' }}>
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

      {/* ═══ RECARGAS ═══ */}
      {pestaña === 'recargas' && (
        <div className="card">
          <h2 style={{ marginBottom: '1.5rem' }}>💳 Solicitudes de Recarga</h2>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            {['pendiente', 'verificado', 'rechazado', 'todas'].map(estado => (
              <button key={estado} className={`btn ${filtroRecargas === estado ? 'btn-primary' : estado === 'verificado' ? 'btn-success' : estado === 'rechazado' ? 'btn-danger' : 'btn-warning'}`} onClick={() => setFiltroRecargas(estado)}>
                {estado.charAt(0).toUpperCase() + estado.slice(1)} {estado !== 'todas' && `(${recargas.filter(r => r.estado === estado).length})`}
              </button>
            ))}
          </div>
          {recargas.filter(r => filtroRecargas === 'todas' || r.estado === filtroRecargas).length === 0 ? (
            <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>No hay recargas con este estado</p>
          ) : (
            <table className="table">
              <thead><tr><th>Usuario</th><th>Monto</th><th>N° Transacción</th><th>Comprobante</th><th>Estado</th><th>Fecha</th><th>Acciones</th></tr></thead>
              <tbody>
                {recargas.filter(r => filtroRecargas === 'todas' || r.estado === filtroRecargas).map(recarga => (
                  <tr key={recarga.id}>
                    <td><strong>{recarga.nombreUsuario}</strong></td>
                    <td><strong style={{ color: '#4CAF50' }}>S/. {parseFloat(recarga.monto).toFixed(2)}</strong></td>
                    <td style={{ fontSize: '0.85rem' }}>{recarga.numeroTransaccion}</td>
                    <td>{recarga.comprobante && <img src={recarga.comprobante} alt="Comprobante" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer' }} onClick={() => window.open(recarga.comprobante, '_blank')} />}</td>
                    <td><span style={{ color: recarga.estado === 'verificado' ? '#4CAF50' : recarga.estado === 'rechazado' ? '#e74c3c' : '#f0c040', fontWeight: 'bold', textTransform: 'capitalize' }}>{recarga.estado}</span></td>
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

      {/* ─── Modal: Ajustar cuotas (probabilidades base) ─── */}
      {eventoEditando && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1e2a3a', padding: '2rem', borderRadius: '12px', maxWidth: '500px', width: '90%' }}>
            <h3 style={{ color: 'white', marginBottom: '0.5rem' }}>📊 Ajustar Cuotas</h3>
            <p style={{ color: '#ccc', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              <strong style={{ color: 'white' }}>{eventoEditando.equipoLocal} vs {eventoEditando.equipoVisitante}</strong>
            </p>
            <p style={{ color: '#f0c040', fontSize: '0.82rem', marginBottom: '1.5rem' }}>
              ⚠️ Las cuotas se recalcularán con estas nuevas probabilidades base mezcladas con el volumen actual de apuestas.
              Las apuestas ya registradas mantienen su cuota original.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              {[
                { key: 'probLocal',     label: `🏠 ${eventoEditando.equipoLocal}` },
                { key: 'probEmpate',    label: '🤝 Empate' },
                { key: 'probVisitante', label: `✈️ ${eventoEditando.equipoVisitante}` }
              ].map(({ key, label }) => (
                <div key={key}>
                  <label style={{ fontSize: '0.85rem' }}>{label} (%)</label>
                  <input type="number" step="0.5" min="1" max="98" value={probsEdit[key]} onChange={e => setProbsEdit({...probsEdit, [key]: e.target.value})} />
                  {previewEdit && (
                    <div style={{ textAlign: 'center', marginTop: '0.3rem' }}>
                      <span style={{ background: '#f0c040', color: '#1a1a2e', borderRadius: '4px', padding: '0.15rem 0.5rem', fontWeight: 'bold', fontSize: '0.9rem' }}>
                        {key === 'probLocal' ? previewEdit.cuotaLocal : key === 'probEmpate' ? previewEdit.cuotaEmpate : previewEdit.cuotaVisitante}x
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem' }}>Margen (%)</label>
                <input type="number" step="0.5" min="2" max="25" value={probsEdit.margen} onChange={e => setProbsEdit({...probsEdit, margen: e.target.value})} style={{ width: '80px' }} />
              </div>
              {previewEdit && (
                <div style={{ color: '#999', fontSize: '0.85rem', marginTop: '1.2rem' }}>
                  Margen efectivo: <strong style={{ color: '#f0c040' }}>{previewEdit.margenEfectivo}%</strong>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn btn-warning" style={{ flex: 1 }} onClick={() => setEventoEditando(null)}>Cancelar</button>
              <button className="btn btn-success" style={{ flex: 1 }} onClick={handleGuardarCuotas}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Resultado del evento ─── */}
      {eventoResultado && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1e2a3a', padding: '2rem', borderRadius: '12px', maxWidth: '480px', width: '90%' }}>
            <h3 style={{ color: 'white', marginBottom: '0.5rem' }}>🏁 Cerrar Evento</h3>
            <p style={{ color: '#ccc', marginBottom: '0.5rem' }}><strong style={{ color: 'white' }}>{eventoResultado.equipoLocal} vs {eventoResultado.equipoVisitante}</strong></p>
            <p style={{ color: '#f0c040', fontSize: '0.85rem', marginBottom: '1.5rem' }}>Se resolverán todas las apuestas activas y se acreditarán las ganancias automáticamente.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {[
                { value: 'local',     label: `🏠 Ganó ${eventoResultado.equipoLocal}` },
                { value: 'empate',    label: '🤝 Empate' },
                { value: 'visitante', label: `✈️ Ganó ${eventoResultado.equipoVisitante}` }
              ].map(opt => (
                <button key={opt.value} className={`btn ${resultadoSeleccionado === opt.value ? 'btn-success' : 'btn-warning'}`} onClick={() => setResultadoSeleccionado(opt.value)} style={{ textAlign: 'left' }}>
                  {resultadoSeleccionado === opt.value ? '✔ ' : ''}{opt.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn btn-warning" style={{ flex: 1 }} onClick={() => setEventoResultado(null)} disabled={cerrandoEvento}>Cancelar</button>
              <button className="btn btn-success" style={{ flex: 1 }} onClick={handleCerrarEvento} disabled={!resultadoSeleccionado || cerrandoEvento}>
                {cerrandoEvento ? 'Cerrando...' : '🏁 Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Verificar/Rechazar Recarga ─── */}
      {mostrarModalRecarga && recargaSeleccionada && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
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
                <p style={{ color: '#ccc', marginBottom: '1rem' }}>Recarga de <strong style={{ color: 'white' }}>{recargaSeleccionada.nombreUsuario}</strong> por <strong style={{ color: '#e74c3c' }}>S/. {parseFloat(recargaSeleccionada.monto).toFixed(2)}</strong></p>
                <div className="form-group">
                  <label>Motivo</label>
                  <input type="text" value={motivoRecarga} onChange={e => setMotivoRecarga(e.target.value)} placeholder="Ej: Comprobante no válido" />
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button className="btn btn-warning" style={{ flex: 1 }} onClick={() => setMostrarModalRecarga(false)}>Cancelar</button>
                  <button className="btn btn-danger" style={{ flex: 1 }} onClick={async () => {
                    if (!motivoRecarga.trim()) return alert('Ingresa el motivo');
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
