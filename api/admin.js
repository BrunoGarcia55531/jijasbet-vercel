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

  if (req.method === 'POST' && sub === 'preview-cuotas') {
    try {
      const { probLocal, probEmpate, probVisitante, margen } = req.body;
      return res.json(cuotasDesdeProbs(parseFloat(probLocal), parseFloat(probEmpate), parseFloat(probVisitante), parseFloat(margen) || 8));
    } catch (e) { return res.status(400).json({ error: e.message }); }
  }

  // ── PROTEGIDAS ──
  try { await verificarAdmin(req, Usuario); }
  catch (e) { return res.status(401).json({ error: e.message }); }

  if (req.method === 'GET' && sub === 'todas-apuestas') {
    const apuestas = await Apuesta.findAll({ include: [Evento], order: [['createdAt', 'DESC']] });
    return res.json(apuestas);
  }

  if (req.method === 'GET' && sub === 'estadisticas') {
    const totalApuestas    = await Apuesta.count();
    const apuestasActivas  = await Apuesta.count({ where: { estado: 'activa' } });
    const apuestasGanadas  = await Apuesta.count({ where: { estado: 'ganada' } });
    const apuestasPerdidas = await Apuesta.count({ where: { estado: 'perdida' } });
    const totalMonto       = await Apuesta.sum('montoApuesta') || 0;
    return res.json({ totalApuestas, apuestasActivas, apuestasGanadas, apuestasPerdidas, totalMonto });
  }

  // ── CREAR EVENTO ──
  if (req.method === 'POST' && sub === 'eventos') {
    const { equipoLocal, equipoVisitante, liga, fechaPartido, probLocal, probEmpate, probVisitante, margen } = req.body;
    if (!equipoLocal || !equipoVisitante || !fechaPartido || !probLocal || !probEmpate || !probVisitante)
      return res.status(400).json({ error: 'Faltan campos requeridos' });

    const margenVal = parseFloat(margen) / 100 || 0.08;
    const cuotas = cuotasDesdeProbs(parseFloat(probLocal), parseFloat(probEmpate), parseFloat(probVisitante), parseFloat(margen) || 8);

    const evento = await Evento.create({
      equipoLocal, equipoVisitante, liga, fechaPartido,
      cuotaLocal: cuotas.cuotaLocal, cuotaEmpate: cuotas.cuotaEmpate, cuotaVisitante: cuotas.cuotaVisitante,
      probBaseLocal: cuotas.probabilidades.local,
      probBaseEmpate: cuotas.probabilidades.empate,
      probBaseVisitante: cuotas.probabilidades.visitante,
      margen: margenVal,
      montoApostadoLocal: 0, montoApostadoEmpate: 0, montoApostadoVisitante: 0,
      fase: 'pre', minuto: 0, golesLocal: 0, golesVisitante: 0,
      rojaLocal: 0, rojaVisitante: 0, historialEventos: '[]'
    });

    return res.status(201).json({ evento, cuotasCalculadas: cuotas });
  }

  if (req.method === 'GET' && sub === 'eventos') {
    const eventos = await Evento.findAll({ order: [['fechaPartido', 'DESC']] });
    return res.json(eventos);
  }

  // ── EVENTO EN VIVO: registrar evento del partido ──
  // POST /api/admin/eventos/:id/live
  // Body: { tipo: 'gol_local' | 'gol_visitante' | 'penal_local' | ..., minuto: 45 }
  if (req.method === 'POST' && sub === 'eventos' && id && action === 'live') {
    try {
      const { tipo, minuto, fase } = req.body;

      const TIPOS_VALIDOS = [
        'gol_local', 'gol_visitante',
        'penal_local', 'penal_visitante',
        'roja_local', 'roja_visitante',
        'amarilla_local', 'amarilla_visitante',
        'lesion_local', 'lesion_visitante'
      ];

      if (!TIPOS_VALIDOS.includes(tipo))
        return res.status(400).json({ error: `Tipo inválido. Válidos: ${TIPOS_VALIDOS.join(', ')}` });

      const evento = await Evento.findByPk(id);
      if (!evento) return res.status(404).json({ error: 'Evento no encontrado' });
      if (evento.estado !== 'activo') return res.status(400).json({ error: 'El evento no está activo' });

      // Actualizar historial
      const historial = JSON.parse(evento.historialEventos || '[]');
      const minutoActual = minuto || parseInt(evento.minuto) || 0;

      historial.push({ tipo, minuto: minutoActual, timestamp: new Date().toISOString() });

      // Actualizar contadores
      const updates = {
        historialEventos: JSON.stringify(historial),
        minuto: minutoActual
      };
      if (fase) updates.fase = fase;
      if (tipo === 'gol_local')      updates.golesLocal      = parseInt(evento.golesLocal)     + 1;
      if (tipo === 'gol_visitante')  updates.golesVisitante  = parseInt(evento.golesVisitante) + 1;
      if (tipo === 'roja_local')     updates.rojaLocal       = parseInt(evento.rojaLocal)      + 1;
      if (tipo === 'roja_visitante') updates.rojaVisitante   = parseInt(evento.rojaVisitante)  + 1;

      await evento.update(updates);

      // Recalcular cuotas con el nuevo estado del partido
      const eventoActualizado = await Evento.findByPk(id);
      const nuevasCuotas = recalcularCuotasDinamicas(eventoActualizado);
      await eventoActualizado.update({
        cuotaLocal:     nuevasCuotas.cuotaLocal,
        cuotaEmpate:    nuevasCuotas.cuotaEmpate,
        cuotaVisitante: nuevasCuotas.cuotaVisitante
      });

      const etiquetas = {
        gol_local: '⚽ Gol Local', gol_visitante: '⚽ Gol Visitante',
        penal_local: '🟡 Penal Local', penal_visitante: '🟡 Penal Visitante',
        roja_local: '🟥 Roja Local', roja_visitante: '🟥 Roja Visitante',
        amarilla_local: '🟨 Amarilla Local', amarilla_visitante: '🟨 Amarilla Visitante',
        lesion_local: '🚑 Lesión Local', lesion_visitante: '🚑 Lesión Visitante'
      };

      return res.json({
        message: `${etiquetas[tipo]} registrado en el minuto ${minutoActual}`,
        cuotasAnteriores: { local: evento.cuotaLocal, empate: evento.cuotaEmpate, visitante: evento.cuotaVisitante },
        nuevasCuotas,
        historial,
        marcador: {
          local: updates.golesLocal ?? parseInt(evento.golesLocal),
          visitante: updates.golesVisitante ?? parseInt(evento.golesVisitante)
        }
      });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── ACTUALIZAR MINUTO / FASE (sin evento específico) ──
  // PUT /api/admin/eventos/:id/minuto
  if (req.method === 'PUT' && sub === 'eventos' && id && action === 'minuto') {
    try {
      const { minuto, fase } = req.body;
      const evento = await Evento.findByPk(id);
      if (!evento) return res.status(404).json({ error: 'Evento no encontrado' });

      await evento.update({ minuto: parseInt(minuto) || evento.minuto, ...(fase && { fase }) });

      const eventoActualizado = await Evento.findByPk(id);
      const nuevasCuotas = recalcularCuotasDinamicas(eventoActualizado);
      await eventoActualizado.update({
        cuotaLocal:     nuevasCuotas.cuotaLocal,
        cuotaEmpate:    nuevasCuotas.cuotaEmpate,
        cuotaVisitante: nuevasCuotas.cuotaVisitante
      });

      return res.json({ message: 'Minuto actualizado', nuevasCuotas, evento: eventoActualizado });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── DESHACER ÚLTIMO EVENTO ──
  // DELETE /api/admin/eventos/:id/live
  if (req.method === 'DELETE' && sub === 'eventos' && id && action === 'live') {
    try {
      const evento = await Evento.findByPk(id);
      if (!evento) return res.status(404).json({ error: 'Evento no encontrado' });

      const historial = JSON.parse(evento.historialEventos || '[]');
      if (historial.length === 0) return res.status(400).json({ error: 'No hay eventos para deshacer' });

      const ultimo = historial.pop();

      // Revertir contadores
      const updates = { historialEventos: JSON.stringify(historial) };
      if (ultimo.tipo === 'gol_local')      updates.golesLocal      = Math.max(0, parseInt(evento.golesLocal)     - 1);
      if (ultimo.tipo === 'gol_visitante')  updates.golesVisitante  = Math.max(0, parseInt(evento.golesVisitante) - 1);
      if (ultimo.tipo === 'roja_local')     updates.rojaLocal       = Math.max(0, parseInt(evento.rojaLocal)      - 1);
      if (ultimo.tipo === 'roja_visitante') updates.rojaVisitante   = Math.max(0, parseInt(evento.rojaVisitante)  - 1);

      await evento.update(updates);

      const eventoActualizado = await Evento.findByPk(id);
      const nuevasCuotas = recalcularCuotasDinamicas(eventoActualizado);
      await eventoActualizado.update({
        cuotaLocal:     nuevasCuotas.cuotaLocal,
        cuotaEmpate:    nuevasCuotas.cuotaEmpate,
        cuotaVisitante: nuevasCuotas.cuotaVisitante
      });

      return res.json({ message: `Deshecho: ${ultimo.tipo} (min. ${ultimo.minuto})`, nuevasCuotas, historial });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── AJUSTAR PROBABILIDADES BASE ──
  if (req.method === 'PUT' && sub === 'eventos' && id && action === 'cuotas') {
    try {
      const { probLocal, probEmpate, probVisitante, margen } = req.body;
      const evento = await Evento.findByPk(id);
      if (!evento) return res.status(404).json({ error: 'Evento no encontrado' });

      const margenVal = margen !== undefined ? parseFloat(margen) / 100 : parseFloat(evento.margen);
      const nuevoProbL = probLocal     ? parseFloat(probLocal)     / 100 : parseFloat(evento.probBaseLocal);
      const nuevoProbE = probEmpate    ? parseFloat(probEmpate)    / 100 : parseFloat(evento.probBaseEmpate);
      const nuevoProbV = probVisitante ? parseFloat(probVisitante) / 100 : parseFloat(evento.probBaseVisitante);

      await evento.update({ probBaseLocal: nuevoProbL, probBaseEmpate: nuevoProbE, probBaseVisitante: nuevoProbV, margen: margenVal });

      const eventoActualizado = await Evento.findByPk(id);
      const nuevasCuotas = recalcularCuotasDinamicas(eventoActualizado);
      await eventoActualizado.update({ cuotaLocal: nuevasCuotas.cuotaLocal, cuotaEmpate: nuevasCuotas.cuotaEmpate, cuotaVisitante: nuevasCuotas.cuotaVisitante });

      return res.json({ message: '✅ Cuotas recalculadas', evento: eventoActualizado, cuotas: nuevasCuotas });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── CERRAR EVENTO ──
  if (req.method === 'PUT' && sub === 'eventos' && id && action === 'resultado') {
    try {
      const { resultado } = req.body;
      if (!['local', 'empate', 'visitante'].includes(resultado))
        return res.status(400).json({ error: 'Resultado inválido' });

      const evento = await Evento.findByPk(id);
      if (!evento) return res.status(404).json({ error: 'Evento no encontrado' });

      await evento.update({ resultadoPartido: resultado, estado: 'finalizado', fase: 'finalizado' });

      const apuestas = await Apuesta.findAll({ where: { eventoId: id, estado: 'activa' } });
      let ganadoras = 0, perdedoras = 0;

      for (const apuesta of apuestas) {
        const gano = apuesta.tipoApuesta === resultado;
        await apuesta.update({ apuestaGanada: gano, estado: gano ? 'ganada' : 'perdida' });
        if (gano) {
          const usuario = await Usuario.findByPk(apuesta.usuarioId);
          if (usuario) await usuario.update({ saldo: parseFloat(usuario.saldo || 0) + parseFloat(apuesta.montoGanancia) });
          ganadoras++;
        } else { perdedoras++; }
      }

      return res.json({ message: `Evento cerrado. ${ganadoras} ganadora(s), ${perdedoras} perdedora(s). Ganancias acreditadas.`, evento, ganadoras, perdedoras });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  // ── CANCELAR EVENTO ──
  if (req.method === 'PUT' && sub === 'eventos' && id && !action) {
    try {
      const { estado } = req.body;
      const evento = await Evento.findByPk(id);
      if (!evento) return res.status(404).json({ error: 'Evento no encontrado' });

      if (estado === 'cancelado' && evento.estado !== 'cancelado') {
        const apuestas = await Apuesta.findAll({ where: { eventoId: id, estado: 'activa' } });
        for (const apuesta of apuestas) {
          const usuario = await Usuario.findByPk(apuesta.usuarioId);
          if (usuario) await usuario.update({ saldo: parseFloat(usuario.saldo || 0) + parseFloat(apuesta.montoApuesta) });
          await apuesta.update({ estado: 'cancelada' });
        }
      }

      await evento.update({ estado: estado || evento.estado });
      return res.json(evento);
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }

  return res.status(404).json({ error: 'Ruta no encontrada' });
};
