/**
 * Bioconversion Category Engine — config for the multi-purpose categories.
 *
 * Wiston's spec (2026-08-11): unify into 3 product categories —
 *   plantas (Plantas/Vegetal, incl. Palma + Plátano, N-P-K metrics)
 *   ganado (Cattle/Livestock manure — fermentation temp, CO2, CH4)
 *   larvas (BSF / Black Soldier Fly — density, FCR, substrate temp/humidity)
 *
 * Each category has distinct waste inputs, units of measure, monitored parameters
 * with status thresholds, and ESG (CO2e / methane) factors per the team's JSON spec.
 *
 * Threshold values are the team's field references (agronomic/technical starting
 * points for calibration).
 */

export type CategoriaId =
  | 'plantas'   // Plantas/Vegetal (Palma + Plátano unified, N-P-K)
  | 'ganado'    // Ganado / Desechos orgánicos animales (estercolero)
  | 'larvas'    // Larvas / Bioconversión BSF (mosca soldado negra)

export interface MonitoredParam {
  key: string;
  label: string;          // human label (ES)
  unit: string;           // e.g. '%', '°C', 'pH', 'ppm'
  optimalMin: number;     // green
  optimalMax: number;     // green
  warningMax: number;     // orange above this (red above warningMax*1.0)
  highIsBad: boolean;     // true if values ABOVE optimalMax are worse (temp, pH)
  lowIsBad?: boolean;     // true if values BELOW optimalMin are worse when min matters
}

/** Alert threshold below which a low-value param is red (Wiston's "alerta" field). */
export interface MonitorAlert {
  key: string;
  alertLow: number;       // below this = red (called "alerta" in Wiston's spec)
}

export interface Categoria {
  id: CategoriaId;
  nombre: string;                    // ES label
  nombreEn: string;
  icon: string;                      // emoji for UI
  wasteInputs: string[];             // waste streams to select from
  primaryUnits: string[];            // e.g. ['kg', 'toneladas']
  monitored: MonitoredParam[];       // dashboard params + thresholds
  /** Low-side alert thresholds (Wiston's "alerta" field) per param key. */
  alerts?: Record<string, number>;
  /** ESG / bioconversion factors (per kg of waste input unless noted) */
  esg: {
    biomassFactor: number;           // kg biomasa/frass per kg residuo
    co2eFactor: number;              // kg CO2e avoided per kg residuo
    methaneFactor: number;           // kg CH4 avoided per kg residuo
    harvestDays: number;             // typical process cycle (days)
    /** Fraction of biomass that becomes frass/compost (DSA audit F4: was a magic 0.4 in routes). */
    frassFactor: number;
  };
  /** Default units for a lot's primary metric */
  defaultUnit: string;
}

