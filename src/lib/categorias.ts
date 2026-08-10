/**
 * Bioconversion Category Engine — config for the 4 regional categories.
 *
 * Sur del Lago pivot: BioSustain is decoupled from larva-only (BSF) into a
 * general-purpose bioconversion engine. Each category has distinct waste inputs,
 * units of measure, monitored parameters, status-indicator thresholds, and
 * ESG (CO2e / methane) factors per the team's spec (For_BioSustain.md).
 *
 * Reference threshold values are agronomic starting points; the team will
 * calibrate with real field data (see biosustain-for-team-message.md).
 */

export type CategoriaId =
  | 'palma'     // Oil Palm / Palma Aceitera
  | 'ganado'    // Cattle Ranching & Livestock / Ganadería
  | 'platano'   // Plantain / Plátano y Guineo
  | 'bsf'       // Larval bioconversion (BSF - optional/specialized)

export interface MonitoredParam {
  key: string;
  label: string;          // human label (ES)
  unit: string;           // e.g. '%', '°C', 'pH', 'm³'
  optimalMin: number;     // green
  optimalMax: number;     // green
  warningMax: number;     // orange above this (red above warningMax*1.0)
  highIsBad: boolean;     // true if values ABOVE optimalMax are worse (temp, pH)
  lowIsBad?: boolean;     // true if values BELOW optimalMin are worse when min matters
}

export interface Categoria {
  id: CategoriaId;
  nombre: string;                    // ES label
  nombreEn: string;
  icon: string;                      // emoji for UI
  wasteInputs: string[];             // waste streams to select from
  primaryUnits: string[];            // e.g. ['Hectáreas', 'Toneladas', 'Pilas']
  monitored: MonitoredParam[];       // dashboard params + thresholds
  /** ESG / bioconversion factors (per kg of waste input unless noted) */
  esg: {
    biomassFactor: number;           // kg biomasa/frass per kg residuo
    co2eFactor: number;              // kg CO2e avoided per kg residuo
    methaneFactor: number;           // kg CH4 avoided per kg residuo
    harvestDays: number;             // typical process cycle (days)
  };
  /** Default units for a lot's primary metric */
  defaultUnit: string;
}

