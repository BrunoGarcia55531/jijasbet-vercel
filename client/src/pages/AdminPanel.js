import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const MARGEN_DEFAULT = 8;

function calcularCuotasLocal(pL, pE, pV, margenPct = MARGEN_DEFAULT) {
  const suma = pL + pE + pV;
  if (suma <= 0) return null;
  const m = margenPct / 100;
  const cL = Math.max(1.05, Math.min(50, 1 / ((pL/suma) * (1 + m))));
  const cE = Math.max(1.05, Math.min(50, 1 / ((pE/suma) * (1 + m))));
  const cV = Math.max(1.05, Math.min(50, 1 / ((pV/suma) * (1 + m))));
  const ovr = 1/cL + 1/cE + 1/cV;
  return { cuotaLocal: +cL.toFixed(3), cuotaEmpate: +cE.toFixed(3), cuotaVisitante: +cV.toFixed(3), margenEfectivo: +((ovr-1)*100).toFixed(2) };
}

const FASES = [
  { value: 'pre',            label: '🕐 Pre-partido' },
  { value: 'primera_mitad',  label: '▶️ 1ª Mitad' },
  { value: 'descanso',       label: '⏸ Descanso' },
  { value: 'segunda_mitad',  label: '▶️ 2ª Mitad' },
];

const BOTONES_EVENTO = [
  { tipo: 'gol_local',          label: '⚽ Gol Local',          color: '#4CAF50' },
  { tipo: 'gol_visitante',      label: '⚽ Gol Visitante',      color: '#4CAF50' },
  { tipo: 'penal_local',        label: '🟡 Penal Local',        color: '#f0c040' },
  { tipo: 'penal_visitante',    label: '🟡 Penal Visitante',    color: '#f0c040' },
  { tipo: 'roja_local',         label: '🟥 Roja Local',         color: '#e74c3c' },
  { tipo: 'roja_visitante',     label: '🟥 Roja Visitante',     color: '#e74c3c' },
  { tipo: 'amarilla_local',     label: '🟨 Amarilla Local',     color: '#f39c12' },
  { tipo: 'amarilla_visitante', label: '🟨 Amarilla Visitante', color: '#f39c12' },
  { tipo: 'lesion_local',       label: '🚑 Lesión Local',       color: '#888' },
  { tipo: 'lesion_visitante',   label: '🚑 Lesión Visitante',   color: '#888' },
];