export const CATEGORIAS: Record<CategoriaId, Categoria> = {
  plantas: {
    id: 'plantas',
    nombre: 'Plantas / Vegetal',
    nombreEn: 'Plants / Vegetal',
    icon: '🌱',
    wasteInputs: [
      'Tusa de Palma',
      'Hoja de Palma',
      'Vástago de Plátano',
      'Rastrojo Agrícola',
      'Efluente de molino de palma (POME)',
      'Lodo / Fibra de palma',
    ],
    primaryUnits: ['kg', 'toneladas'],
    monitored: [
      { key: 'nitrogeno', label: 'Nitrógeno (N)', unit: 'mg/kg', optimalMin: 150, optimalMax: 300, warningMax: 300, highIsBad: false, lowIsBad: true },
      { key: 'fosforo', label: 'Fósforo (P)', unit: 'mg/kg', optimalMin: 30, optimalMax: 80, warningMax: 80, highIsBad: false, lowIsBad: true },
      { key: 'potasio', label: 'Potasio (K)', unit: 'mg/kg', optimalMin: 200, optimalMax: 400, warningMax: 400, highIsBad: false, lowIsBad: true },
      { key: 'humedad', label: 'Humedad del Sustrato', unit: '%', optimalMin: 60, optimalMax: 75, warningMax: 75, highIsBad: false, lowIsBad: true },
      { key: 'ph', label: 'pH del Suelo/Compost', unit: 'pH', optimalMin: 6.0, optimalMax: 7.5, warningMax: 7.5, highIsBad: false, lowIsBad: true },
    ],
    alerts: { nitrogeno: 100, fosforo: 15, potasio: 120, humedad: 45, ph: 5.0 },
    esg: {
      biomassFactor: 0.85,   // kg biofertilizer per kg vegetal residue
      co2eFactor: 0.42,
      methaneFactor: 0.05,
      harvestDays: 45,       // vegetal residue to compost
      frassFactor: 0.4,      // 40% of biomass → frass/compost
    },
    defaultUnit: 'kg',
  },

  ganado: {
    id: 'ganado',
    nombre: 'Ganadería / Estercolero',
    nombreEn: 'Livestock / Manure',
    icon: '🐄',
    wasteInputs: [
      'Estiércol Bovino',
      'Purín Porcino',
      'Cama de Aves',
    ],
    primaryUnits: ['kg', 'toneladas', 'm3'],
    monitored: [
      { key: 'temperatura', label: 'Temperatura de Fermentación', unit: '°C', optimalMin: 55, optimalMax: 65, warningMax: 65, highIsBad: false, lowIsBad: true },
      { key: 'humedad', label: 'Humedad de Estiércol', unit: '%', optimalMin: 65, optimalMax: 80, warningMax: 80, highIsBad: false, lowIsBad: true },
      { key: 'co2', label: 'Dióxido de Carbono (CO2)', unit: 'ppm', optimalMin: 400, optimalMax: 1200, warningMax: 1200, highIsBad: true },
      { key: 'metano', label: 'Emisión de Metano (CH4)', unit: 'ppm', optimalMin: 0, optimalMax: 500, warningMax: 500, highIsBad: true },
    ],
    alerts: { temperatura: 40, humedad: 50, co2: 2000, metano: 1000 },
    esg: {
      biomassFactor: 0.70,   // biofertilizer from manure
      co2eFactor: 1.15,      // high CO2e avoided (manure is a big emitter)
      methaneFactor: 0.28,
      harvestDays: 45,       // slurry to stabilized biofertilizer
      frassFactor: 0.4,      // 40% of biomass → frass/compost
    },
    defaultUnit: 'kg',
  },

  larvas: {
    id: 'larvas',
    nombre: 'Larvas / BSF',
    nombreEn: 'Larvae / Black Soldier Fly',
    icon: '🪲',
    wasteInputs: [
      'Desecho Orgánico Mixto',
      'Residuo Agroindustrial',
      'Frutas y Verduras',
    ],
    primaryUnits: ['kg de biomasa larvaria', 'cajas/bandejas'],
    monitored: [
      { key: 'temperatura', label: 'Temperatura Ambiental/Sustrato', unit: '°C', optimalMin: 27, optimalMax: 31, warningMax: 31, highIsBad: false, lowIsBad: true },
      { key: 'humedad_sustrato', label: 'Humedad del Sustrato', unit: '%', optimalMin: 65, optimalMax: 75, warningMax: 75, highIsBad: false, lowIsBad: true },
      { key: 'densidad', label: 'Densidad Poblacional', unit: 'larvas/cm2', optimalMin: 3, optimalMax: 5, warningMax: 5, highIsBad: true },
      { key: 'fcr', label: 'Tasa Conversión Alimenticia (FCR)', unit: 'ratio', optimalMin: 1.5, optimalMax: 2.2, warningMax: 2.2, highIsBad: true },
    ],
    alerts: { temperatura: 20, humedad_sustrato: 55, densidad: 8, fcr: 3.0 },
    esg: {
      biomassFactor: 0.92,   // high larval biomass yield per kg residue
      co2eFactor: 0.18,
      methaneFactor: 0.02,
      harvestDays: 14,       // BSF cycle
      frassFactor: 0.4,      // 40% of biomass → frass/compost
    },
    defaultUnit: 'kg de biomasa larvaria',
  },
};

export const CATEGORIA_LIST = Object.values(CATEGORIAS);

/** Legacy id → current category id map (DSA audit F4: was inline ternaries in getCategoria). */
const LEGACY_ID_MAP: Record<string, CategoriaId> = {
  palma: 'plantas',
  platano: 'plantas',
  bsf: 'larvas',
};

/** Get a category config by id; defaults to 'plantas' for unknown/legacy ids. */
export function getCategoria(id?: string | null): Categoria {
  if (!id) return CATEGORIAS.plantas;
  const normalized = LEGACY_ID_MAP[id] || (id as CategoriaId);
  return CATEGORIAS[normalized] || CATEGORIAS.plantas;
}

/** Classify a status (green/orange/red) for a monitored param value in a category. */
export function statusForParam(cat: Categoria, param: MonitoredParam, value: number): 'green' | 'orange' | 'red' {
  if (value == null || Number.isNaN(value)) return 'green';
  const alertLow = cat.alerts?.[param.key];
  // Red if above the high warning/alert or below the low-side alert.
  if ((alertLow != null && value < alertLow) || (param.highIsBad && value > param.warningMax)) return 'red';
  // Orange if outside the optimal band (high side worse or low side worse).
  if (param.highIsBad && value > param.optimalMax) return 'orange';
  if (param.lowIsBad && value < param.optimalMin) return 'orange';
  if (value < param.optimalMin || value > param.optimalMax) return 'orange';
  return 'green';
}
