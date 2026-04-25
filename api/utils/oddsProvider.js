/**
 * oddsProvider.js — Obtiene cuotas de referencia desde The Odds API
 * y las usa como base para calcular las cuotas de la casa.
 *
 * FLUJO:
 *   1. Buscar el partido en The Odds API por nombre de equipos y fecha
 *   2. Si lo encuentra → promediar cuotas de todas las casas disponibles ("cuota de consenso")
 *   3. Aplicar nuestro margen encima de esas cuotas de referencia
 *   4. Si NO lo encuentra → fallback al modelo Poisson (calcularCuotasBase)
 *
 * LIGAS SOPORTADAS (las que cubre The Odds API):
 *   Liga 1 Perú        → soccer_peru_primera_division (verificar disponibilidad)
 *   Copa Libertadores  → soccer_conmebol_copa_libertadores
 *   LaLiga             → soccer_spain_la_liga
 *   Premier League     → soccer_epl
 *   Serie A            → soccer_italy_serie_a
 *   Bundesliga         → soccer_germany_bundesliga
 *   Ligue 1            → soccer_france_ligue_1
 *   Champions League   → soccer_uefa_champs_league
 *
 * API KEY: guardar en variable de entorno ODDS_API_KEY
 * Plan gratuito: 500 requests/mes — usar con moderación.
 */

const { calcularCuotasBase } = require('./calcularCuotas');

const ODDS_API_BASE  = 'https://api.the-odds-api.com/v4';
const ODDS_API_KEY   = process.env.ODDS_API_KEY || '';
const NUESTRO_MARGEN = 0.06; // 6% extra sobre las cuotas de mercado

// Mapa de nombre de liga (del sistema) → sport_key de The Odds API
const LIGA_MAP = {
  'Primera División':    'soccer_peru_primera_division',
  'Copa Libertadores':   'soccer_conmebol_copa_libertadores',
  'Copa Sudamericana':   'soccer_conmebol_copa_sudamericana',
  'LaLiga':              'soccer_spain_la_liga',
  'Premier League':      'soccer_epl',
  'Serie A':             'soccer_italy_serie_a',
  'Bundesliga':          'soccer_germany_bundesliga',
  'Ligue 1':             'soccer_france_ligue_1',
  'Champions League':    'soccer_uefa_champs_league',
};

/**
 * Normaliza un nombre de equipo para comparación fuzzy.
 * Elimina acentos, espacios extra y convierte a minúsculas.
 */
function normalizar(nombre) {
  return (nombre || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar acentos
    .replace(/[^a-z0-9 ]/g, '')
    .trim();
}

/**
 * Verifica si dos nombres de equipo son suficientemente similares.
 * Maneja abreviaciones y nombres parciales (ej: "Alianza" ≈ "Alianza Lima").
 */
function equiposCoinciden(nombre1, nombre2) {
  const n1 = normalizar(nombre1);
  const n2 = normalizar(nombre2);
  if (n1 === n2) return true;
  if (n1.includes(n2) || n2.includes(n1)) return true;
  // Comparar primera palabra significativa
  const p1 = n1.split(' ')[0];
  const p2 = n2.split(' ')[0];
  return p1.length > 3 && p1 === p2;
}

/**
 * Calcula la cuota de consenso promediando todas las casas disponibles.
 * Usa la media armónica ponderada (más robusta que la media simple).
 */
function cuotaConsenso(outcomes, nombreEquipo) {
  const outcome = outcomes.find(o => equiposCoinciden(o.name, nombreEquipo));
  return outcome ? outcome.price : null;
}

/**
 * Aplica nuestro margen sobre las cuotas de referencia del mercado.
 * Fórmula: prob_inflada = (1/cuota_ref) * (1 + margen)
 *          cuota_nuestra = 1 / prob_inflada
 */
function aplicarMargen(cuotaRef, margen = NUESTRO_MARGEN) {
  if (!cuotaRef || cuotaRef <= 1) return null;
  const probRef = 1 / cuotaRef;
  const probInflada = probRef * (1 + margen);
  return +Math.max(1.05, 1 / probInflada).toFixed(2);
}

/**
 * Obtiene la lista de eventos disponibles para una liga en The Odds API.
 */
async function fetchEventos(sportKey) {
  const url = `${ODDS_API_BASE}/sports/${sportKey}/odds?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h&oddsFormat=decimal`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`The Odds API error: ${res.status} ${res.statusText}`);
  return res.json();
}

/**
 * Función principal: obtiene cuotas de referencia para un partido.
 * Devuelve las cuotas ya con nuestro margen aplicado.
 *
 * @param {string} equipoLocal   - Nombre del equipo local
 * @param {string} equipoVisitante - Nombre del equipo visitante
 * @param {string} liga          - Nombre de la liga (del sistema)
 * @param {string} fechaPartido  - Fecha del partido (ISO string)
 * @param {Array}  historialGlobal - Historial para fallback Poisson
 * @returns {Object} { cuotaBaseLocal, cuotaBaseEmpate, cuotaBaseVisitante, fuente }
 */
