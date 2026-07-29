/**
 * src/domain/repositories/LicenseRepository.ts
 *
 * Interfaz del repositorio de licencias.
 */

import { License } from '../entities/License';

export interface LicenseRepository {
  save(license: License): Promise<License>;
  findById(id: string): Promise<License | null>;
  findByClientId(clientId: string): Promise<License[]>;
  findActiveByHardwareFingerprint(fingerprint: string): Promise<License | null>;
  updateStatus(id: string, status: License['status']): Promise<void>;
}