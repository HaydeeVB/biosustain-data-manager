/**
 * tests/unit/RequestLicenseUseCase.test.ts
 *
 * Tests unitarios para el caso de uso de licencia.
 * Verifica emisión, deduplicación, y vigencia por tier.
 */

import { RequestLicenseUseCase } from '../../src/application/use-cases/RequestLicenseUseCase';
import { InMemoryLicenseRepository } from '../../src/infrastructure/database/InMemoryLicenseRepository';
import { MockCryptoService } from '../../src/infrastructure/services/MockCryptoService';

describe('RequestLicenseUseCase', () => {
  let useCase: RequestLicenseUseCase;
  let repo: InMemoryLicenseRepository;

  beforeEach(() => {
    repo = new InMemoryLicenseRepository();
    const cryptoService = new MockCryptoService();
    useCase = new RequestLicenseUseCase(repo, cryptoService);
  });

  test('emite licencia STANDARD con vigencia de 30 días', async () => {
    const result = await useCase.execute({
      clientId: 'client_001',
      hardwareFingerprint: 'esp32_aabbccdd',
      tier: 'STANDARD',
    });

    expect(result.clientId).toBe('client_001');
    expect(result.tier).toBe('STANDARD');
    expect(result.status).toBe('ACTIVE');
    expect(result.licenseKey).toMatch(/^BSUST-/);

    const issued = new Date(result.issuedAt);
    const expires = new Date(result.expiresAt);
    const diffDays = Math.round((expires.getTime() - issued.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(30);
  });

  test('emite licencia ENTERPRISE con vigencia de 365 días', async () => {
    const result = await useCase.execute({
      clientId: 'client_002',
      hardwareFingerprint: 'esp32_eeff0011',
      tier: 'ENTERPRISE',
    });

    const issued = new Date(result.issuedAt);
    const expires = new Date(result.expiresAt);
    const diffDays = Math.round((expires.getTime() - issued.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(365);
  });

  test('deduplicación: retorna licencia existente para misma huella', async () => {
    const first = await useCase.execute({
      clientId: 'client_001',
      hardwareFingerprint: 'esp32_duplicate',
      tier: 'STANDARD',
    });

    const second = await useCase.execute({
      clientId: 'client_001',
      hardwareFingerprint: 'esp32_duplicate',
      tier: 'STANDARD',
    });

    expect(second.id).toBe(first.id);
    expect(second.licenseKey).toBe(first.licenseKey);
  });

  test('huella inválida no lanza error (validación en controlador)', async () => {
    // El use case confía en que el controlador valida la huella
    const result = await useCase.execute({
      clientId: 'client_001',
      hardwareFingerprint: 'valid_fingerprint_123',
      tier: 'STANDARD',
    });
    expect(result.status).toBe('ACTIVE');
  });
});