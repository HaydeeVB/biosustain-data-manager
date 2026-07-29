/**
 * src/infrastructure/services/MockCryptoService.ts
 *
 * Mock del servicio criptográfico — genera claves pseudoaleatorias.
 * En producción se sustituye por un servicio con HMAC-SHA256 + salt.
 */

import { CryptoService } from '../../domain/services/CryptoService';

export class MockCryptoService implements CryptoService {
  generateLicenseKey(clientId: string, fingerprint: string): string {
    // Clave simulada: BSUST-XXXXXXXX-XXXXXXXX
    const segment = (seed: string) => {
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash |= 0;
      }
      return Math.abs(hash).toString(36).toUpperCase().padStart(8, '0').slice(0, 8);
    };
    return `BSUST-${segment(clientId)}-${segment(fingerprint)}`;
  }

  verifyLicenseKey(key: string): boolean {
    return /^BSUST-[A-Z0-9]{8}-[A-Z0-9]{8}$/.test(key);
  }
}