/**
 * src/application/use-cases/RequestLicenseUseCase.ts
 *
 * Caso de uso: emitir una licencia vinculada a hardware.
 * Verifica deduplicación (no emite licencia nueva si ya hay una activa
 * para esa huella), genera la clave criptográfica, y persiste.
 */

import { License, LicenseTier, LICENSE_DURATION_DAYS } from '../../domain/entities/License';
import { LicenseRepository } from '../../domain/repositories/LicenseRepository';
import { CryptoService } from '../../domain/services/CryptoService';
import { RequestLicenseRequestDTO, RequestLicenseResponseDTO } from '../dtos/LicenseDTOs';

export class RequestLicenseUseCase {
  constructor(
    private licenseRepository: LicenseRepository,
    private cryptoService: CryptoService,
  ) {}

  async execute(request: RequestLicenseRequestDTO): Promise<RequestLicenseResponseDTO> {
    // 1. Deduplicación — si ya hay licencia activa para esta huella, retornarla
    const existing = await this.licenseRepository.findActiveByHardwareFingerprint(
      request.hardwareFingerprint,
    );
    if (existing && existing.status === 'ACTIVE' && existing.expiresAt > new Date()) {
      return {
        id: existing.id,
        clientId: existing.clientId,
        licenseKey: existing.licenseKey,
        tier: existing.tier,
        status: existing.status,
        issuedAt: existing.issuedAt.toISOString(),
        expiresAt: existing.expiresAt.toISOString(),
      };
    }

    // 2. Generar clave de licencia
    const licenseKey = this.cryptoService.generateLicenseKey(
      request.clientId,
      request.hardwareFingerprint,
    );

    // 3. Calcular vigencia según tier
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + LICENSE_DURATION_DAYS[request.tier]);

    // 4. Crear licencia
    const license: License = {
      id: this.generateId(),
      clientId: request.clientId,
      hardwareFingerprint: request.hardwareFingerprint,
      licenseKey,
      tier: request.tier,
      status: 'ACTIVE',
      issuedAt: now,
      expiresAt,
      createdAt: now,
    };

    // 5. Persistir
    const saved = await this.licenseRepository.save(license);

    return {
      id: saved.id,
      clientId: saved.clientId,
      licenseKey: saved.licenseKey,
      tier: saved.tier,
      status: saved.status,
      issuedAt: saved.issuedAt.toISOString(),
      expiresAt: saved.expiresAt.toISOString(),
    };
  }

  private generateId(): string {
    return `lic_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}