/**
 * src/presentation/controllers/BioconversionController.ts
 *
 * Controlador para el agente de bioconversión — recibe lecturas
 * de sensores y devuelve decisiones.
 */

import { BioconversionAgent, ReactorState } from '../../domain/entities/BioconversionAgent';
import { DecisionRepository } from '../../domain/repositories/DecisionRepository';

export class BioconversionController {
  private agent: BioconversionAgent;

  constructor(private decisionRepository: DecisionRepository) {
    this.agent = new BioconversionAgent();
  }

  async processSensorReading(state: ReactorState): Promise<{
    status: number;
    body: unknown;
  }> {
    try {
      const decision = this.agent.executeDecision(state);
      await this.decisionRepository.save(state, decision);
      return { status: 200, body: { decision } };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error interno';
      return { status: 400, body: { error: message } };
    }
  }
}