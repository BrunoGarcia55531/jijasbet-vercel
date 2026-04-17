const jwt = require('jsonwebtoken');
const { getModels } = require('./models/db');
const { calcularCuotas, recalcularCuotasDinamicas, cuotasDesdeProbs, calcularProbsAutomaticas } = require('./utils/calcularCuotas');

const SECRET = process.env.JWT_SECRET || 'tu_secret_key_muy_seguro';

/**
 * Calcula el minuto actual del partido basado en la hora de inicio y la fase.
 * - primera_mitad:  1-45
 * - descanso:       45 (fijo)
 * - segunda_mitad:  46-90
 * - pre/finalizado: 0 / 90
 */
function calcularMinutoAutomatico(evento) {
  const fase = evento.fase || 'pre';
  if (fase === 'pre') return 0;
  if (fase === 'descanso') return 45;
  if (fase === 'finalizado') return 90;

  // Si hay fecha de inicio guardada, calculamos desde ahí
  const inicio = evento.inicioPartido ? new Date(evento.inicioPartido) : null;
  if (!inicio) {
    // Fallback: usar el minuto almacenado
    return parseInt(evento.minuto) || (fase === 'segunda_mitad' ? 46 : 1);
  }

  const ahora = new Date();
  const diffMs = ahora - inicio;
  const diffMin = Math.floor(diffMs / 60000);

  if (fase === 'primera_mitad') {
    return Math.min(Math.max(diffMin + 1, 1), 45);
  } else if (fase === 'segunda_mitad') {
    // En segunda mitad sumamos 45 min de descanso (~15 min)
    return Math.min(Math.max(diffMin - 60 + 46, 46), 90);
  }
  return parseInt(evento.minuto) || 0;
}

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
    const { equipoLocal, equipoVisitante, liga, fechaPartido } = req.body;
    if (!equipoLocal || !equipoVisitante || !fechaPartido)
      return res.status(400).json({ error: 'Faltan campos requeridos' });

    // Obtener historial de eventos finalizados para calcular probabilidades automáticas
    const eventosFinalizados = await Evento.findAll({
      where: { estado: 'finalizado' },
      attributes: ['equipoLocal', 'equipoVisitante', 'liga', 'resultadoPartido'],
      order: [['createdAt', 'ASC']]
    });
    const historialGlobal = eventosFinalizados.map(e => ({
      equipoLocal: e.equipoLocal,
      equipoVisitante: e.equipoVisitante,
      liga: e.liga,
      resultado: e.resultadoPartido
    }));

    const probs = calcularProbsAutomaticas(equipoLocal, equipoVisitante, liga || 'Primera División', historialGlobal);
    const MARGEN_DEFAULT = 0.08;
    const cuotas = calcularCuotas(probs.probBaseLocal, probs.probBaseEmpate, probs.probBaseVisitante, MARGEN_DEFAULT);

    const evento = await Evento.create({
      equipoLocal, equipoVisitante, liga, fechaPartido,
      cuotaLocal: cuotas.cuotaLocal, cuotaEmpate: cuotas.cuotaEmpate, cuotaVisitante: cuotas.cuotaVisitante,
      probBaseLocal: probs.probBaseLocal,
      probBaseEmpate: probs.probBaseEmpate,
      probBaseVisitante: probs.probBaseVisitante,
      margen: MARGEN_DEFAULT,
      montoApostadoLocal: 0, montoApostadoEmpate: 0, montoApostadoVisitante: 0,
      fase: 'pre', minuto: 0, golesLocal: 0, golesVisitante: 0,
      rojaLocal: 0, rojaVisitante: 0, historialEventos: '[]'
    });

    return res.status(201).json({ evento, cuotasCalculadas: cuotas, probabilidadesBase: probs });
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
      // Calcular minuto automáticamente si no se envía explícitamente
      const minutoActual = (minuto !== undefined && minuto !== null && minuto !== '')
        ? parseInt(minuto)
        : calcularMinutoAutomatico(evento);

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

      const updates = { ...(fase && { fase }) };

      // Si el partido acaba de iniciar la primera mitad, guardar hora de inicio
      if (fase === 'primera_mitad' && evento.fase !== 'primera_mitad') {
        updates.inicioPartido = new Date();
        updates.minuto = 1;
      } else if (fase === 'segunda_mitad' && evento.fase !== 'segunda_mitad') {
        // No reseteamos inicioPartido; calcularMinutoAutomatico lo maneja con offset
        updates.minuto = 46;
      } else {
        // Minuto manual sólo si se envía explícitamente
        if (minuto !== undefined && minuto !== null && minuto !== '') {
          updates.minuto = parseInt(minuto);
        } else {
          updates.minuto = calcularMinutoAutomatico({ ...evento.toJSON(), ...(fase && { fase }) });
        }
      }

      await evento.update(updates);

      const eventoActualizado = await Evento.findByPk(id);
      const nuevasCuotas = recalcularCuotasDinamicas(eventoActualizado);
      await eventoActualizado.update({
        cuotaLocal:     nuevasCuotas.cuotaLocal,
        cuotaEmpate:    nuevasCuotas.cuotaEmpate,
        cuotaVisitante: nuevasCuotas.cuotaVisitante
      });

      return res.json({
        message: 'Fase/minuto actualizado',
        minutoActual: eventoActualizado.minuto,
        nuevasCuotas,
        evento: eventoActualizado
      });
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
