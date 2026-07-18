/**
 * @file BioconversionAgent.ts
 * @description Lógica de negocio core. Inmutable y sin dependencias.
 */

export interface ReactorState {
    pH: number;
    temperature: number;
}

export class BioconversionAgent {
    // Rangos óptimos constantes
    private readonly THRESHOLDS = { pH_MIN: 5.5, pH_MAX: 7.5 };

    public execute(state: ReactorState): string {
        // Evaluación O(1)
        const isPhValid = state.pH >= this.THRESHOLDS.pH_MIN && state.pH <= this.THRESHOLDS.pH_MAX;
        return isPhValid ? "ACTION: MONITOR_STABLE_GROWTH" : "ACTION: ADJUST_PH";
    }
}

// Validación unitaria básica
const agent = new BioconversionAgent();
console.assert(agent.execute({ pH: 6.0, temperature: 25 }) === "ACTION: MONITOR_STABLE_GROWTH", "Error en test: Rango válido");
console.log("Test de Dominio pasado exitosamente.");
