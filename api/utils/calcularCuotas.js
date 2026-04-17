/**
 * Motor de cálculo de cuotas con margen (overround) del bookmaker.
 *
 * FÓRMULAS CLAVE:
 *   cuota_justa      = 1 / probabilidad_real
 *   cuota_con_margen = 1 / (probabilidad_real * (1 + margen))
 *   overround        = suma(1/cuota_i) — debe ser > 1 para garantizar ganancia
 *
 * AJUSTE DINÁMICO POR VOLUMEN:
 *   Sin apuestas → usar probabilidades base del admin.
 *   Con apuestas → mezclar 50% prob_base con 50% prob_volumen,
 *   donde prob_volumen = montoOpcion / montoTotal.
 *   Esto evita que las primeras apuestas distorsionen demasiado las cuotas.
 */

const MARGEN_DEFAULT = 0.08;
const MEZCLA_VOLUMEN = 0.50;
const CUOTA_MIN = 1.05;
const CUOTA_MAX = 50.0;

/**
 * Calcula las 3 cuotas a partir de probabilidades brutas + margen.
 * Las probabilidades NO necesitan sumar 1 (se normalizan internamente).
 */
function calcularCuotas(probLocal, probEmpate, probVisitante, margen = MARGEN_DEFAULT) {
  const suma = probLocal + probEmpate + probVisitante;
  const pL = probLocal     / suma;
  const pE = probEmpate    / suma;
  const pV = probVisitante / suma;

  const cL = Math.min(CUOTA_MAX, Math.max(CUOTA_MIN, 1 / (pL * (1 + margen))));
  const cE = Math.min(CUOTA_MAX, Math.max(CUOTA_MIN, 1 / (pE * (1 + margen))));
  const cV = Math.min(CUOTA_MAX, Math.max(CUOTA_MIN, 1 / (pV * (1 + margen))));

  const overround = 1/cL + 1/cE + 1/cV;

  return {
    cuotaLocal:      +cL.toFixed(3),
    cuotaEmpate:     +cE.toFixed(3),
    cuotaVisitante:  +cV.toFixed(3),
    overround:       +overround.toFixed(4),
    margenEfectivo:  +((overround - 1) * 100).toFixed(2),
    probabilidades:  { local: +pL.toFixed(4), empate: +pE.toFixed(4), visitante: +pV.toFixed(4) }
  };
}

/**
 * Recalcula cuotas dinámicamente combinando prob. base con volumen de apuestas.
 * Llamar cada vez que alguien apuesta.
 */
function recalcularCuotasDinamicas(evento) {
  const margen   = parseFloat(evento.margen)           || MARGEN_DEFAULT;
  const probBaseL = parseFloat(evento.probBaseLocal)    || 0.35;
  const probBaseE = parseFloat(evento.probBaseEmpate)   || 0.30;
  const probBaseV = parseFloat(evento.probBaseVisitante)|| 0.35;

  const montoL = parseFloat(evento.montoApostadoLocal)     || 0;
  const montoE = parseFloat(evento.montoApostadoEmpate)    || 0;
  const montoV = parseFloat(evento.montoApostadoVisitante) || 0;
  const montoTotal = montoL + montoE + montoV;

  let pL, pE, pV;

  if (montoTotal < 10) {
    // Sin suficiente volumen → solo prob. base
    pL = probBaseL; pE = probBaseE; pV = probBaseV;
  } else {
    // Mezcla 50/50 prob_base + prob_volumen
    pL = (1 - MEZCLA_VOLUMEN) * probBaseL + MEZCLA_VOLUMEN * (montoL / montoTotal);
    pE = (1 - MEZCLA_VOLUMEN) * probBaseE + MEZCLA_VOLUMEN * (montoE / montoTotal);
    pV = (1 - MEZCLA_VOLUMEN) * probBaseV + MEZCLA_VOLUMEN * (montoV / montoTotal);
  }

  return calcularCuotas(pL, pE, pV, margen);
}

/**
 * Asistente UI: dado % de probabilidad (0-100) por el admin,
 * devuelve cuotas con margen. Para el formulario de creación.
 */
function cuotasDesdeProbs(pLocalPct, pEmpatePct, pVisitantePct, margenPct = 8) {
  return calcularCuotas(pLocalPct / 100, pEmpatePct / 100, pVisitantePct / 100, margenPct / 100);
}

module.exports = { calcularCuotas, recalcularCuotasDinamicas, cuotasDesdeProbs };
