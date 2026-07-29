/**
 * src/infrastructure/database/InMemoryDecisionRepository.ts
 *
 * Implementación en memoria del repositorio de decisiones.
 */

import { ReactorState, BioconversionDecision } from '../../domain/entities/BioconversionAgent';
import { DecisionRepository, DecisionRecord } from '../../domain/repositories/DecisionRepository';

export class InMemoryDecisionRepository implements DecisionRepository {
  private records: DecisionRecord[] = [];

  async save(state: ReactorState, decision: BioconversionDecision): Promise<DecisionRecord> {
    const record: DecisionRecord = {
      id: `dec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      state,
      decision,
      timestamp: new Date(),
    };
    this.records.push(record);
    return record;
  }

  async findByTimeRange(start: Date, end: Date): Promise<DecisionRecord[]> {
    return this.records.filter(
      r => r.timestamp >= start && r.timestamp <= end,
    );
  }

  async findLatest(limit: number): Promise<DecisionRecord[]> {
    return [...this.records].slice(-limit).reverse();
  }
}