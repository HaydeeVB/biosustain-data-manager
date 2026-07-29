/**
 * src/infrastructure/database/InMemoryLicenseRepository.ts
 *
 * Implementación en memoria del repositorio de licencias.
 */

import { License } from '../../domain/entities/License';
import { LicenseRepository } from '../../domain/repositories/LicenseRepository';

export class InMemoryLicenseRepository implements LicenseRepository {
  private licenses: Map<string, License> = new Map();

  async save(license: License): Promise<License> {
    this.licenses.set(license.id, { ...license });
    return license;
  }

  async findById(id: string): Promise<License | null> {
    return this.licenses.get(id) ?? null;
  }

  async findByClientId(clientId: string): Promise<License[]> {
    return Array.from(this.licenses.values()).filter(l => l.clientId === clientId);
  }

  async findActiveByHardwareFingerprint(fingerprint: string): Promise<License | null> {
    const now = new Date();
    return (
      Array.from(this.licenses.values()).find(
        l => l.hardwareFingerprint === fingerprint && l.status === 'ACTIVE' && l.expiresAt > now,
      ) ?? null
    );
  }

  async updateStatus(id: string, status: License['status']): Promise<void> {
    const lic = this.licenses.get(id);
    if (lic) {
      this.licenses.set(id, { ...lic, status });
    }
  }
}