/**
 * src/domain/entities/BioconversionAgent.ts
 *
 * Agente de IA para optimización de bioconversión BSF.
 * Complejidad: O(1) — tiempo constante de ejecución.
 *
 * Migrado desde la implementación original con mejoras:
 * - Tipado estricto con uniones discriminadas
 * - Umbrales científicos ampliados (temperatura + pH)
 * - Decisión estructurada en lugar de string plana
 */

/** Estado del reactor medido por sensores IoT. */
export interface ReactorState {
  pH: number;
  temperature: number;
  humidity: number;
  ammonia: number; // MQ-137 (ppm)
  co2: number;     // MQ-135 (ppm)
  weight: number;  // HX711 (gramos)
}

/** Unión discriminada de decisiones del agente. */
export type BioconversionDecision =
  | { type: 'ADJUST_SUBSTRATE_ACIDITY'; reason: string }
  | { type: 'ADJUST_TEMPERATURE'; reason: string }
  | { type: 'ACTIVATE_VENTILATION'; reason: string }
  | { type: 'ACTIVATE_ASPERSOR'; reason: string }
  | { type: 'MONITOR_STABLE_GROWTH'; reason: string };

/** Umbrales científicos para cría de BSF (Hermetia illucens). */
const THRESHOLDS = {
  pH: { min: 5.5, max: 7.5 },
  temperature: { min: 25, max: 35 },
  humidity: { min: 60, max: 80 },
  ammonia: { max: 25 },   // ppm — toxicidad para larvas
  co2: { max: 1000 },     // ppm — ventilación requerida
} as const;

/**
 * Agente de bioconversión — evalúa el estado del reactor
 * y produce una decisión determinista en O(1).
 */
export class BioconversionAgent {
  private readonly thresholds = THRESHOLDS;

  public executeDecision(state: ReactorState): BioconversionDecision {
    // pH fuera de rango — prioridad alta
    if (state.pH < this.thresholds.pH.min || state.pH > this.thresholds.pH.max) {
      return {
        type: 'ADJUST_SUBSTRATE_ACIDITY',
        reason: `pH ${state.pH} fuera de rango [${this.thresholds.pH.min}-${this.thresholds.pH.max}]`,
      };
    }

    // Temperatura fuera de rango
    if (state.temperature < this.thresholds.temperature.min) {
      return {
        type: 'ADJUST_TEMPERATURE',
        reason: `Temperatura ${state.temperature}°C por debajo del mínimo ${this.thresholds.temperature.min}°C`,
      };
    }

    // Amoníaco crítico — activar aspersor
    if (state.ammonia > this.thresholds.ammonia.max) {
      return {
        type: 'ACTIVATE_ASPERSOR',
        reason: `Amoníaco ${state.ammonia}ppm supera umbral tóxico ${this.thresholds.ammonia.max}ppm`,
      };
    }

    // CO2 alto — activar ventilación
    if (state.co2 > this.thresholds.co2.max) {
      return {
        type: 'ACTIVATE_VENTILATION',
        reason: `CO2 ${state.co2}ppm supera umbral ${this.thresholds.co2.max}ppm`,
      };
    }

    return {
      type: 'MONITOR_STABLE_GROWTH',
      reason: 'Todos los parámetros dentro de rangos óptimos',
    };
  }
}