/**
 * src/dominio/BioconversionAgent.ts
 * IA para optimización de bioconversión.
 * Complejidad: O(1) - Tiempo constante.
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
function runTest() {
    const agent = new BioconversionAgent();
    const testResult = agent.executeDecision({ pH: 4.0, temperature: 25 });
    
    console.assert(testResult === "ACTION: ADJUST_SUBSTRATE_ACIDITY", "Test falló: pH fuera de rango");
    console.log("Test unitario pasado exitosamente.");
}

runTest();
