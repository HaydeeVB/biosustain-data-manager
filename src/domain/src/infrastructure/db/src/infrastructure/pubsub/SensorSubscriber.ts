/**
 * @file SensorSubscriber.ts
 * @description Orquestador de eventos (Pub/Sub). 
 * Aplica Inyección de Dependencias para desacoplar el motor de reglas del almacenamiento.
 */
import { BioconversionAgent, ReactorState } from '../../domain/BioconversionAgent';
import { FirestoreRepository } from '../db/Repository';

export class SensorSubscriber {
    // Inyección de dependencias para desacoplamiento estricto
    private readonly agent = new BioconversionAgent();
    private readonly repo = new FirestoreRepository();

    /**
     * Procesa el mensaje entrante del bus de eventos.
     * Complejidad: O(1)
     * @param payload - String JSON con las métricas del reactor.
     */
    public async onMessage(payload: string): Promise<void> {
        try {
            const state: ReactorState = JSON.parse(payload);
            
            // 1. Ejecutar lógica de negocio
            const action = this.agent.execute(state);
            
            // 2. Persistir resultado
            await this.repo.saveAuditLog(action);
            
            console.log(`[Subscriber] Proceso finalizado: ${action}`);
        } catch (error) {
            console.error("[Subscriber] Error en orquestación:", error);
            throw new Error("Pipeline Execution Failed");
        }
    }
}

// Test unitario de integración básica
const testSubscriber = new SensorSubscriber();
testSubscriber.onMessage('{"pH": 6.0, "temperature": 25}')
    .then(() => console.log("Integración: Subscriber testeado con éxito."))
    .catch(err => console.error("Test Falló:", err));
