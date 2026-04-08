const jwt = require('jsonwebtoken');
const { getModels } = require('./models/db');

const SECRET = process.env.JWT_SECRET || 'tu_secret_key_muy_seguro';

const verificarAdmin = async (req, Usuario) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) throw new Error('No autorizado');
  const decoded = jwt.verify(token, SECRET);
  const usuario = await Usuario.findByPk(decoded.id);
  if (!usuario?.esAdmin) throw new Error('No es administrador');
  return decoded;
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { Apuesta, Evento, Usuario } = await getModels();

  // Segmentos de URL: /api/admin/[sub]/[id]
  const urlParts = req.url.split('?')[0].split('/').filter(Boolean);
  const sub = urlParts[2]; // e.g. 'apuestas-pendientes', 'eventos', 'verificar', etc.
  const id  = urlParts[3]; // e.g. '5'

  // ──── EVENTOS PÚBLICOS (sin auth) ────
  // GET /api/admin/eventos-activos
  if (req.method === 'GET' && sub === 'eventos-activos') {
    try {
      const eventos = await Evento.findAll({ where: { estado: 'activo' }, order: [['fechaPartido', 'ASC']] });
      return res.json(eventos);
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ──── RUTAS PROTEGIDAS ────
  try {
    await verificarAdmin(req, Usuario);
  } catch (e) {
    return res.status(401).json({ error: e.message });
  }

  // GET /api/admin/apuestas-pendientes
  if (req.method === 'GET' && sub === 'apuestas-pendientes') {
    const apuestas = await Apuesta.findAll({ where: { estadoPago: 'pendiente' }, order: [['createdAt', 'DESC']] });
    return res.json(apuestas);
  }

  // GET /api/admin/todas-apuestas
  if (req.method === 'GET' && sub === 'todas-apuestas') {
    const apuestas = await Apuesta.findAll({ order: [['createdAt', 'DESC']] });
    return res.json(apuestas);
  }

  // GET /api/admin/estadisticas
  if (req.method === 'GET' && sub === 'estadisticas') {
    const totalApuestas       = await Apuesta.count();
    const apuestasPendientes  = await Apuesta.count({ where: { estadoPago: 'pendiente' } });
    const apuestasVerificadas = await Apuesta.count({ where: { estadoPago: 'verificado' } });
    const totalMonto          = await Apuesta.sum('montoApuesta') || 0;
    return res.json({ totalApuestas, apuestasPendientes, apuestasVerificadas, totalMonto });
  }

  // PUT /api/admin/verificar/:id
  if (req.method === 'PUT' && sub === 'verificar' && id) {
    const apuesta = await Apuesta.findByPk(id);
    if (!apuesta) return res.status(404).json({ error: 'Apuesta no encontrada' });
    await apuesta.update({ estadoPago: 'verificado' });
    return res.json({ message: 'Pago verificado ✅', apuesta });
  }

  // PUT /api/admin/rechazar/:id
  if (req.method === 'PUT' && sub === 'rechazar' && id) {
    const { motivo } = req.body;
    const apuesta = await Apuesta.findByPk(id);
    if (!apuesta) return res.status(404).json({ error: 'Apuesta no encontrada' });
    await apuesta.update({ estadoPago: 'rechazado', motivoRechazo: motivo });
    return res.json({ message: 'Pago rechazado', apuesta });
  }

  // PUT /api/admin/resultado/:id
  if (req.method === 'PUT' && sub === 'resultado' && id) {
    const { resultado } = req.body;
    const apuesta = await Apuesta.findByPk(id);
    if (!apuesta) return res.status(404).json({ error: 'Apuesta no encontrada' });
    const apuestaGanada = apuesta.tipoApuesta === resultado;
    await apuesta.update({ resultadoPartido: resultado, apuestaGanada });
    return res.json({ message: 'Resultado establecido', apuesta });
  }

  // ── EVENTOS ──
  // POST /api/admin/eventos
  if (req.method === 'POST' && sub === 'eventos') {
    const { equipoLocal, equipoVisitante, liga, fechaPartido, cuotaLocal, cuotaEmpate, cuotaVisitante } = req.body;
    if (!equipoLocal || !equipoVisitante || !fechaPartido || !cuotaLocal || !cuotaEmpate || !cuotaVisitante) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    const evento = await Evento.create({ equipoLocal, equipoVisitante, liga, fechaPartido, cuotaLocal, cuotaEmpate, cuotaVisitante });
    return res.status(201).json(evento);
  }

  // GET /api/admin/eventos
  if (req.method === 'GET' && sub === 'eventos') {
    const eventos = await Evento.findAll({ order: [['fechaPartido', 'DESC']] });
    return res.json(eventos);
  }

  // PUT /api/admin/eventos/:id
  if (req.method === 'PUT' && sub === 'eventos' && id) {
    const { resultadoPartido, estado } = req.body;
    const evento = await Evento.findByPk(id);
    if (!evento) return res.status(404).json({ error: 'Evento no encontrado' });
    await evento.update({
      resultadoPartido: resultadoPartido || evento.resultadoPartido,
      estado: estado || evento.estado
    });
    return res.json(evento);
  }

  return res.status(404).json({ error: 'Ruta no encontrada' });
};
