import React, { useState, useEffect } from 'react';
import axios from 'axios';

function NuevaApuesta({ token }) {
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [eventos, setEventos] = useState([]);
  const [cargandoEventos, setCargandoEventos] = useState(true);
  const [saldo, setSaldo] = useState(0);

  const [apuesta, setApuesta] = useState({
    eventoId: '',
    tipoApuesta: 'local',
    montoApuesta: ''
  });

  useEffect(() => {
    const cargar = async () => {
      try {
        const [eventosRes, recargasRes] = await Promise.all([
          axios.get('/api/admin/eventos-activos'),
          axios.get('/api/recargas/mis-recargas', {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);
        setEventos(eventosRes.data);
        setSaldo(recargasRes.data.saldo);
      } catch (err) {
        setError('No pudimos cargar los datos');
      } finally {
        setCargandoEventos(false);
      }
    };
    cargar();
  }, [token]);

  const eventoSeleccionado = eventos.find(e => e.id === parseInt(apuesta.eventoId));

  const obtenerCuota = () => {
    if (!eventoSeleccionado) return 0;
    switch (apuesta.tipoApuesta) {
      case 'local':     return parseFloat(eventoSeleccionado.cuotaLocal)    || 0;
      case 'empate':    return parseFloat(eventoSeleccionado.cuotaEmpate)   || 0;
      case 'visitante': return parseFloat(eventoSeleccionado.cuotaVisitante) || 0;
      default: return 0;
    }
  };

  const cuotaActual = obtenerCuota();
  const montoNum = parseFloat(apuesta.montoApuesta) || 0;
  const gananciaEstimada = montoNum * cuotaActual;
  const saldoInsuficiente = montoNum > saldo;

  const handleCrearApuesta = async () => {
    if (!apuesta.eventoId || !apuesta.tipoApuesta || !apuesta.montoApuesta) {
      setError('Todos los campos son requeridos');
      return;
    }
    if (saldoInsuficiente) {
      setError(`Saldo insuficiente. Tu saldo es S/. ${saldo.toFixed(2)}`);
      return;
    }

    setLoading(true);
    setError('');
    setMensaje('');

    try {
      const response = await axios.post('/api/apuestas', {
        eventoId: parseInt(apuesta.eventoId),
        tipoApuesta: apuesta.tipoApuesta,
        montoApuesta: montoNum
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSaldo(response.data.saldoRestante);
      setMensaje(`✅ ¡Apuesta creada! Se descontaron S/. ${montoNum.toFixed(2)} de tu saldo. Saldo restante: S/. ${parseFloat(response.data.saldoRestante).toFixed(2)}`);
      setApuesta({ eventoId: '', tipoApuesta: 'local', montoApuesta: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear la apuesta');
    } finally {
      setLoading(false);
    }
  };

  if (cargandoEventos) {
    return <div className="container" style={{ textAlign: 'center', marginTop: '2rem', color: 'white' }}>Cargando eventos...</div>;
  }

  return (
    <div className="container">
      <h1 style={{ color: 'white', marginBottom: '2rem', textAlign: 'center' }}>🎲 Nueva Apuesta</h1>

      <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>

        {/* Saldo disponible */}
        <div style={{
          background: saldo > 0 ? 'rgba(76, 175, 80, 0.15)' : 'rgba(231, 76, 60, 0.15)',
          border: `2px solid ${saldo > 0 ? '#4CAF50' : '#e74c3c'}`,
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <strong style={{ color: 'white' }}>💰 Saldo disponible</strong>
            <h3 style={{ color: saldo > 0 ? '#4CAF50' : '#e74c3c', margin: '0.25rem 0 0' }}>
              S/. {parseFloat(saldo).toFixed(2)}
            </h3>
          </div>
          {saldo <= 0 && (
            <a href="/recargar" className="btn btn-success" style={{ fontSize: '0.85rem' }}>
              + Recargar
            </a>
          )}
        </div>

        {mensaje && <div className="alert alert-success">{mensaje}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        {eventos.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
            <p>❌ No hay eventos disponibles en este momento</p>
          </div>
        ) : (
          <>
            <h2 style={{ marginBottom: '1.5rem' }}>Seleccionar Evento</h2>

            <div className="form-group">
              <label>Partido</label>
              <select
                value={apuesta.eventoId}
                onChange={(e) => setApuesta({ ...apuesta, eventoId: e.target.value })}
              >
                <option value="">-- Elige un partido --</option>
                {eventos.map(evento => (
                  <option key={evento.id} value={evento.id}>
                    {evento.equipoLocal} vs {evento.equipoVisitante} ({evento.liga}) - {new Date(evento.fechaPartido).toLocaleDateString('es-PE')}
                  </option>
                ))}
              </select>
            </div>

            {eventoSeleccionado && (
              <>
                <div style={{
                  background: 'rgba(255,255,255,0.1)',
                  padding: '1rem',
                  borderRadius: '8px',
                  marginBottom: '1.5rem'
                }}>
                  <h3 style={{ color: '#fff', marginBottom: '0.5rem' }}>
                    {eventoSeleccionado.equipoLocal} vs {eventoSeleccionado.equipoVisitante}
                  </h3>
                  <p style={{ color: '#ccc', margin: 0, fontSize: '0.9rem' }}>
                    📅 {new Date(eventoSeleccionado.fechaPartido).toLocaleDateString('es-PE')} &nbsp;|&nbsp; {eventoSeleccionado.liga}
                  </p>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                    <span style={{ color: '#f0c040', fontSize: '0.85rem' }}>🏠 Local: {parseFloat(eventoSeleccionado.cuotaLocal).toFixed(2)}x</span>
                    <span style={{ color: '#f0c040', fontSize: '0.85rem' }}>🤝 Empate: {parseFloat(eventoSeleccionado.cuotaEmpate).toFixed(2)}x</span>
                    <span style={{ color: '#f0c040', fontSize: '0.85rem' }}>✈️ Visita: {parseFloat(eventoSeleccionado.cuotaVisitante).toFixed(2)}x</span>
                  </div>
                </div>

                <div className="form-group">
                  <label>Tipo de Apuesta</label>
                  <select
                    value={apuesta.tipoApuesta}
                    onChange={(e) => setApuesta({ ...apuesta, tipoApuesta: e.target.value })}
                  >
                    <option value="local">🏠 Ganador: {eventoSeleccionado.equipoLocal} ({parseFloat(eventoSeleccionado.cuotaLocal).toFixed(2)}x)</option>
                    <option value="empate">🤝 Empate ({parseFloat(eventoSeleccionado.cuotaEmpate).toFixed(2)}x)</option>
                    <option value="visitante">✈️ Ganador: {eventoSeleccionado.equipoVisitante} ({parseFloat(eventoSeleccionado.cuotaVisitante).toFixed(2)}x)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Monto a Apostar (S/.)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={saldo}
                    value={apuesta.montoApuesta}
                    onChange={(e) => setApuesta({ ...apuesta, montoApuesta: e.target.value })}
                    placeholder="Ej: 50"
                    style={{ borderColor: saldoInsuficiente && montoNum > 0 ? '#e74c3c' : undefined }}
                  />
                  {saldoInsuficiente && montoNum > 0 && (
                    <small style={{ color: '#e74c3c' }}>⚠️ Saldo insuficiente</small>
                  )}
                </div>

                {montoNum > 0 && !saldoInsuficiente && (
                  <div className="quote-section" style={{ background: 'rgba(76, 175, 80, 0.1)', border: '2px solid #4CAF50' }}>
                    <p><strong>💰 Ganancia Potencial: S/. {gananciaEstimada.toFixed(2)}</strong></p>
                    <p style={{ fontSize: '0.9rem', marginTop: '0.25rem', color: '#ccc' }}>
                      Cuota: {cuotaActual.toFixed(2)}x &nbsp;|&nbsp; Saldo tras apostar: S/. {(saldo - montoNum).toFixed(2)}
                    </p>
                  </div>
                )}

                <button
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '1rem' }}
                  onClick={handleCrearApuesta}
                  disabled={loading || saldoInsuficiente || montoNum <= 0}
                >
                  {loading ? 'Procesando...' : '✅ Confirmar Apuesta'}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default NuevaApuesta;