export const CATEGORIAS: Record<CategoriaId, Categoria> = {
  palma: {
    id: 'palma',
    nombre: 'Palma Aceitera',
    nombreEn: 'Oil Palm',
    icon: '🌴',
    wasteInputs: [
      'Racimos de fruta vacíos (EFB / Tusa)',
      'Efluente de molino de palma (POME)',
      'Lodo / Fibra de palma',
    ],
    primaryUnits: ['Hectáreas', 'Toneladas', 'Pilas'],
    monitored: [
      { key: 'humedad', label: 'Humedad de pila', unit: '%', optimalMin: 55, optimalMax: 70, warningMax: 80, highIsBad: true },
      { key: 'descomposicion', label: 'Velocidad de descomposición', unit: '%/sem', optimalMin: 2, optimalMax: 5, warningMax: 7, highIsBad: true },
      { key: 'temp_nucleo', label: 'Temperatura de núcleo', unit: '°C', optimalMin: 50, optimalMax: 65, warningMax: 75, highIsBad: true },
      { key: 'abono', label: 'Producción estimada de abono (Frass/Compost)', unit: 't', optimalMin: 0, optimalMax: 9999, warningMax: 9999, highIsBad: false, lowIsBad: false },
    ],
    esg: {
      biomassFactor: 0.30,   // frass/compost yield from palm residue
      co2eFactor: 0.55,      // palm residue avoids methane-rich landfill decay
      methaneFactor: 0.35,
      harvestDays: 60,       // palm residue composting cycle (EFB breakdown)
    },
    defaultUnit: 'Toneladas',
  },

  ganado: {
    id: 'ganado',
    nombre: 'Ganadería Bovina/Porcina',
    nombreEn: 'Cattle Ranching & Livestock',
    icon: '🐄',
    wasteInputs: [
      'Biomasa fecal bovina',
      'Lodo de estiércol (slurry)',
      'Orina',
      'Residuos de sala de ordeño',
    ],
    primaryUnits: ['Toneladas', 'Fosas de estiércol', 'Lagunas', 'm³'],
    monitored: [
      { key: 'humedad', label: 'Humedad de fosa', unit: '%', optimalMin: 80, optimalMax: 90, warningMax: 95, highIsBad: true },
      { key: 'ph', label: 'Nivel de pH', unit: 'pH', optimalMin: 6.0, optimalMax: 8.0, warningMax: 9.0, highIsBad: true, lowIsBad: true },
      { key: 'metano', label: 'Reducción de CH₄', unit: '%', optimalMin: 40, optimalMax: 90, warningMax: 90, highIsBad: false, lowIsBad: true },
      { key: 'nitrogeno', label: 'Estabilización de nitrógeno', unit: '%', optimalMin: 30, optimalMax: 85, warningMax: 85, highIsBad: false, lowIsBad: true },
    ],
    esg: {
      biomassFactor: 0.10,   // biofertilizer from manure
      co2eFactor: 0.40,
      methaneFactor: 0.80,   // livestock slurry is a big methane source
      harvestDays: 45,       // slurry to biofertilizer stabilization
    },
    defaultUnit: 'Toneladas',
  },

  platano: {
    id: 'platano',
    nombre: 'Plátano y Guineo',
    nombreEn: 'Plantain Farming',
    icon: '🍌',
    wasteInputs: [
      'Residuos de cultivo (rastrojo)',
      'Tallos / pseudotallos',
      'Fruta rechazada / cáscara',
    ],
    primaryUnits: ['Hectáreas', 'Lotes', 'Toneladas'],
    monitored: [
      { key: 'descomposicion', label: 'Velocidad de descomposición', unit: '%/sem', optimalMin: 3, optimalMax: 7, warningMax: 9, highIsBad: true },
      { key: 'humus', label: 'Recuperación de humus del suelo', unit: '%', optimalMin: 20, optimalMax: 60, warningMax: 60, highIsBad: false, lowIsBad: true },
      { key: 'humedad_suelo', label: 'Humedad del suelo', unit: '%', optimalMin: 40, optimalMax: 65, warningMax: 75, highIsBad: true },
      { key: 'npk', label: 'Valor orgánico N-P-K', unit: 'kg/ha', optimalMin: 50, optimalMax: 150, warningMax: 200, highIsBad: true },
    ],
    esg: {
      biomassFactor: 0.25,   // humus recovered from plantain residue
      co2eFactor: 0.35,
      methaneFactor: 0.25,
      harvestDays: 30,       // pseudostem decomposition to humus
    },
    defaultUnit: 'Toneladas',
  },

  bsf: {
    id: 'bsf',
    nombre: 'Bioconversión Larval (BSF)',
    nombreEn: 'Larval Bioconversion (BSF - Specialized)',
    icon: '🪲',
    wasteInputs: [
      'Residuos orgánicos generales',
      'Sobras de alimentos',
    ],
    primaryUnits: ['Bins', 'Cestas', 'Crates'],
    monitored: [
      { key: 'temp_sustrato', label: 'Temperatura de sustrato', unit: '°C', optimalMin: 25, optimalMax: 32, warningMax: 38, highIsBad: true },
      { key: 'humedad', label: 'Humedad de sustrato', unit: '%', optimalMin: 50, optimalMax: 80, warningMax: 90, highIsBad: true },
      { key: 'biomasa_larval', label: 'Crecimiento de biomasa larval', unit: 'g', optimalMin: 0, optimalMax: 9999, warningMax: 9999, highIsBad: false, lowIsBad: false },
    ],
    esg: {
      biomassFactor: 0.18,   // FCR for BSF (legacy)
      co2eFactor: 0.5,
      methaneFactor: 0.30,
      harvestDays: 14,       // BSF cycle (legacy 14-day)
    },
    defaultUnit: 'Cestas',
  },
};

export const CATEGORIA_LIST = Object.values(CATEGORIAS);

/** Get a category config by id; defaults to bsf for unknown. */
export function getCategoria(id?: string | null): Categoria {
  return (id && CATEGORIAS[id as CategoriaId]) || CATEGORIAS.bsf;
}

/** Classify a status (green/orange/red) for a monitored param value in a category. */
export function statusForParam(cat: Categoria, param: MonitoredParam, value: number): 'green' | 'orange' | 'red' {
  if (value == null || Number.isNaN(value)) return 'green';
  if (param.highIsBad) {
    if (value > param.warningMax) return 'red';
    if (value > param.optimalMax) return 'orange';
  }
  if (param.lowIsBad && value < param.optimalMin) return 'orange';
  return 'green';
}