function AdminPanel({ token }) {
  const [apuestas, setApuestas]         = useState([]);
  const [eventos, setEventos]           = useState([]);
  const [recargas, setRecargas]         = useState([]);
  const [estadisticas, setEstadisticas] = useState({});
  const [loading, setLoading]           = useState(true);
  const [pestaña, setPestaña]           = useState('eventos');

  // Recargas
  const [filtroRecargas, setFiltroRecargas]           = useState('pendiente');
  const [recargaSeleccionada, setRecargaSeleccionada] = useState(null);
  const [mostrarModalRecarga, setMostrarModalRecarga] = useState(false);
  const [motivoRecarga, setMotivoRecarga]             = useState('');

  // Crear evento
  const [nuevoEvento, setNuevoEvento] = useState({
    equipoLocal: '', equipoVisitante: '', liga: 'Primera División',
    fechaPartido: '', horaPartido: '',
    probLocal: '45', probEmpate: '25', probVisitante: '30',
    margen: String(MARGEN_DEFAULT)
  });
  const [cargandoEvento, setCargandoEvento] = useState(false);
  const [mensajeEvento, setMensajeEvento]   = useState('');
  const [errorEvento, setErrorEvento]       = useState('');

  // Panel en vivo
  const [eventoLive, setEventoLive]           = useState(null);
  const [minutoInput, setMinutoInput]         = useState('');
  const [faseInput, setFaseInput]             = useState('');
  const [registrandoEvento, setRegistrandoEvento] = useState(false);
  const [mensajeLive, setMensajeLive]         = useState('');

  // Resultado
  const [eventoResultado, setEventoResultado]             = useState(null);
  const [resultadoSeleccionado, setResultadoSeleccionado] = useState('');
  const [cerrandoEvento, setCerrandoEvento]               = useState(false);

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
      // Refrescar datos del evento live si está abierto
      if (eventoLive) {
        const ev = eventosRes.data.find(e => e.id === eventoLive.id);
        if (ev) setEventoLive(ev);
      }
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  }, [token, eventoLive?.id]);

  useEffect(() => {
    cargarDatos();
    const intervalo = setInterval(cargarDatos, 5000);
    return () => clearInterval(intervalo);
  }, [cargarDatos]);

  const previewCrear = calcularCuotasLocal(
    parseFloat(nuevoEvento.probLocal) || 0,
    parseFloat(nuevoEvento.probEmpate) || 0,
    parseFloat(nuevoEvento.probVisitante) || 0,
    parseFloat(nuevoEvento.margen) || MARGEN_DEFAULT
  );
  const sumaProbs = (parseFloat(nuevoEvento.probLocal)||0) + (parseFloat(nuevoEvento.probEmpate)||0) + (parseFloat(nuevoEvento.probVisitante)||0);

  const handleCrearEvento = async (e) => {
    e.preventDefault();
    setErrorEvento(''); setMensajeEvento('');
    if (!nuevoEvento.equipoLocal || !nuevoEvento.equipoVisitante || !nuevoEvento.fechaPartido)
      return setErrorEvento('Completa los campos requeridos');
    if (sumaProbs < 90 || sumaProbs > 110)
      return setErrorEvento(`Las probabilidades deben sumar ~100% (ahora: ${sumaProbs.toFixed(1)}%)`);
    setCargandoEvento(true);
    try {
      const fechaHora = nuevoEvento.horaPartido
        ? `${nuevoEvento.fechaPartido}T${nuevoEvento.horaPartido}:00`
        : `${nuevoEvento.fechaPartido}T00:00:00`;
      const res = await axios.post('/api/admin/eventos', {
        equipoLocal: nuevoEvento.equipoLocal, equipoVisitante: nuevoEvento.equipoVisitante,
        liga: nuevoEvento.liga, fechaPartido: fechaHora,
        probLocal: parseFloat(nuevoEvento.probLocal), probEmpate: parseFloat(nuevoEvento.probEmpate),
        probVisitante: parseFloat(nuevoEvento.probVisitante), margen: parseFloat(nuevoEvento.margen) || MARGEN_DEFAULT
      }, { headers: { Authorization: `Bearer ${token}` } });
      const c = res.data.cuotasCalculadas;
      setMensajeEvento(`✅ Creado — Cuotas: L ${c.cuotaLocal} / E ${c.cuotaEmpate} / V ${c.cuotaVisitante}`);
      setNuevoEvento({ equipoLocal: '', equipoVisitante: '', liga: 'Primera División', fechaPartido: '', horaPartido: '', probLocal: '45', probEmpate: '25', probVisitante: '30', margen: String(MARGEN_DEFAULT) });
      cargarDatos();
    } catch (err) { setErrorEvento(err.response?.data?.error || 'Error'); }
    finally { setCargandoEvento(false); }
  };

  const handleEventoLive = async (tipo) => {
    if (!eventoLive) return;
    setRegistrandoEvento(true);
    setMensajeLive('');
    try {
      const res = await axios.post(`/api/admin/eventos/${eventoLive.id}/live`, {
        tipo,
        minuto: parseInt(minutoInput) || parseInt(eventoLive.minuto) || 0,
        fase: faseInput || eventoLive.fase
      }, { headers: { Authorization: `Bearer ${token}` } });

      const nc = res.data.nuevasCuotas;
      const ca = res.data.cuotasAnteriores;
      setMensajeLive(`${res.data.message} → L: ${ca.local}→${nc.cuotaLocal} / E: ${ca.empate}→${nc.cuotaEmpate} / V: ${ca.visitante}→${nc.cuotaVisitante}`);
      cargarDatos();
    } catch (err) { setMensajeLive('❌ Error: ' + err.response?.data?.error); }
    finally { setRegistrandoEvento(false); }
  };

  const handleDeshacerUltimo = async () => {
    if (!eventoLive) return;
    try {
      const res = await axios.delete(`/api/admin/eventos/${eventoLive.id}/live`, { headers: { Authorization: `Bearer ${token}` } });
      setMensajeLive(`↩️ ${res.data.message}`);
      cargarDatos();
    } catch (err) { setMensajeLive('❌ Error: ' + err.response?.data?.error); }
  };

  const handleActualizarMinuto = async () => {
    if (!eventoLive || !minutoInput) return;
    try {
      await axios.put(`/api/admin/eventos/${eventoLive.id}/minuto`,
        { minuto: parseInt(minutoInput), fase: faseInput || undefined },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMensajeLive(`✅ Minuto actualizado a ${minutoInput}`);
      cargarDatos();
    } catch (err) { setMensajeLive('❌ Error: ' + err.response?.data?.error); }
  };

  const handleCerrarEvento = async () => {
    if (!resultadoSeleccionado) return alert('Selecciona un resultado');
    setCerrandoEvento(true);
    try {
      const res = await axios.put(`/api/admin/eventos/${eventoResultado.id}/resultado`,
        { resultado: resultadoSeleccionado },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEventoResultado(null); setResultadoSeleccionado('');
      cargarDatos(); alert(res.data.message);
    } catch (err) { alert('Error: ' + err.response?.data?.error); }
    finally { setCerrandoEvento(false); }
  };

  const handleCancelarEvento = async (eventoId) => {
    if (!window.confirm('¿Cancelar este evento? Se devolverá el saldo a todos los apostadores.')) return;
    try {
      await axios.put(`/api/admin/eventos/${eventoId}`, { estado: 'cancelado' }, { headers: { Authorization: `Bearer ${token}` } });
      cargarDatos(); alert('Evento cancelado. Saldos devueltos.');
    } catch (err) { alert('Error: ' + err.response?.data?.error); }
  };

  if (loading) return <div className="container" style={{ textAlign: 'center', marginTop: '2rem' }}>Cargando...</div>;

  const pendientesRecarga = recargas.filter(r => r.estado === 'pendiente').length;
  const historialLive = eventoLive ? JSON.parse(eventoLive.historialEventos || '[]') : [];

  const etiquetaEvento = {
    gol_local: '⚽ Gol Local', gol_visitante: '⚽ Gol Visitante',
    penal_local: '🟡 Penal Local', penal_visitante: '🟡 Penal Visitante',
    roja_local: '🟥 Roja Local', roja_visitante: '🟥 Roja Visitante',
    amarilla_local: '🟨 Amarilla Local', amarilla_visitante: '🟨 Amarilla Visitante',
    lesion_local: '🚑 Lesión Local', lesion_visitante: '🚑 Lesión Visitante'
  };

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
        <button className={`btn ${pestaña === 'eventos'  ? 'btn-primary' : 'btn-warning'}`} onClick={() => setPestaña('eventos')}>📅 Eventos</button>
        <button className={`btn ${pestaña === 'live'     ? 'btn-primary' : 'btn-warning'}`} onClick={() => setPestaña('live')}>
          🔴 En Vivo {eventos.filter(e => e.fase !== 'pre' && e.estado === 'activo').length > 0 && <span style={{ background: '#e74c3c', color: 'white', borderRadius: '50%', padding: '0.1rem 0.4rem', fontSize: '0.75rem', marginLeft: '0.5rem' }}>{eventos.filter(e => e.fase !== 'pre' && e.estado === 'activo').length}</span>}
        </button>
        <button className={`btn ${pestaña === 'apuestas' ? 'btn-primary' : 'btn-warning'}`} onClick={() => setPestaña('apuestas')}>🎲 Apuestas</button>
        <button className={`btn ${pestaña === 'recargas' ? 'btn-primary' : 'btn-success'}`} onClick={() => setPestaña('recargas')}>
          💳 Recargas {pendientesRecarga > 0 && <span style={{ background: '#e74c3c', color: 'white', borderRadius: '50%', padding: '0.1rem 0.4rem', fontSize: '0.75rem', marginLeft: '0.5rem' }}>{pendientesRecarga}</span>}
        </button>
      </div>

      {/* ═══ EVENTOS ═══ */}
      {pestaña === 'eventos' && (
        <>
          <div className="card" style={{ marginBottom: '2rem' }}>
            <h2 style={{ marginBottom: '0.5rem' }}>📅 Crear Nuevo Evento</h2>
            <p style={{ color: '#999', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Ingresa probabilidades estimadas (%) — las cuotas se calculan con margen del {nuevoEvento.margen}%.
            </p>
            {errorEvento   && <div className="alert alert-error">{errorEvento}</div>}
            {mensajeEvento && <div className="alert alert-success">{mensajeEvento}</div>}
            <form onSubmit={handleCrearEvento}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div><label>Equipo Local</label>
                  <input list="eq1" type="text" value={nuevoEvento.equipoLocal} onChange={e => setNuevoEvento({...nuevoEvento, equipoLocal: e.target.value})} placeholder="Ej: Alianza Lima" required />
                  <datalist id="eq1">{equiposSugeridos.map(eq => <option key={eq} value={eq} />)}</datalist>
                </div>
                <div><label>Equipo Visitante</label>
                  <input list="eq2" type="text" value={nuevoEvento.equipoVisitante} onChange={e => setNuevoEvento({...nuevoEvento, equipoVisitante: e.target.value})} placeholder="Ej: Universitario" required />
                  <datalist id="eq2">{equiposSugeridos.map(eq => <option key={eq} value={eq} />)}</datalist>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div><label>Liga</label>
                  <select value={nuevoEvento.liga} onChange={e => setNuevoEvento({...nuevoEvento, liga: e.target.value})}>
                    {ligas.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div><label>Fecha</label><input type="date" value={nuevoEvento.fechaPartido} onChange={e => setNuevoEvento({...nuevoEvento, fechaPartido: e.target.value})} required /></div>
                <div><label>Hora (opcional)</label><input type="time" value={nuevoEvento.horaPartido} onChange={e => setNuevoEvento({...nuevoEvento, horaPartido: e.target.value})} /></div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <strong style={{ color: 'white' }}>🎯 Probabilidades estimadas (%)</strong>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <label style={{ color: '#999', fontSize: '0.85rem' }}>Margen:</label>
                    <input type="number" step="0.5" min="2" max="25" value={nuevoEvento.margen} onChange={e => setNuevoEvento({...nuevoEvento, margen: e.target.value})} style={{ width: '65px' }} />
                    <span style={{ color: '#999', fontSize: '0.85rem' }}>%</span>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  {[
                    { key: 'probLocal',     label: `🏠 ${nuevoEvento.equipoLocal || 'Local'}`,       cuota: previewCrear?.cuotaLocal },
                    { key: 'probEmpate',    label: '🤝 Empate',                                        cuota: previewCrear?.cuotaEmpate },
                    { key: 'probVisitante', label: `✈️ ${nuevoEvento.equipoVisitante || 'Visitante'}`, cuota: previewCrear?.cuotaVisitante }
                  ].map(({ key, label, cuota }) => (
                    <div key={key}>
                      <label style={{ fontSize: '0.85rem' }}>{label}</label>
                      <input type="number" step="0.5" min="1" max="98" value={nuevoEvento[key]} onChange={e => setNuevoEvento({...nuevoEvento, [key]: e.target.value})} />
                      {cuota && <div style={{ textAlign: 'center', marginTop: '0.3rem' }}><span style={{ background: '#f0c040', color: '#1a1a2e', borderRadius: '4px', padding: '0.15rem 0.5rem', fontWeight: 'bold', fontSize: '0.95rem' }}>{cuota}x</span></div>}
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#999', fontSize: '0.85rem' }}>Suma: <strong style={{ color: Math.abs(sumaProbs - 100) <= 5 ? '#4CAF50' : '#e74c3c' }}>{sumaProbs.toFixed(1)}%</strong></span>
                  {previewCrear && <span style={{ color: '#999', fontSize: '0.85rem' }}>Margen efectivo: <strong style={{ color: '#f0c040' }}>{previewCrear.margenEfectivo}%</strong></span>}
                </div>
              </div>
              <button type="submit" className="btn btn-success" disabled={cargandoEvento || !previewCrear}>
                {cargandoEvento ? 'Creando...' : '✅ Crear Evento'}
              </button>
            </form>
          </div>

          <div className="card">
            <h2 style={{ marginBottom: '1.5rem' }}>📋 Todos los Eventos</h2>
            {eventos.length === 0 ? <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>No hay eventos</p> : (
              <table className="table">
                <thead><tr><th>Partido</th><th>Fase / Marcador</th><th>Cuotas (L/E/V)</th><th>Estado</th><th>Acciones</th></tr></thead>
                <tbody>
                  {eventos.map(ev => (
                    <tr key={ev.id}>
                      <td>
                        <strong>{ev.equipoLocal} vs {ev.equipoVisitante}</strong><br />
                        <small style={{ color: '#666' }}>{ev.liga} · {new Date(ev.fechaPartido).toLocaleDateString('es-PE')}</small>
                      </td>
                      <td>
                        <span style={{ color: ev.fase === 'pre' ? '#888' : '#4CAF50', fontSize: '0.85rem' }}>
                          {ev.fase === 'pre' ? '🕐 Pre-partido' : ev.fase === 'primera_mitad' ? `▶️ 1ª · ${ev.minuto}'` : ev.fase === 'descanso' ? '⏸ Descanso' : ev.fase === 'segunda_mitad' ? `▶️ 2ª · ${ev.minuto}'` : '🏁 Finalizado'}
                        </span>
                        {(parseInt(ev.golesLocal) > 0 || parseInt(ev.golesVisitante) > 0) && (
                          <div style={{ fontWeight: 'bold', color: 'white', fontSize: '1.1rem' }}>
                            {ev.golesLocal} - {ev.golesVisitante}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: '0.9rem' }}>
                        🏠 <strong style={{ color: '#f0c040' }}>{Number(ev.cuotaLocal).toFixed(3)}x</strong><br />
                        🤝 {Number(ev.cuotaEmpate).toFixed(3)}x<br />
                        ✈️ <strong style={{ color: '#f0c040' }}>{Number(ev.cuotaVisitante).toFixed(3)}x</strong>
                      </td>
                      <td><span style={{ color: ev.estado === 'activo' ? '#4CAF50' : ev.estado === 'finalizado' ? '#888' : '#e74c3c', fontWeight: 'bold', textTransform: 'capitalize' }}>{ev.estado}</span></td>
                      <td>
                        {ev.estado === 'activo' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <button className="btn btn-warning" style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }} onClick={() => { setEventoLive(ev); setMinutoInput(String(ev.minuto || '')); setFaseInput(ev.fase || 'pre'); setPestaña('live'); }}>🔴 Control Live</button>
                            <button className="btn btn-success" style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }} onClick={() => { setEventoResultado(ev); setResultadoSeleccionado(''); }}>🏁 Resultado</button>
                            <button className="btn btn-danger"  style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }} onClick={() => handleCancelarEvento(ev.id)}>🚫 Cancelar</button>
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

      {/* ═══ EN VIVO ═══ */}
      {pestaña === 'live' && (
        <>
          {/* Selector de evento */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ marginBottom: '1rem' }}>🔴 Control En Vivo</h2>
            <div className="form-group">
              <label>Seleccionar partido</label>
              <select value={eventoLive?.id || ''} onChange={e => {
                const ev = eventos.find(ev => ev.id === parseInt(e.target.value));
                setEventoLive(ev || null);
                if (ev) { setMinutoInput(String(ev.minuto || '')); setFaseInput(ev.fase || 'pre'); }
                setMensajeLive('');
              }}>
                <option value="">-- Elige un partido activo --</option>
                {eventos.filter(e => e.estado === 'activo').map(e => (
                  <option key={e.id} value={e.id}>{e.equipoLocal} vs {e.equipoVisitante}</option>
                ))}
              </select>
            </div>
          </div>

          {eventoLive && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

              {/* Panel izquierdo: marcador + cuotas + botones */}
              <div>
                {/* Marcador */}
                <div className="card" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                  <p style={{ color: '#ccc', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                    {eventoLive.liga} · {FASES.find(f => f.value === eventoLive.fase)?.label || eventoLive.fase}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', marginBottom: '1rem' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: '#ccc', fontSize: '0.85rem' }}>{eventoLive.equipoLocal}</div>
                      <div style={{ fontSize: '3.5rem', fontWeight: 'bold', color: 'white', lineHeight: 1 }}>{eventoLive.golesLocal}</div>
                    </div>
                    <div style={{ color: '#666', fontSize: '2rem' }}>—</div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: '#ccc', fontSize: '0.85rem' }}>{eventoLive.equipoVisitante}</div>
                      <div style={{ fontSize: '3.5rem', fontWeight: 'bold', color: 'white', lineHeight: 1 }}>{eventoLive.golesVisitante}</div>
                    </div>
                  </div>
                  {(parseInt(eventoLive.rojaLocal) > 0 || parseInt(eventoLive.rojaVisitante) > 0) && (
                    <p style={{ color: '#e74c3c', fontSize: '0.85rem' }}>
                      🟥 {eventoLive.equipoLocal}: {eventoLive.rojaLocal} · {eventoLive.equipoVisitante}: {eventoLive.rojaVisitante}
                    </p>
                  )}
                </div>

                {/* Cuotas actuales */}
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ marginBottom: '1rem' }}>📊 Cuotas actuales</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', textAlign: 'center' }}>
                    {[
                      { label: `🏠 ${eventoLive.equipoLocal}`, cuota: eventoLive.cuotaLocal },
                      { label: '🤝 Empate', cuota: eventoLive.cuotaEmpate },
                      { label: `✈️ ${eventoLive.equipoVisitante}`, cuota: eventoLive.cuotaVisitante }
                    ].map(({ label, cuota }) => (
                      <div key={label} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '0.75rem' }}>
                        <div style={{ color: '#ccc', fontSize: '0.8rem', marginBottom: '0.3rem' }}>{label}</div>
                        <div style={{ color: '#f0c040', fontSize: '1.4rem', fontWeight: 'bold' }}>{Number(cuota).toFixed(3)}x</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Minuto y fase */}
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ marginBottom: '1rem' }}>🕐 Minuto y Fase</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ fontSize: '0.85rem' }}>Minuto</label>
                      <input type="number" min="0" max="120" value={minutoInput} onChange={e => setMinutoInput(e.target.value)} placeholder="Ej: 45" />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.85rem' }}>Fase del partido</label>
                      <select value={faseInput} onChange={e => setFaseInput(e.target.value)}>
                        {FASES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <button className="btn btn-warning" style={{ width: '100%' }} onClick={handleActualizarMinuto}>
                    Actualizar minuto / fase
                  </button>
                </div>
              </div>

              {/* Panel derecho: botones de eventos + historial */}
              <div>
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ marginBottom: '1rem' }}>⚡ Registrar Evento</h3>
                  {mensajeLive && (
                    <div style={{ background: mensajeLive.startsWith('❌') ? 'rgba(231,76,60,0.15)' : 'rgba(76,175,80,0.15)', border: `1px solid ${mensajeLive.startsWith('❌') ? '#e74c3c' : '#4CAF50'}`, borderRadius: '6px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.82rem', color: 'white' }}>
                      {mensajeLive}
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '1rem' }}>
                    {BOTONES_EVENTO.map(({ tipo, label, color }) => (
                      <button
                        key={tipo}
                        disabled={registrandoEvento}
                        onClick={() => handleEventoLive(tipo)}
                        style={{
                          background: `${color}22`,
                          border: `2px solid ${color}`,
                          color: 'white',
                          borderRadius: '8px',
                          padding: '0.6rem 0.5rem',
                          cursor: 'pointer',
                          fontSize: '0.88rem',
                          fontWeight: 'bold',
                          transition: 'all 0.15s',
                          opacity: registrandoEvento ? 0.6 : 1
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <button className="btn btn-danger" style={{ width: '100%', fontSize: '0.85rem' }} onClick={handleDeshacerUltimo} disabled={historialLive.length === 0}>
                    ↩️ Deshacer último evento
                  </button>
                </div>

                {/* Historial */}
                <div className="card">
                  <h3 style={{ marginBottom: '1rem' }}>📋 Historial del partido</h3>
                  {historialLive.length === 0 ? (
                    <p style={{ color: '#666', fontSize: '0.85rem', textAlign: 'center' }}>Sin eventos registrados</p>
                  ) : (
                    <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                      {[...historialLive].reverse().map((ev, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.88rem' }}>
                          <span>{etiquetaEvento[ev.tipo] || ev.tipo}</span>
                          <span style={{ color: '#888' }}>min. {ev.minuto}'</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {!eventoLive && (
            <div className="card" style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
              <p style={{ fontSize: '1.1rem' }}>Selecciona un partido activo para controlar el en vivo</p>
            </div>
          )}
        </>
      )}

      {/* ═══ APUESTAS ═══ */}
      {pestaña === 'apuestas' && (
        <div className="card">
          <h2 style={{ marginBottom: '1.5rem' }}>🎲 Todas las Apuestas</h2>
          {apuestas.length === 0 ? <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>No hay apuestas</p> : (
            <table className="table">
              <thead><tr><th>Usuario</th><th>Partido</th><th>Apuesta</th><th>Monto</th><th>Cuota</th><th>Ganancia</th><th>Estado</th></tr></thead>
              <tbody>
                {apuestas.map(a => (
                  <tr key={a.id}>
                    <td>{a.nombreUsuario}</td>
                    <td><strong>{a.Evento?.equipoLocal} vs {a.Evento?.equipoVisitante}</strong><br /><small style={{ color: '#666' }}>{a.Evento?.liga}</small></td>
                    <td>{a.tipoApuesta === 'local' && `🏠 ${a.Evento?.equipoLocal}`}{a.tipoApuesta === 'empate' && '🤝 Empate'}{a.tipoApuesta === 'visitante' && `✈️ ${a.Evento?.equipoVisitante}`}</td>
                    <td>S/. {Number(a.montoApuesta).toFixed(2)}</td>
                    <td>{Number(a.cuota||1).toFixed(3)}x</td>
                    <td>S/. {Number(a.montoGanancia).toFixed(2)}</td>
                    <td><span style={{ color: a.estado==='ganada'?'#4CAF50':a.estado==='perdida'?'#e74c3c':a.estado==='cancelada'?'#888':'#f0c040', fontWeight:'bold' }}>{a.estado==='ganada'?'✅':a.estado==='perdida'?'❌':a.estado==='cancelada'?'🚫':'⏳'} {a.estado}</span></td>
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
            {['pendiente','verificado','rechazado','todas'].map(estado => (
              <button key={estado} className={`btn ${filtroRecargas===estado?'btn-primary':estado==='verificado'?'btn-success':estado==='rechazado'?'btn-danger':'btn-warning'}`} onClick={() => setFiltroRecargas(estado)}>
                {estado.charAt(0).toUpperCase()+estado.slice(1)} {estado!=='todas'&&`(${recargas.filter(r=>r.estado===estado).length})`}
              </button>
            ))}
          </div>
          {recargas.filter(r=>filtroRecargas==='todas'||r.estado===filtroRecargas).length===0
            ? <p style={{ textAlign:'center', color:'#999', padding:'2rem' }}>Sin recargas</p>
            : (
              <table className="table">
                <thead><tr><th>Usuario</th><th>Monto</th><th>N° Transacción</th><th>Comprobante</th><th>Estado</th><th>Fecha</th><th>Acciones</th></tr></thead>
                <tbody>
                  {recargas.filter(r=>filtroRecargas==='todas'||r.estado===filtroRecargas).map(r => (
                    <tr key={r.id}>
                      <td><strong>{r.nombreUsuario}</strong></td>
                      <td><strong style={{ color:'#4CAF50' }}>S/. {parseFloat(r.monto).toFixed(2)}</strong></td>
                      <td style={{ fontSize:'0.85rem' }}>{r.numeroTransaccion}</td>
                      <td>{r.comprobante && <img src={r.comprobante} alt="Comprobante" style={{ width:'60px', height:'60px', objectFit:'cover', borderRadius:'4px', cursor:'pointer' }} onClick={() => window.open(r.comprobante,'_blank')} />}</td>
                      <td><span style={{ color:r.estado==='verificado'?'#4CAF50':r.estado==='rechazado'?'#e74c3c':'#f0c040', fontWeight:'bold', textTransform:'capitalize' }}>{r.estado}</span></td>
                      <td style={{ fontSize:'0.85rem', color:'#999' }}>{new Date(r.createdAt).toLocaleDateString('es-PE')}</td>
                      <td>
                        {r.estado==='pendiente' && (
                          <div style={{ display:'flex', gap:'0.5rem' }}>
                            <button className="btn btn-success" style={{ fontSize:'0.8rem', padding:'0.3rem 0.7rem' }} onClick={() => { setRecargaSeleccionada(r); setMostrarModalRecarga('verificar'); }}>✅</button>
                            <button className="btn btn-danger"  style={{ fontSize:'0.8rem', padding:'0.3rem 0.7rem' }} onClick={() => { setRecargaSeleccionada(r); setMotivoRecarga(''); setMostrarModalRecarga('rechazar'); }}>❌</button>
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

      {/* ─── Modal: Resultado ─── */}
      {eventoResultado && (
        <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'#1e2a3a', padding:'2rem', borderRadius:'12px', maxWidth:'480px', width:'90%' }}>
            <h3 style={{ color:'white', marginBottom:'0.5rem' }}>🏁 Cerrar Evento</h3>
            <p style={{ color:'#ccc', marginBottom:'0.5rem' }}><strong style={{ color:'white' }}>{eventoResultado.equipoLocal} vs {eventoResultado.equipoVisitante}</strong></p>
            <p style={{ color:'#f0c040', fontSize:'0.85rem', marginBottom:'1.5rem' }}>Se resolverán todas las apuestas activas y se acreditarán las ganancias automáticamente.</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem', marginBottom:'1.5rem' }}>
              {[
                { value:'local',     label:`🏠 Ganó ${eventoResultado.equipoLocal}` },
                { value:'empate',    label:'🤝 Empate' },
                { value:'visitante', label:`✈️ Ganó ${eventoResultado.equipoVisitante}` }
              ].map(opt => (
                <button key={opt.value} className={`btn ${resultadoSeleccionado===opt.value?'btn-success':'btn-warning'}`} onClick={() => setResultadoSeleccionado(opt.value)} style={{ textAlign:'left' }}>
                  {resultadoSeleccionado===opt.value?'✔ ':''}{opt.label}
                </button>
              ))}
            </div>
            <div style={{ display:'flex', gap:'1rem' }}>
              <button className="btn btn-warning" style={{ flex:1 }} onClick={() => setEventoResultado(null)} disabled={cerrandoEvento}>Cancelar</button>
              <button className="btn btn-success" style={{ flex:1 }} onClick={handleCerrarEvento} disabled={!resultadoSeleccionado||cerrandoEvento}>{cerrandoEvento?'Cerrando...':'🏁 Confirmar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Recargas ─── */}
      {mostrarModalRecarga && recargaSeleccionada && (
        <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background:'#1e2a3a', padding:'2rem', borderRadius:'12px', maxWidth:'450px', width:'90%' }}>
            {mostrarModalRecarga==='verificar' ? (
              <>
                <h3 style={{ color:'white', marginBottom:'1rem' }}>✅ Verificar Recarga</h3>
                <p style={{ color:'#ccc', marginBottom:'1.5rem' }}>¿Confirmas que <strong style={{ color:'white' }}>{recargaSeleccionada.nombreUsuario}</strong> pagó <strong style={{ color:'#4CAF50' }}>S/. {parseFloat(recargaSeleccionada.monto).toFixed(2)}</strong>?<br /><br />El saldo se acreditará automáticamente.</p>
                <div style={{ display:'flex', gap:'1rem' }}>
                  <button className="btn btn-warning" style={{ flex:1 }} onClick={() => setMostrarModalRecarga(false)}>Cancelar</button>
                  <button className="btn btn-success" style={{ flex:1 }} onClick={async () => {
                    try {
                      await axios.put(`/api/recargas/${recargaSeleccionada.id}/verificar`, {}, { headers: { Authorization:`Bearer ${token}` } });
                      setMostrarModalRecarga(false); cargarDatos(); alert(`✅ S/. ${parseFloat(recargaSeleccionada.monto).toFixed(2)} acreditados.`);
                    } catch(err) { alert('Error: '+err.response?.data?.error); }
                  }}>Confirmar</button>
                </div>
              </>
            ) : (
              <>
                <h3 style={{ color:'white', marginBottom:'1rem' }}>❌ Rechazar Recarga</h3>
                <p style={{ color:'#ccc', marginBottom:'1rem' }}>Recarga de <strong style={{ color:'white' }}>{recargaSeleccionada.nombreUsuario}</strong> por <strong style={{ color:'#e74c3c' }}>S/. {parseFloat(recargaSeleccionada.monto).toFixed(2)}</strong></p>
                <div className="form-group"><label>Motivo</label><input type="text" value={motivoRecarga} onChange={e => setMotivoRecarga(e.target.value)} placeholder="Ej: Comprobante no válido" /></div>
                <div style={{ display:'flex', gap:'1rem', marginTop:'1rem' }}>
                  <button className="btn btn-warning" style={{ flex:1 }} onClick={() => setMostrarModalRecarga(false)}>Cancelar</button>
                  <button className="btn btn-danger" style={{ flex:1 }} onClick={async () => {
                    if (!motivoRecarga.trim()) return alert('Ingresa el motivo');
                    try {
                      await axios.put(`/api/recargas/${recargaSeleccionada.id}/rechazar`, { motivo:motivoRecarga }, { headers: { Authorization:`Bearer ${token}` } });
                      setMostrarModalRecarga(false); cargarDatos(); alert('Recarga rechazada');
                    } catch(err) { alert('Error: '+err.response?.data?.error); }
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
