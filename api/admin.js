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

  const urlParts = req.url.split('?')[0].split('/').filter(Boolean);
  const sub    = urlParts[2]; // 'eventos', 'todas-apuestas', etc.
  const id     = urlParts[3]; // ID numérico
  const action = urlParts[4]; // 'resultado', 'cuotas'

  // ──── PÚBLICOS ────
  // GET /api/admin/eventos-activos
  if (req.method === 'GET' && sub === 'eventos-activos') {
    try {
      const eventos = await Evento.findAll({ where: { estado: 'activo' }, order: [['fechaPartido', 'ASC']] });
      return res.json(eventos);
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ──── PROTEGIDAS ────
  try {
    await verificarAdmin(req, Usuario);
  } catch (e) {
    return res.status(401).json({ error: e.message });
  }

  // GET /api/admin/todas-apuestas
  if (req.method === 'GET' && sub === 'todas-apuestas') {
    const apuestas = await Apuesta.findAll({
      include: [Evento],
      order: [['createdAt', 'DESC']]
    });
    return res.json(apuestas);
  }

  // GET /api/admin/estadisticas
  if (req.method === 'GET' && sub === 'estadisticas') {
    const totalApuestas   = await Apuesta.count();
    const apuestasActivas = await Apuesta.count({ where: { estado: 'activa' } });
    const apuestasGanadas = await Apuesta.count({ where: { estado: 'ganada' } });
    const apuestasPerdidas= await Apuesta.count({ where: { estado: 'perdida' } });
    const totalMonto      = await Apuesta.sum('montoApuesta') || 0;
    return res.json({ totalApuestas, apuestasActivas, apuestasGanadas, apuestasPerdidas, totalMonto });
  }

  // ── EVENTOS ──

  // POST /api/admin/eventos
  if (req.method === 'POST' && sub === 'eventos') {
    const { equipoLocal, equipoVisitante, liga, fechaPartido, cuotaLocal, cuotaEmpate, cuotaVisitante } = req.body;
    if (!equipoLocal || !equipoVisitante || !fechaPartido || !cuotaLocal || !cuotaEmpate || !cuotaVisitante)
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    const evento = await Evento.create({ equipoLocal, equipoVisitante, liga, fechaPartido, cuotaLocal, cuotaEmpate, cuotaVisitante });
    return res.status(201).json(evento);
  }

  // GET /api/admin/eventos
  if (req.method === 'GET' && sub === 'eventos') {
    const eventos = await Evento.findAll({ order: [['fechaPartido', 'DESC']] });
    return res.json(eventos);
  }

  // PUT /api/admin/eventos/:id/cuotas — actualizar cuotas en vivo
  if (req.method === 'PUT' && sub === 'eventos' && id && action === 'cuotas') {
    try {
      const { cuotaLocal, cuotaEmpate, cuotaVisitante } = req.body;
      const evento = await Evento.findByPk(id);
      if (!evento) return res.status(404).json({ error: 'Evento no encontrado' });
      if (evento.estado !== 'activo') return res.status(400).json({ error: 'Solo se pueden editar cuotas de eventos activos' });

      await evento.update({
        cuotaLocal:     parseFloat(cuotaLocal)    || evento.cuotaLocal,
        cuotaEmpate:    parseFloat(cuotaEmpate)   || evento.cuotaEmpate,
        cuotaVisitante: parseFloat(cuotaVisitante) || evento.cuotaVisitante
      });

      return res.json({ message: 'Cuotas actualizadas ✅', evento });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // PUT /api/admin/eventos/:id/resultado — cerrar evento y resolver todas las apuestas
  if (req.method === 'PUT' && sub === 'eventos' && id && action === 'resultado') {
    try {
      const { resultado } = req.body; // 'local' | 'empate' | 'visitante'
      if (!['local', 'empate', 'visitante'].includes(resultado))
        return res.status(400).json({ error: 'Resultado inválido. Debe ser: local, empate o visitante' });

      const evento = await Evento.findByPk(id);
      if (!evento) return res.status(404).json({ error: 'Evento no encontrado' });

      // 1. Marcar evento como finalizado
      await evento.update({ resultadoPartido: resultado, estado: 'finalizado' });

      // 2. Buscar todas las apuestas activas de este evento
      const apuestas = await Apuesta.findAll({
        where: { eventoId: id, estado: 'activa' }
      });

      // 3. Resolver cada apuesta y acreditar ganancias si ganó
      let ganadoras = 0;
      let perdedoras = 0;

      for (const apuesta of apuestas) {
        const gano = apuesta.tipoApuesta === resultado;
        await apuesta.update({
          apuestaGanada: gano,
          estado: gano ? 'ganada' : 'perdida'
        });

        // Si ganó, acreditar montoGanancia al saldo del usuario
        if (gano) {
          const usuario = await Usuario.findByPk(apuesta.usuarioId);
          if (usuario) {
            const nuevoSaldo = parseFloat(usuario.saldo || 0) + parseFloat(apuesta.montoGanancia);
            await usuario.update({ saldo: nuevoSaldo });
          }
          ganadoras++;
        } else {
          perdedoras++;
        }
      }

      return res.json({
        message: `Evento cerrado. ${ganadoras} apuesta(s) ganadora(s), ${perdedoras} perdedora(s). Ganancias acreditadas automáticamente.`,
        evento,
        ganadoras,
        perdedoras
      });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // PUT /api/admin/eventos/:id — editar datos generales del evento (sin resultado)
  if (req.method === 'PUT' && sub === 'eventos' && id && !action) {
    try {
      const { estado } = req.body;
      const evento = await Evento.findByPk(id);
      if (!evento) return res.status(404).json({ error: 'Evento no encontrado' });

      // Si se cancela el evento, devolver saldo a todos los apostadores
      if (estado === 'cancelado' && evento.estado !== 'cancelado') {
        const apuestas = await Apuesta.findAll({ where: { eventoId: id, estado: 'activa' } });
        for (const apuesta of apuestas) {
          const usuario = await Usuario.findByPk(apuesta.usuarioId);
          if (usuario) {
            const nuevoSaldo = parseFloat(usuario.saldo || 0) + parseFloat(apuesta.montoApuesta);
            await usuario.update({ saldo: nuevoSaldo });
          }
          await apuesta.update({ estado: 'cancelada' });
        }
      }

      await evento.update({ estado: estado || evento.estado });
      return res.json(evento);
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  return res.status(404).json({ error: 'Ruta no encontrada' });
};
