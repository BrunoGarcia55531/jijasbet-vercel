import React, { useState, useEffect } from 'react';
import axios from 'axios';

function NuevaApuesta({ token, usuario }) {
  const [paso, setPaso] = useState(1); // 1: elegir evento, 2: pago
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [imagenBase64, setImagenBase64] = useState('');
  const [previewImagen, setPreviewImagen] = useState('');
  const [eventos, setEventos] = useState([]);
  const [cargandoEventos, setCargandoEventos] = useState(true);

  // Formulario apuesta
  const [apuesta, setApuesta] = useState({
    eventoId: '',
    tipoApuesta: 'local',
    montoApuesta: ''
  });

  // Formulario pago
  const [pago, setPago] = useState({
    numeroTransaccion: '',
    montoPagado: ''
  });

  const [apuestaCreada, setApuestaCreada] = useState(null);

  useEffect(() => {
    const cargarEventos = async () => {
      try {
        const res = await axios.get('/api/admin/eventos-activos');
        setEventos(res.data);
      } catch (err) {
        console.error('Error cargando eventos:', err);
        setError('No pudimos cargar los eventos disponibles');
      } finally {
        setCargandoEventos(false);
      }
    };
    cargarEventos();
  }, []);

  const eventoSeleccionado = eventos.find(e => e.id === parseInt(apuesta.eventoId));
  
  // Seleccionar cuota según tipo de apuesta
  const obtenerCuota = () => {
    if (!eventoSeleccionado) return 0;
    switch (apuesta.tipoApuesta) {
      case 'local':
        return eventoSeleccionado.cuotaLocal || eventoSeleccionado.cuota || 0;
      case 'empate':
        return eventoSeleccionado.cuotaEmpate || 0;
      case 'visitante':
        return eventoSeleccionado.cuotaVisitante || eventoSeleccionado.cuota || 0;
      default:
        return 0;
    }
  };

  const cuotaActual = obtenerCuota();
  const gananciaEstimada = eventoSeleccionado && apuesta.montoApuesta 
    ? apuesta.montoApuesta * cuotaActual 
    : 0;

  const handleCrearApuesta = async () => {
    if (!apuesta.eventoId || !apuesta.tipoApuesta || !apuesta.montoApuesta) {
      setError('Todos los campos son requeridos');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post('/api/apuestas', {
        eventoId: parseInt(apuesta.eventoId),
        tipoApuesta: apuesta.tipoApuesta,
        montoApuesta: parseFloat(apuesta.montoApuesta)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setApuestaCreada(response.data);
      setPaso(2);
      setMensaje('¡Apuesta creada! Ahora sube tu comprobante de pago Yape');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear la apuesta');
    } finally {
      setLoading(false);
    }
  };

  const handleImagenChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagenBase64(reader.result);
        setPreviewImagen(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubirComprobante = async () => {
    if (!imagenBase64 || !pago.numeroTransaccion || !pago.montoPagado) {
      setError('Todos los campos son requeridos');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await axios.post(`/api/apuestas/${apuestaCreada.id}/comprobante`, {
        comprobante: imagenBase64,
        numeroTransaccion: pago.numeroTransaccion,
        montoPagado: parseFloat(pago.montoPagado)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setMensaje('✅ ¡Comprobante enviado! El administrador lo verificará pronto');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al enviar comprobante');
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
        {mensaje && <div className="alert alert-success">{mensaje}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        {paso === 1 ? (
          // Paso 1: Elegir Evento y Apuesta
          <>
            <h2 style={{ marginBottom: '1.5rem' }}>Seleccionar Evento</h2>

            {eventos.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
                <p>❌ No hay eventos disponibles en este momento</p>
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label>Selecciona un Partido</label>
                  <select
                    value={apuesta.eventoId}
                    onChange={(e) => setApuesta({ ...apuesta, eventoId: e.target.value })}
                    required
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
                      background: 'rgba(255, 255, 255, 0.1)',
                      padding: '1rem',
                      borderRadius: '8px',
                      marginBottom: '1.5rem'
                    }}>
                      <h3 style={{ color: '#fff', marginBottom: '0.5rem' }}>
                        {eventoSeleccionado.equipoLocal} vs {eventoSeleccionado.equipoVisitante}
                      </h3>
                      <p style={{ color: '#ccc', marginBottom: '0' }}>
                        {eventoSeleccionado.liga} - Cuota: <strong>{Number(eventoSeleccionado.cuota).toFixed(2)}x</strong>
                      </p>
                      <p style={{ color: '#ccc', marginBottom: '0', fontSize: '0.9rem' }}>
                        📅 {new Date(eventoSeleccionado.fechaPartido).toLocaleDateString('es-PE')} {new Date(eventoSeleccionado.fechaPartido).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    <h2 style={{ marginBottom: '1.5rem' }}>Detalles de la Apuesta</h2>

                    <div className="form-group">
                      <label>Tipo de Apuesta</label>
                      <select
                        value={apuesta.tipoApuesta}
                        onChange={(e) => setApuesta({
                          ...apuesta,
                          tipoApuesta: e.target.value
                        })}
                      >
                        <option value="local">🏠 Ganador: {eventoSeleccionado.equipoLocal}</option>
                        <option value="empate">🤝 Empate</option>
                        <option value="visitante">✈️ Ganador: {eventoSeleccionado.equipoVisitante}</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Monto a Apostar (S/.)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={apuesta.montoApuesta}
                        onChange={(e) => setApuesta({
                          ...apuesta,
                          montoApuesta: e.target.value
                        })}
                        placeholder="Ej: 100"
                      />
                    </div>

                    {apuesta.montoApuesta && (
                      <div className="quote-section" style={{ background: 'rgba(76, 175, 80, 0.1)', border: '2px solid #4CAF50' }}>
                        <p><strong>💰 Ganancia Potencial: S/. {gananciaEstimada.toFixed(2)}</strong></p>
                        <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                          Si tu apuesta es correcta, recibirás: S/. {gananciaEstimada.toFixed(2)}
                        </p>
                      </div>
                    )}

                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', marginTop: '1rem' }}
                      onClick={handleCrearApuesta}
                      disabled={loading}
                    >
                      {loading ? 'Creando...' : '✅ Crear Apuesta y Proceder al Pago'}
                    </button>
                  </>
                )}
              </>
            )}
          </>
        ) : (
          // Paso 2: Pago Yape
          <>
            <h2 style={{ marginBottom: '1.5rem' }}>💳 Pago a través de Yape</h2>

            <div className="quote-section" style={{ background: '#fff3cd' }}>
              <p><strong>✅ Apuesta Creada</strong></p>
              <p>Monto: S/. {Number(apuestaCreada?.montoApuesta).toFixed(2)}</p>
              <p>ID Apuesta: <code style={{ background: '#fff', padding: '0.5rem', borderRadius: '4px' }}>{apuestaCreada?.id}</code></p>
            </div>

            <h3 style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>✍️ Instrucciones:</h3>
            <ol style={{ marginBottom: '1.5rem', lineHeight: '1.8' }}>
              <li>Abre la app de <strong>Yape</strong></li>
              <li>Envía S/. {Number(apuestaCreada?.montoApuesta).toFixed(2)} al número mostrado en el QR</li>
              <li>Guarda el <strong>número de transacción</strong></li>
              <li>Toma una <strong>captura de pantalla del comprobante</strong></li>
              <li>Completa el formulario abajo</li>
            </ol>

            {/* QR Simulado */}
            <div style={{ 
              background: '#f0f0f0', 
              padding: '2rem', 
              textAlign: 'center', 
              borderRadius: '8px',
              marginBottom: '1.5rem',
              border: '2px dashed #999'
            }}>
              <p style={{ color: '#666', marginBottom: '1rem' }}>📱 Código QR de Yape (para demo)</p>
              <div style={{ 
                width: '200px', 
                height: '200px', 
                background: 'white', 
                margin: '0 auto', 
                border: '2px solid #999',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '3rem'
              }}>
                🔳
              </div>
              <p style={{ marginTop: '1rem', color: '#666' }}>Número de celular: 951 234 567</p>
            </div>

            <div className="form-group">
              <label>Número de Transacción Yape</label>
              <input
                type="text"
                value={pago.numeroTransaccion}
                onChange={(e) => setPago({
                  ...pago,
                  numeroTransaccion: e.target.value
                })}
                placeholder="Ej: TXN-ABC123XYZ"
                required
              />
            </div>

            <div className="form-group">
              <label>Monto Pagado (S/.)</label>
              <input
                type="number"
                step="0.01"
                value={pago.montoPagado}
                onChange={(e) => setPago({
                  ...pago,
                  montoPagado: e.target.value
                })}
                placeholder="Ej: 100"
                required
              />
            </div>

            <div className="form-group">
              <label>📸 Captura de Pantalla del Comprobante</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImagenChange}
                required
              />
              {previewImagen && (
                <img src={previewImagen} alt="Preview" className="image-preview" />
              )}
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                className="btn btn-warning"
                style={{ flex: 1 }}
                onClick={() => {
                  setPaso(1);
                  setMensaje('');
                }}
                disabled={loading}
              >
                ← Volver
              </button>
              <button
                className="btn btn-success"
                style={{ flex: 1 }}
                onClick={handleSubirComprobante}
                disabled={loading || !imagenBase64}
              >
                {loading ? 'Enviando...' : '✅ Enviar Comprobante'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default NuevaApuesta;
