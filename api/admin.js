const jwt = require('jsonwebtoken');
const { getModels } = require('./models/db');
const { calcularCuotas, recalcularCuotasDinamicas, cuotasDesdeProbs } = require('./utils/calcularCuotas');

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
  const sub    = urlParts[2];
  const id     = urlParts[3];
  const action = urlParts[4];

  // ── PÚBLICO ──
  if (req.method === 'GET' && sub === 'eventos-activos') {
    try {
      const eventos = await Evento.findAll({ where: { estado: 'activo' }, order: [['fechaPartido', 'ASC']] });
      return res.json(eventos);
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── HELPER: previsualizar cuotas desde probabilidades (público, para UI del admin) ──
  // POST /api/admin/preview-cuotas
  if (req.method === 'POST' && sub === 'preview-cuotas') {
    try {
      const { probLocal, probEmpate, probVisitante, margen } = req.body;
      const resultado = cuotasDesdeProbs(
        parseFloat(probLocal), parseFloat(probEmpate), parseFloat(probVisitante),
        parseFloat(margen) || 8
      );
      return res.json(resultado);
    } catch (e) { return res.status(400).json({ error: e.message }); }
  }

  // ── PROTEGIDAS ──
  try { await verificarAdmin(req, Usuario); }
  catch (e) { return res.status(401).json({ error: e.message }); }

  // GET /api/admin/todas-apuestas
  if (req.method === 'GET' && sub === 'todas-apuestas') {
    const apuestas = await Apuesta.findAll({ include: [Evento], order: [['createdAt', 'DESC']] });
    return res.json(apuestas);
  }

  // GET /api/admin/estadisticas
  if (req.method === 'GET' && sub === 'estadisticas') {
    const totalApuestas    = await Apuesta.count();
    const apuestasActivas  = await Apuesta.count({ where: { estado: 'activa' } });
    const apuestasGanadas  = await Apuesta.count({ where: { estado: 'ganada' } });
    const apuestasPerdidas = await Apuesta.count({ where: { estado: 'perdida' } });
    const totalMonto       = await Apuesta.sum('montoApuesta') || 0;
    return res.json({ totalApuestas, apuestasActivas, apuestasGanadas, apuestasPerdidas, totalMonto });
  }

  // ── EVENTOS ──

  // POST /api/admin/eventos — crear con probabilidades base → auto-cuotas
  if (req.method === 'POST' && sub === 'eventos') {
    const { equipoLocal, equipoVisitante, liga, fechaPartido,
            probLocal, probEmpate, probVisitante, margen } = req.body;

    if (!equipoLocal || !equipoVisitante || !fechaPartido ||
        !probLocal || !probEmpate || !probVisitante)
      return res.status(400).json({ error: 'Faltan campos requeridos' });

    const margenVal = parseFloat(margen) / 100 || 0.08;
    const cuotas = cuotasDesdeProbs(
      parseFloat(probLocal), parseFloat(probEmpate), parseFloat(probVisitante),
      parseFloat(margen) || 8
    );

    const evento = await Evento.create({
      equipoLocal, equipoVisitante, liga, fechaPartido,
      cuotaLocal:      cuotas.cuotaLocal,
      cuotaEmpate:     cuotas.cuotaEmpate,
      cuotaVisitante:  cuotas.cuotaVisitante,
      probBaseLocal:   cuotas.probabilidades.local,
      probBaseEmpate:  cuotas.probabilidades.empate,
      probBaseVisitante: cuotas.probabilidades.visitante,
      margen: margenVal,
      montoApostadoLocal: 0, montoApostadoEmpate: 0, montoApostadoVisitante: 0
    });

    return res.status(201).json({ evento, cuotasCalculadas: cuotas });
  }

  // GET /api/admin/eventos
  if (req.method === 'GET' && sub === 'eventos') {
    const eventos = await Evento.findAll({ order: [['fechaPartido', 'DESC']] });
    return res.json(eventos);
  }

  // PUT /api/admin/eventos/:id/cuotas — recalcular cuotas manualmente o cambiar probs base
  if (req.method === 'PUT' && sub === 'eventos' && id && action === 'cuotas') {
    try {
      const { probLocal, probEmpate, probVisitante, margen } = req.body;
      const evento = await Evento.findByPk(id);
      if (!evento) return res.status(404).json({ error: 'Evento no encontrado' });
      if (evento.estado !== 'activo') return res.status(400).json({ error: 'Solo se pueden editar eventos activos' });

      const margenVal = margen !== undefined ? parseFloat(margen) / 100 : parseFloat(evento.margen);

      // Actualizar probs base si se enviaron
      const nuevoProbL = probLocal     ? parseFloat(probLocal)     / 100 : parseFloat(evento.probBaseLocal);
      const nuevoProbE = probEmpate    ? parseFloat(probEmpate)    / 100 : parseFloat(evento.probBaseEmpate);
      const nuevoProbV = probVisitante ? parseFloat(probVisitante) / 100 : parseFloat(evento.probBaseVisitante);

      await evento.update({
        probBaseLocal: nuevoProbL,
        probBaseEmpate: nuevoProbE,
        probBaseVisitante: nuevoProbV,
        margen: margenVal
      });

      // Recalcular cuotas dinámicas con nuevas probs base
      const eventoActualizado = await Evento.findByPk(id);
      const nuevasCuotas = recalcularCuotasDinamicas(eventoActualizado);
      await eventoActualizado.update({
        cuotaLocal:     nuevasCuotas.cuotaLocal,
        cuotaEmpate:    nuevasCuotas.cuotaEmpate,
        cuotaVisitante: nuevasCuotas.cuotaVisitante
      });

      return res.json({ message: '✅ Cuotas recalculadas', evento: eventoActualizado, cuotas: nuevasCuotas });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // PUT /api/admin/eventos/:id/resultado
  if (req.method === 'PUT' && sub === 'eventos' && id && action === 'resultado') {
    try {
      const { resultado } = req.body;
      if (!['local', 'empate', 'visitante'].includes(resultado))
        return res.status(400).json({ error: 'Resultado inválido' });

      const evento = await Evento.findByPk(id);
      if (!evento) return res.status(404).json({ error: 'Evento no encontrado' });

      await evento.update({ resultadoPartido: resultado, estado: 'finalizado' });

      const apuestas = await Apuesta.findAll({ where: { eventoId: id, estado: 'activa' } });
      let ganadoras = 0, perdedoras = 0;

      for (const apuesta of apuestas) {
        const gano = apuesta.tipoApuesta === resultado;
        await apuesta.update({ apuestaGanada: gano, estado: gano ? 'ganada' : 'perdida' });
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
        message: `Evento cerrado. ${ganadoras} ganadora(s), ${perdedoras} perdedora(s). Ganancias acreditadas.`,
        evento, ganadoras, perdedoras
      });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // PUT /api/admin/eventos/:id — cancelar
  if (req.method === 'PUT' && sub === 'eventos' && id && !action) {
    try {
      const { estado } = req.body;
      const evento = await Evento.findByPk(id);
      if (!evento) return res.status(404).json({ error: 'Evento no encontrado' });

      if (estado === 'cancelado' && evento.estado !== 'cancelado') {
        const apuestas = await Apuesta.findAll({ where: { eventoId: id, estado: 'activa' } });
        for (const apuesta of apuestas) {
          const usuario = await Usuario.findByPk(apuesta.usuarioId);
          if (usuario) {
            await usuario.update({ saldo: parseFloat(usuario.saldo || 0) + parseFloat(apuesta.montoApuesta) });
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
