import { BioconversionAgent, ReactorState } from '../../domain/BioconversionAgent';
import { IRepository, FirestoreRepository } from '../db/Repository';

/**
 * SensorSubscriber Integrado
 * Orquesta la lógica: Recibir -> Decidir -> Persistir.
 * Complejidad: O(1) + O(1) (decisión + escritura asíncrona).
 */
export class SensorSubscriber {
    private agent: BioconversionAgent;
    private repository: IRepository;

    constructor() {
        this.agent = new BioconversionAgent();
        this.repository = new FirestoreRepository();
    }

    /**
     * Procesa mensaje de Pub/Sub y asegura la persistencia de la evidencia.
     */
    public async onMessageReceived(data: string): Promise<string> {
        try {
            const state: ReactorState = JSON.parse(data);
            const decision = this.agent.executeDecision(state);
            
            // Persistir la decisión para generar el registro de auditoría
            await this.repository.saveDecision(state, decision);
            
            return decision;
        } catch (error) {
            return "ERROR: PROCESSING_FAILURE";
        }
    }
}

// --- TEST UNITARIO DE INTEGRACIÓN ---
async function runTest() {
    const subscriber = new SensorSubscriber();
    const mockData = JSON.stringify({ pH: 6.0, temperature: 25 });
    
    const result = await subscriber.onMessageReceived(mockData);
    console.assert(result === "ACTION: MONITOR_STABLE_GROWTH", "Fallo en integración: Decisión incorrecta");
    console.log("Integración validada exitosamente.");
}

runTest();
