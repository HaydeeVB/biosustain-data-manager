/**
 * src/infrastructure/services/MockExchangeRateService.ts
 *
 * Mock del servicio de tasa de cambio — devuelve una tasa fija.
 * En producción se sustituye por un scraper/API del BCV.
 */

import { ExchangeRateService } from '../../domain/services/ExchangeRateService';

export class MockExchangeRateService implements ExchangeRateService {
  private rate: number;

  constructor(rate: number = 150.50) {
    this.rate = rate;
  }

  async getBCVRate(): Promise<number> {
    // Tasa simulada del BCV (Bs/USD)
    return this.rate;
  }

  /** Permite actualizar la tasa en pruebas. */
  setRate(rate: number): void {
    this.rate = rate;
  }
}