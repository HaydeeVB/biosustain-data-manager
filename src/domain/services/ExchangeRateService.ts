/**
 * src/domain/services/ExchangeRateService.ts
 *
 * Interfaz del servicio de tasa de cambio — obtiene la tasa BCV.
 */
export interface ExchangeRateService {
  getBCVRate(): Promise<number>;
}