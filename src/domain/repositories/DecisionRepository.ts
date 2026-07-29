/**
 * src/domain/repositories/DecisionRepository.ts
 *
 * Interfaz del repositorio de decisiones de bioconversión — persiste
 * el registro de auditoría de cada decisión del agente.
 */

import { ReactorState, BioconversionDecision } from '../entities/BioconversionAgent';

export interface DecisionRecord {
  id: string;
  state: ReactorState;
  decision: BioconversionDecision;
  timestamp: Date;
}

export interface DecisionRepository {
  save(state: ReactorState, decision: BioconversionDecision): Promise<DecisionRecord>;
  findByTimeRange(start: Date, end: Date): Promise<DecisionRecord[]>;
  findLatest(limit: number): Promise<DecisionRecord[]>;
}