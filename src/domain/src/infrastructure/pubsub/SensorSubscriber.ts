import { BioconversionAgent, ReactorState } from '../../domain/BioconversionAgent';

/**
 * Subscriber de eventos Pub/Sub.
 * Procesa mensajes de sensores en tiempo real con complejidad O(1).
 */
export class SensorSubscriber {
    private agent: BioconversionAgent;

    constructor() {
        this.agent = new BioconversionAgent();
    }

    /**
     * Procesa mensaje entrante de Pub/Sub.
     * @param data String JSON con formato {pH: number, temperature: number}
     */
    public onMessageReceived(data: string): string {
        try {
            const state: ReactorState = JSON.parse(data);
            return this.agent.executeDecision(state);
        } catch (error) {
            return "ERROR: INVALID_DATA_FORMAT";
        }
    }
}

// --- CASOS DE PRUEBA UNITARIOS ---
const subscriber = new SensorSubscriber();

// Prueba 1: Datos válidos
const testData = JSON.stringify({ pH: 6.0, temperature: 25 });
console.assert(subscriber.onMessageReceived(testData) === "ACTION: MONITOR_STABLE_GROWTH", "Prueba 1 falló");

// Prueba 2: Datos fuera de rango
const testDataAlarm = JSON.stringify({ pH: 4.0, temperature: 25 });
console.assert(subscriber.onMessageReceived(testDataAlarm) === "ACTION: ADJUST_SUBSTRATE_ACIDITY", "Prueba 2 falló");
