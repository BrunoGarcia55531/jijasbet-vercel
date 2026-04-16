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
  const sub = urlParts[2]; // 'mis-recargas' | ID
  const action = urlParts[3]; // 'verificar' | 'rechazar'

  // GET /api/recargas/mis-recargas
  if (req.method === 'GET' && sub === 'mis-recargas') {
    try {
      const decoded = verificarToken(req);
      const { Recarga, Usuario } = await getModels();
      const recargas = await Recarga.findAll({
        where: { usuarioId: decoded.id },
        order: [['createdAt', 'DESC']]
      });
      const usuario = await Usuario.findByPk(decoded.id, { attributes: ['saldo'] });
      return res.json({ recargas, saldo: parseFloat(usuario.saldo || 0) });
    } catch (e) { return res.status(401).json({ error: e.message }); }
  }

  // POST /api/recargas — crear solicitud de recarga
  if (req.method === 'POST' && !sub) {
    try {
      const decoded = verificarToken(req);
      const { Recarga, Usuario } = await getModels();
      const { monto, comprobante, numeroTransaccion } = req.body;

      if (!monto || !comprobante || !numeroTransaccion)
        return res.status(400).json({ error: 'Faltan campos requeridos' });

      const montoNum = parseFloat(monto);
      if (isNaN(montoNum) || montoNum <= 0)
        return res.status(400).json({ error: 'Monto inválido' });

      const usuario = await Usuario.findByPk(decoded.id);
      const recarga = await Recarga.create({
        usuarioId: decoded.id,
        nombreUsuario: usuario.nombre,
        monto: montoNum,
        comprobante,
        numeroTransaccion,
        estado: 'pendiente'
      });

      return res.status(201).json({ message: 'Solicitud de recarga enviada. El admin la verificará pronto.', recarga });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // PUT /api/recargas/:id/verificar — solo admin
  if (req.method === 'PUT' && action === 'verificar') {
    try {
      const decoded = verificarToken(req);
      const { Recarga, Usuario } = await getModels();

      const usuario = await Usuario.findByPk(decoded.id);
      if (!usuario?.esAdmin) return res.status(403).json({ error: 'No autorizado' });

      const recarga = await Recarga.findByPk(sub);
      if (!recarga) return res.status(404).json({ error: 'Recarga no encontrada' });
      if (recarga.estado !== 'pendiente') return res.status(400).json({ error: 'La recarga ya fue procesada' });

      const usuarioDestino = await Usuario.findByPk(recarga.usuarioId);
      const saldoActual = parseFloat(usuarioDestino.saldo || 0);
      const nuevoSaldo = saldoActual + parseFloat(recarga.monto);

      await usuarioDestino.update({ saldo: nuevoSaldo });
      await recarga.update({ estado: 'verificado' });

      return res.json({ message: `✅ Recarga verificada. Nuevo saldo: S/. ${nuevoSaldo.toFixed(2)}`, recarga });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // PUT /api/recargas/:id/rechazar — solo admin
  if (req.method === 'PUT' && action === 'rechazar') {
    try {
      const decoded = verificarToken(req);
      const { Recarga, Usuario } = await getModels();

      const usuario = await Usuario.findByPk(decoded.id);
      if (!usuario?.esAdmin) return res.status(403).json({ error: 'No autorizado' });

      const { motivo } = req.body;
      const recarga = await Recarga.findByPk(sub);
      if (!recarga) return res.status(404).json({ error: 'Recarga no encontrada' });
      if (recarga.estado !== 'pendiente') return res.status(400).json({ error: 'La recarga ya fue procesada' });

      await recarga.update({ estado: 'rechazado', motivoRechazo: motivo });
      return res.json({ message: 'Recarga rechazada', recarga });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // GET /api/recargas — todas las recargas (admin)
  if (req.method === 'GET' && !sub) {
    try {
      const decoded = verificarToken(req);
      const { Recarga, Usuario } = await getModels();

      const usuario = await Usuario.findByPk(decoded.id);
      if (!usuario?.esAdmin) return res.status(403).json({ error: 'No autorizado' });

      const recargas = await Recarga.findAll({ order: [['createdAt', 'DESC']] });
      return res.json(recargas);
    } catch (e) { return res.status(401).json({ error: e.message }); }
  }

  return res.status(404).json({ error: 'Ruta no encontrada' });
};
