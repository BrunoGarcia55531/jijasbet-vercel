const jwt = require('jsonwebtoken');
const { getModels } = require('./models/db');

const SECRET = process.env.JWT_SECRET || 'tu_secret_key_muy_seguro';

const verificarToken = (req) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) throw new Error('No autorizado');
  return jwt.verify(token, SECRET);
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { Apuesta, Evento, Usuario } = await getModels();

  // Extraer segmento de URL después de /api/apuestas
  const urlParts = req.url.split('?')[0].split('/').filter(Boolean);
  // urlParts example: ['api','apuestas'] or ['api','apuestas','mis-apuestas'] or ['api','apuestas','5','comprobante']
  const sub = urlParts[2]; // segment after 'apuestas'
  const id  = urlParts[2]; // may be an id
  const action = urlParts[3]; // e.g. 'comprobante'

  // GET /api/apuestas/mis-apuestas
  if (req.method === 'GET' && sub === 'mis-apuestas') {
    try {
      const decoded = verificarToken(req);
      const apuestas = await Apuesta.findAll({
        where: { usuarioId: decoded.id },
        include: [Evento],
        order: [['createdAt', 'DESC']]
      });
      return res.json(apuestas);
    } catch (e) {
      return res.status(401).json({ error: e.message });
    }
  }

  // POST /api/apuestas/:id/comprobante
  if (req.method === 'POST' && action === 'comprobante') {
    try {
      const decoded = verificarToken(req);
      const { comprobante, numeroTransaccion, montoPagado } = req.body;
      const apuesta = await Apuesta.findByPk(id);
      if (!apuesta) return res.status(404).json({ error: 'Apuesta no encontrada' });
      if (apuesta.usuarioId !== decoded.id) return res.status(403).json({ error: 'No autorizado' });
      await apuesta.update({ comprobante, numeroTransaccion, montoPagado, estadoPago: 'pendiente' });
      return res.json({ message: 'Comprobante recibido. Pendiente de verificación', apuesta });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // POST /api/apuestas  (crear apuesta)
  if (req.method === 'POST' && !sub) {
    try {
      const decoded = verificarToken(req);
      const { eventoId, tipoApuesta, montoApuesta } = req.body;
      if (!eventoId || !tipoApuesta || !montoApuesta) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
      }
      const evento = await Evento.findByPk(eventoId);
      if (!evento) return res.status(404).json({ error: 'Evento no encontrado' });
      const usuario = await Usuario.findByPk(decoded.id);

      let cuotaApuesta = 1;
      if (tipoApuesta === 'local')     cuotaApuesta = evento.cuotaLocal    || 1;
      if (tipoApuesta === 'empate')    cuotaApuesta = evento.cuotaEmpate   || 1;
      if (tipoApuesta === 'visitante') cuotaApuesta = evento.cuotaVisitante || 1;

      const apuesta = await Apuesta.create({
        usuarioId: decoded.id,
        eventoId,
        nombreUsuario: usuario.nombre,
        tipoApuesta,
        montoApuesta,
        cuota: cuotaApuesta,
        montoGanancia: montoApuesta * cuotaApuesta
      });

      const apuestaConEvento = await Apuesta.findByPk(apuesta.id, { include: [Evento] });
      return res.json(apuestaConEvento);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // GET /api/apuestas/:id
  if (req.method === 'GET' && sub) {
    try {
      verificarToken(req);
      const apuesta = await Apuesta.findByPk(sub);
      if (!apuesta) return res.status(404).json({ error: 'Apuesta no encontrada' });
      return res.json(apuesta);
    } catch (e) {
      return res.status(401).json({ error: e.message });
    }
  }

  return res.status(404).json({ error: 'Ruta no encontrada' });
};
