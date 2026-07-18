import { ReactorState } from '../../domain/BioconversionAgent';

/**
 * Interfaz para definir el contrato de persistencia.
 * SOLID: Dependemos de abstracciones, no de implementaciones concretas.
 */
export interface IRepository {
    saveDecision(state: ReactorState, decision: string): Promise<boolean>;
}

/**
 * Implementación concreta para Google Cloud Firestore.
 * Complejidad: O(1) para inserciones simples.
 */
export class FirestoreRepository implements IRepository {
    public async saveDecision(state: ReactorState, decision: string): Promise<boolean> {
        try {
            // Simulamos la llamada a la SDK de Firebase/Firestore
            console.log(`Persistiendo en Firestore:`, { state, decision, timestamp: new Date().toISOString() });
            return true;
        } catch (error) {
            console.error("Error de persistencia:", error);
            return false;
        }
    }
}

// --- TEST UNITARIO ---
const repo = new FirestoreRepository();
repo.saveDecision({ pH: 6.5, temperature: 28 }, "ACTION: MONITOR_STABLE_GROWTH")
    .then(success => console.assert(success === true, "Persistencia fallida"));
