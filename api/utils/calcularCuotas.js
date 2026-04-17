/**
 * Motor de cálculo de cuotas — margen 8% + ajuste por eventos del partido en vivo.
 *
 * FÓRMULA BASE:
 *   cuota = 1 / (probabilidad × (1 + margen))
 *
 * AJUSTE POR EVENTOS:
 *   Cada evento del partido modifica las probabilidades base usando
 *   factores multiplicativos calibrados. Después se normalizan para
 *   que sumen 1 y se aplica el margen.
 *
 * AJUSTE POR VOLUMEN:
 *   Mezcla 50% prob_evento + 50% distribución del dinero apostado.
 */

const MARGEN_DEFAULT = 0.08;
const CUOTA_MIN = 1.05;
const CUOTA_MAX = 50.0;

// ─── Impacto de cada evento sobre las probabilidades ───────────────────────
// Formato: [factorLocal, factorEmpate, factorVisitante]
// >1 = sube probabilidad, <1 = baja probabilidad
const IMPACTO = {
  gol_local:         [1.35, 0.80, 0.55],  // local más probable ganador
  gol_visitante:     [0.55, 0.80, 1.35],  // visitante más probable ganador
  penal_local:       [1.15, 0.92, 0.88],  // probable gol local
  penal_visitante:   [0.88, 0.92, 1.15],  // probable gol visitante
  roja_local:        [0.70, 0.95, 1.25],  // local debilitado
  roja_visitante:    [1.25, 0.95, 0.70],  // visitante debilitado
  amarilla_local:    [0.96, 1.00, 1.03],  // leve impacto
  amarilla_visitante:[1.03, 1.00, 0.96],
  lesion_local:      [0.90, 1.00, 1.08],  // depende de quién es el lesionado
  lesion_visitante:  [1.08, 1.00, 0.90],
};

// Factor adicional por minuto: conforme avanza el tiempo,
// el equipo que va ganando tiene más ventaja (menos tiempo para remontar)
function factorTiempo(minuto, golesLocal, golesVisitante) {
  if (minuto <= 0) return [1, 1, 1];
  const diferencia = golesLocal - golesVisitante;
  // En el minuto 90 con diferencia de 1 gol, el que va ganando tiene factor ~1.3
  const peso = Math.min(minuto / 90, 1); // 0 a 1
  if (diferencia > 0) {
    // Local va ganando
    const f = 1 + (diferencia * 0.25 * peso);
    return [Math.min(f, 3.0), Math.max(1 - 0.15 * peso, 0.3), Math.max(1 - 0.20 * peso * diferencia, 0.1)];
  } else if (diferencia < 0) {
    // Visitante va ganando
    const f = 1 + (Math.abs(diferencia) * 0.25 * peso);
    return [Math.max(1 - 0.20 * peso * Math.abs(diferencia), 0.1), Math.max(1 - 0.15 * peso, 0.3), Math.min(f, 3.0)];
  }
  // Empate: conforme pasa el tiempo el empate se vuelve más probable
  const fEmpate = 1 + 0.20 * peso;
  return [1 - 0.10 * peso, fEmpate, 1 - 0.10 * peso];
}

/**
 * Calcula cuotas a partir de probabilidades brutas (no necesitan sumar 1).
 */
function calcularCuotas(pL, pE, pV, margen = MARGEN_DEFAULT) {
  const suma = pL + pE + pV;
  if (suma <= 0) return null;
  const nL = pL / suma, nE = pE / suma, nV = pV / suma;

  const cL = Math.min(CUOTA_MAX, Math.max(CUOTA_MIN, 1 / (nL * (1 + margen))));
  const cE = Math.min(CUOTA_MAX, Math.max(CUOTA_MIN, 1 / (nE * (1 + margen))));
  const cV = Math.min(CUOTA_MAX, Math.max(CUOTA_MIN, 1 / (nV * (1 + margen))));
  const overround = 1/cL + 1/cE + 1/cV;

  return {
    cuotaLocal:      +cL.toFixed(3),
    cuotaEmpate:     +cE.toFixed(3),
    cuotaVisitante:  +cV.toFixed(3),
    overround:       +overround.toFixed(4),
    margenEfectivo:  +((overround - 1) * 100).toFixed(2),
    probabilidades:  { local: +nL.toFixed(4), empate: +nE.toFixed(4), visitante: +nV.toFixed(4) }
  };
}

/**
 * Recalcula probabilidades aplicando todos los eventos del partido
 * sobre las probabilidades base, más el factor de tiempo/marcador.
 */
function probsDesdeEventos(evento) {
  let pL = parseFloat(evento.probBaseLocal)     || 0.35;
  let pE = parseFloat(evento.probBaseEmpate)    || 0.30;
  let pV = parseFloat(evento.probBaseVisitante) || 0.35;

  const historial = JSON.parse(evento.historialEventos || '[]');

  // Aplicar impacto acumulado de cada evento
  for (const ev of historial) {
    const imp = IMPACTO[ev.tipo];
    if (imp) {
      pL = Math.max(0.01, pL * imp[0]);
      pE = Math.max(0.01, pE * imp[1]);
      pV = Math.max(0.01, pV * imp[2]);
    }
  }

  // Aplicar factor de tiempo + marcador
  const ft = factorTiempo(
    parseInt(evento.minuto) || 0,
    parseInt(evento.golesLocal) || 0,
    parseInt(evento.golesVisitante) || 0
  );
  pL = Math.max(0.01, pL * ft[0]);
  pE = Math.max(0.01, pE * ft[1]);
  pV = Math.max(0.01, pV * ft[2]);

  return { pL, pE, pV };
}

/**
 * Recalcula cuotas combinando eventos del partido + volumen de apuestas.
 */
function recalcularCuotasDinamicas(evento) {
  const margen = parseFloat(evento.margen) || MARGEN_DEFAULT;
  const { pL: pEvL, pE: pEvE, pV: pEvV } = probsDesdeEventos(evento);

  const montoL = parseFloat(evento.montoApostadoLocal)     || 0;
  const montoE = parseFloat(evento.montoApostadoEmpate)    || 0;
  const montoV = parseFloat(evento.montoApostadoVisitante) || 0;
  const montoTotal = montoL + montoE + montoV;

  let pL, pE, pV;
  if (montoTotal < 10) {
    pL = pEvL; pE = pEvE; pV = pEvV;
  } else {
    // 50% eventos del partido + 50% distribución del dinero
    pL = 0.5 * pEvL + 0.5 * (montoL / montoTotal);
    pE = 0.5 * pEvE + 0.5 * (montoE / montoTotal);
    pV = 0.5 * pEvV + 0.5 * (montoV / montoTotal);
  }

  return calcularCuotas(pL, pE, pV, margen);
}

/**
 * Asistente UI: dado % de probabilidad ingresado por el admin.
 */
function cuotasDesdeProbs(pLPct, pEPct, pVPct, margenPct = 8) {
  return calcularCuotas(pLPct / 100, pEPct / 100, pVPct / 100, margenPct / 100);
}

module.exports = { calcularCuotas, recalcularCuotasDinamicas, cuotasDesdeProbs, IMPACTO };
