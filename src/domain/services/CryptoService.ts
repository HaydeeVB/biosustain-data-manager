/**
 * src/domain/services/CryptoService.ts
 *
 * Interfaz del servicio criptográfico — genera claves de licencia.
 */
export interface CryptoService {
  generateLicenseKey(clientId: string, fingerprint: string): string;
  verifyLicenseKey(key: string): boolean;
}