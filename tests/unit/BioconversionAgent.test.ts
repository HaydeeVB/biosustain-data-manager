/**
 * tests/unit/BioconversionAgent.test.ts
 *
 * Tests unitarios para el agente de bioconversión BSF.
 * Verifica decisiones deterministas en O(1) para todos los umbrales.
 */

import { BioconversionAgent, ReactorState } from '../../src/domain/entities/BioconversionAgent';

describe('BioconversionAgent', () => {
  let agent: BioconversionAgent;

  beforeEach(() => {
    agent = new BioconversionAgent();
  });

  const stableState: ReactorState = {
    pH: 6.5,
    temperature: 28,
    humidity: 70,
    ammonia: 10,
    co2: 400,
    weight: 500,
  };

  test('retorna MONITOR_STABLE_GROWTH cuando todos los parámetros están en rango', () => {
    const result = agent.executeDecision(stableState);
    expect(result.type).toBe('MONITOR_STABLE_GROWTH');
  });

  test('retorna ADJUST_SUBSTRATE_ACIDITY cuando pH es muy bajo', () => {
    const result = agent.executeDecision({ ...stableState, pH: 4.0 });
    expect(result.type).toBe('ADJUST_SUBSTRATE_ACIDITY');
  });

  test('retorna ADJUST_SUBSTRATE_ACIDITY cuando pH es muy alto', () => {
    const result = agent.executeDecision({ ...stableState, pH: 8.5 });
    expect(result.type).toBe('ADJUST_SUBSTRATE_ACIDITY');
  });

  test('retorna ADJUST_TEMPERATURE cuando temperatura es muy baja', () => {
    const result = agent.executeDecision({ ...stableState, temperature: 20 });
    expect(result.type).toBe('ADJUST_TEMPERATURE');
  });

  test('retorna ACTIVATE_ASPERSOR cuando amoníaco supera umbral tóxico', () => {
    const result = agent.executeDecision({ ...stableState, ammonia: 30 });
    expect(result.type).toBe('ACTIVATE_ASPERSOR');
  });

  test('retorna ACTIVATE_VENTILATION cuando CO2 supera umbral', () => {
    const result = agent.executeDecision({ ...stableState, co2: 1200 });
    expect(result.type).toBe('ACTIVATE_VENTILATION');
  });

  test('prioridad: pH se evalúa antes que temperatura', () => {
    const result = agent.executeDecision({ ...stableState, pH: 4.0, temperature: 20 });
    expect(result.type).toBe('ADJUST_SUBSTRATE_ACIDITY');
  });
});