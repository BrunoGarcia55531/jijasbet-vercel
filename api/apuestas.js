const jwt = require('jsonwebtoken');
const { getModels } = require('./models/db');

const SECRET = process.env.JWT_SECRET || 'tu_secret_key_muy_seguro';

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

const verificarToken = (req) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) throw new Error('No autorizado');
  return jwt.verify(token, SECRET);
};

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const urlParts = req.url.split('?')[0].split('/').filter(Boolean);
  const sub = urlParts[2];
  const action = urlParts[3];

  // GET /api/apuestas/mis-apuestas
  if (req.method === 'GET' && sub === 'mis-apuestas') {
    try {
      const decoded = verificarToken(req);
      const { Apuesta, Evento } = await getModels();
      const apuestas = await Apuesta.findAll({
        where: { usuarioId: decoded.id },
        include: [Evento],
        order: [['createdAt', 'DESC']]
      });
      return res.json(apuestas);
    } catch (e) { return res.status(401).json({ error: e.message }); }
  }

  // POST /api/apuestas
  if (req.method === 'POST' && !sub) {
    try {
      const decoded = verificarToken(req);
      const { Apuesta, Evento, Usuario } = await getModels();
      const { eventoId, tipoApuesta, montoApuesta } = req.body;

      if (!eventoId || !tipoApuesta || !montoApuesta)
        return res.status(400).json({ error: 'Faltan campos requeridos' });

      const monto = parseFloat(montoApuesta);
      if (isNaN(monto) || monto <= 0)
        return res.status(400).json({ error: 'Monto inválido' });

      const usuario = await Usuario.findByPk(decoded.id);
      if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

      const saldoActual = parseFloat(usuario.saldo || 0);
      if (saldoActual < monto)
        return res.status(400).json({ error: `Saldo insuficiente. Tu saldo es S/. ${saldoActual.toFixed(2)}` });

      const evento = await Evento.findByPk(eventoId);
      if (!evento) return res.status(404).json({ error: 'Evento no encontrado' });

      let cuotaApuesta = 1;
      if (tipoApuesta === 'local')     cuotaApuesta = parseFloat(evento.cuotaLocal)    || 1;
      if (tipoApuesta === 'empate')    cuotaApuesta = parseFloat(evento.cuotaEmpate)   || 1;
      if (tipoApuesta === 'visitante') cuotaApuesta = parseFloat(evento.cuotaVisitante) || 1;

      // Descontar saldo
      await usuario.update({ saldo: saldoActual - monto });

      const apuesta = await Apuesta.create({
        usuarioId: decoded.id, eventoId,
        nombreUsuario: usuario.nombre, tipoApuesta,
        montoApuesta: monto, cuota: cuotaApuesta,
        montoGanancia: monto * cuotaApuesta,
        estado: 'activa' // automáticamente verificado al pagar con saldo
      });

      const apuestaConEvento = await Apuesta.findByPk(apuesta.id, { include: [Evento] });
      return res.json({ apuesta: apuestaConEvento, saldoRestante: saldoActual - monto });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // GET /api/apuestas/:id
  if (req.method === 'GET' && sub) {
    try {
      verificarToken(req);
      const { Apuesta } = await getModels();
      const apuesta = await Apuesta.findByPk(sub);
      if (!apuesta) return res.status(404).json({ error: 'Apuesta no encontrada' });
      return res.json(apuesta);
    } catch (e) { return res.status(401).json({ error: e.message }); }
  }

  return res.status(404).json({ error: 'Ruta no encontrada' });
};
