import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Recargar({ token }) {
  const [paso, setPaso] = useState(1);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [saldo, setSaldo] = useState(0);
  const [recargas, setRecargas] = useState([]);
  const [imagenBase64, setImagenBase64] = useState('');
  const [previewImagen, setPreviewImagen] = useState('');

  const [form, setForm] = useState({
    monto: '',
    numeroTransaccion: ''
  });

  useEffect(() => {
    const cargar = async () => {
      try {
        const res = await axios.get('/api/recargas/mis-recargas', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSaldo(res.data.saldo);
        setRecargas(res.data.recargas);
      } catch (err) {
        console.error(err);
      }
    };
    cargar();
  }, [token]);

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

  const handleEnviar = async () => {
    if (!form.monto || !form.numeroTransaccion || !imagenBase64) {
      setError('Todos los campos son requeridos');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await axios.post('/api/recargas', {
        monto: parseFloat(form.monto),
        numeroTransaccion: form.numeroTransaccion,
        comprobante: imagenBase64
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMensaje('✅ Solicitud enviada. El administrador verificará tu comprobante pronto.');
      setForm({ monto: '', numeroTransaccion: '' });
      setImagenBase64('');
      setPreviewImagen('');
      setPaso(1);
      // Refrescar lista
      const res = await axios.get('/api/recargas/mis-recargas', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRecargas(res.data.recargas);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al enviar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  const estadoColor = (estado) => {
    if (estado === 'verificado') return '#4CAF50';
    if (estado === 'rechazado') return '#e74c3c';
    return '#f0c040';
  };

  return (
    <div className="container">
      <h1 style={{ color: 'white', marginBottom: '2rem', textAlign: 'center' }}>💳 Recargar Saldo</h1>

      {/* Saldo actual */}
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <h3 style={{ color: '#4CAF50' }}>S/. {parseFloat(saldo).toFixed(2)}</h3>
          <p>Saldo Disponible</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

        {/* Formulario de recarga */}
        <div className="card">
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
            <button
              className={`btn ${paso === 1 ? 'btn-primary' : 'btn-warning'}`}
              onClick={() => setPaso(1)}
            >
              1. Monto
            </button>
            <button
              className={`btn ${paso === 2 ? 'btn-primary' : 'btn-warning'}`}
              onClick={() => { if (form.monto) setPaso(2); }}
              disabled={!form.monto}
            >
              2. Comprobante
            </button>
          </div>

          {mensaje && <div className="alert alert-success">{mensaje}</div>}
          {error && <div className="alert alert-error">{error}</div>}

          {paso === 1 ? (
            <>
              <h2 style={{ marginBottom: '1.5rem' }}>¿Cuánto deseas recargar?</h2>

              <div className="form-group">
                <label>Monto (S/.)</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={form.monto}
                  onChange={(e) => setForm({ ...form, monto: e.target.value })}
                  placeholder="Ej: 100"
                />
              </div>

              {/* Montos rápidos */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                {[20, 50, 100, 200, 500].map(m => (
                  <button
                    key={m}
                    className="btn btn-warning"
                    style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
                    onClick={() => setForm({ ...form, monto: String(m) })}
                  >
                    S/. {m}
                  </button>
                ))}
              </div>

              <button
                className="btn btn-primary"
                style={{ width: '100%' }}
                onClick={() => { if (form.monto) setPaso(2); else setError('Ingresa un monto'); }}
              >
                Continuar →
              </button>
            </>
          ) : (
            <>
              <h2 style={{ marginBottom: '1rem' }}>Pago por Yape</h2>

              <div className="quote-section" style={{ background: '#fff3cd', marginBottom: '1.5rem' }}>
                <p><strong>Monto a enviar: S/. {parseFloat(form.monto).toFixed(2)}</strong></p>
              </div>

              <h3 style={{ marginBottom: '1rem' }}>Instrucciones:</h3>
              <ol style={{ lineHeight: '1.9', marginBottom: '1.5rem', color: '#ccc' }}>
                <li>Abre <strong style={{ color: 'white' }}>Yape</strong></li>
                <li>Envía <strong style={{ color: 'white' }}>S/. {parseFloat(form.monto).toFixed(2)}</strong> al número del QR</li>
                <li>Guarda el <strong style={{ color: 'white' }}>número de transacción</strong></li>
                <li>Sube la <strong style={{ color: 'white' }}>captura de pantalla</strong></li>
              </ol>

              {/* QR Simulado */}
              <div style={{
                background: '#f0f0f0',
                padding: '1.5rem',
                textAlign: 'center',
                borderRadius: '8px',
                marginBottom: '1.5rem',
                border: '2px dashed #999'
              }}>
                <p style={{ color: '#666', marginBottom: '0.5rem' }}>📱 Yape</p>
                <div style={{
                  width: '160px', height: '160px',
                  background: 'white', margin: '0 auto',
                  border: '2px solid #999',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '3rem'
                }}>🔳</div>
                <p style={{ marginTop: '0.75rem', color: '#666', fontWeight: 'bold' }}>951 234 567</p>
              </div>

              <div className="form-group">
                <label>Número de Transacción Yape</label>
                <input
                  type="text"
                  value={form.numeroTransaccion}
                  onChange={(e) => setForm({ ...form, numeroTransaccion: e.target.value })}
                  placeholder="Ej: TXN-ABC123"
                />
              </div>

              <div className="form-group">
                <label>📸 Captura del Comprobante</label>
                <input type="file" accept="image/*" onChange={handleImagenChange} />
                {previewImagen && (
                  <img src={previewImagen} alt="Preview" className="image-preview" style={{ maxHeight: '150px', marginTop: '0.5rem' }} />
                )}
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn btn-warning" style={{ flex: 1 }} onClick={() => setPaso(1)} disabled={loading}>
                  ← Volver
                </button>
                <button
                  className="btn btn-success"
                  style={{ flex: 1 }}
                  onClick={handleEnviar}
                  disabled={loading || !imagenBase64}
                >
                  {loading ? 'Enviando...' : '✅ Enviar'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Historial de recargas */}
        <div className="card">
          <h2 style={{ marginBottom: '1.5rem' }}>Historial de Recargas</h2>
          {recargas.length === 0 ? (
            <p style={{ color: '#999', textAlign: 'center', padding: '2rem' }}>Sin recargas aún</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Monto</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {recargas.map(r => (
                  <tr key={r.id}>
                    <td><strong>S/. {parseFloat(r.monto).toFixed(2)}</strong></td>
                    <td>
                      <span style={{ color: estadoColor(r.estado), fontWeight: 'bold', textTransform: 'capitalize' }}>
                        {r.estado}
                      </span>
                      {r.estado === 'rechazado' && r.motivoRechazo && (
                        <p style={{ fontSize: '0.75rem', color: '#e74c3c', margin: 0 }}>{r.motivoRechazo}</p>
                      )}
                    </td>
                    <td style={{ fontSize: '0.85rem', color: '#999' }}>
                      {new Date(r.createdAt).toLocaleDateString('es-PE')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default Recargar;