async function obtenerCuotasBase(equipoLocal, equipoVisitante, liga, fechaPartido, historialGlobal = []) {
  // Fallback inmediato si no hay API key
  if (!ODDS_API_KEY) {
    console.log('[OddsProvider] Sin API key → usando modelo Poisson');
    return { ...calcularCuotasBase(equipoLocal, equipoVisitante, liga, historialGlobal), fuente: 'poisson' };
  }

  const sportKey = LIGA_MAP[liga];
  if (!sportKey) {
    console.log(`[OddsProvider] Liga "${liga}" no mapeada → usando modelo Poisson`);
    return { ...calcularCuotasBase(equipoLocal, equipoVisitante, liga, historialGlobal), fuente: 'poisson' };
  }

  try {
    console.log(`[OddsProvider] Consultando The Odds API para ${equipoLocal} vs ${equipoVisitante} (${liga})...`);
    const eventos = await fetchEventos(sportKey);

    // Buscar el partido por equipos y fecha
    const fechaObj = new Date(fechaPartido);
    const partido = eventos.find(ev => {
      const coincideLocal    = equiposCoinciden(ev.home_team, equipoLocal);
      const coincideVisitante = equiposCoinciden(ev.away_team, equipoVisitante);
      // Tolerancia de ±3 días en la fecha
      const fechaEv = new Date(ev.commence_time);
      const diffDias = Math.abs((fechaEv - fechaObj) / (1000 * 60 * 60 * 24));
      return coincideLocal && coincideVisitante && diffDias <= 3;
    });

    if (!partido || !partido.bookmakers || partido.bookmakers.length === 0) {
      console.log(`[OddsProvider] Partido no encontrado en API → usando modelo Poisson`);
      return { ...calcularCuotasBase(equipoLocal, equipoVisitante, liga, historialGlobal), fuente: 'poisson' };
    }

    // Recopilar cuotas de todas las casas disponibles
    const cuotasLocales   = [];
    const cuotasEmpate    = [];
    const cuotasVisitante = [];

    for (const bookmaker of partido.bookmakers) {
      const mercadoH2H = bookmaker.markets?.find(m => m.key === 'h2h');
      if (!mercadoH2H) continue;

      const cL = cuotaConsenso(mercadoH2H.outcomes, partido.home_team);
      const cE = mercadoH2H.outcomes.find(o => o.name === 'Draw')?.price;
      const cV = cuotaConsenso(mercadoH2H.outcomes, partido.away_team);

      if (cL) cuotasLocales.push(cL);
      if (cE) cuotasEmpate.push(cE);
      if (cV) cuotasVisitante.push(cV);
    }

    if (cuotasLocales.length === 0) {
      return { ...calcularCuotasBase(equipoLocal, equipoVisitante, liga, historialGlobal), fuente: 'poisson' };
    }

    // Media aritmética de cuotas de mercado (cuota de consenso)
    const mediaL = cuotasLocales.reduce((a,b)=>a+b,0) / cuotasLocales.length;
    const mediaE = cuotasEmpate.reduce((a,b)=>a+b,0) / cuotasEmpate.length;
    const mediaV = cuotasVisitante.reduce((a,b)=>a+b,0) / cuotasVisitante.length;

    // Aplicar nuestro margen encima de las cuotas de mercado
    const cuotaBaseLocal     = aplicarMargen(mediaL) || 1.80;
    const cuotaBaseEmpate    = aplicarMargen(mediaE) || 2.70;
    const cuotaBaseVisitante = aplicarMargen(mediaV) || 1.80;

    console.log(`[OddsProvider] ✅ Cuotas de mercado (${partido.bookmakers.length} casas):`);
    console.log(`  Referencia: L:${mediaL.toFixed(2)} E:${mediaE.toFixed(2)} V:${mediaV.toFixed(2)}`);
    console.log(`  Nuestras (+${NUESTRO_MARGEN*100}%): L:${cuotaBaseLocal} E:${cuotaBaseEmpate} V:${cuotaBaseVisitante}`);

    return {
      cuotaBaseLocal,
      cuotaBaseEmpate,
      cuotaBaseVisitante,
      fuente: 'the-odds-api',
      casasConsultadas: partido.bookmakers.length,
      cuotasReferencia: { L: +mediaL.toFixed(2), E: +mediaE.toFixed(2), V: +mediaV.toFixed(2) },
    };

  } catch (err) {
    console.error(`[OddsProvider] Error consultando API: ${err.message} → fallback Poisson`);
    return { ...calcularCuotasBase(equipoLocal, equipoVisitante, liga, historialGlobal), fuente: 'poisson-fallback' };
  }
}

/**
 * Verifica cuántas requests quedan en el plan gratuito.
 * Útil para monitorear el consumo.
 */
async function verificarCreditos() {
  if (!ODDS_API_KEY) return null;
  try {
    const res = await fetch(`${ODDS_API_BASE}/sports?apiKey=${ODDS_API_KEY}`);
    return {
      requestsUsed:      res.headers.get('x-requests-used'),
      requestsRemaining: res.headers.get('x-requests-remaining'),
      requestsLast:      res.headers.get('x-requests-last'),
    };
  } catch { return null; }
}

module.exports = { obtenerCuotasBase, verificarCreditos, LIGA_MAP };
