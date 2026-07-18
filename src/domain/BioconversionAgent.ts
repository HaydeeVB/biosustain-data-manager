/**
 * src/domain/BioconversionAgent.ts
 * Agente de IA para optimización de bioconversión.
 * Complejidad: O(1) - Tiempo constante de ejecución.
 */
export interface ReactorState {
    pH: number;
    temperature: number;
}

export class BioconversionAgent {
    // Umbrales científicos para BSF
    private readonly PH_RANGE = { min: 5.5, max: 7.5 };

    public executeDecision(state: ReactorState): string {
        if (state.pH < this.PH_RANGE.min || state.pH > this.PH_RANGE.max) {
            return "ACTION: ADJUST_SUBSTRATE_ACIDITY";
        }
        return "ACTION: MONITOR_STABLE_GROWTH";
    }
}

// Caso de prueba unitario
// test('Valida decisión de pH fuera de rango')
const agent = new BioconversionAgent();
console.assert(agent.executeDecision({pH: 4.0, temperature: 25}) === "ACTION: ADJUST_SUBSTRATE_ACIDITY");
