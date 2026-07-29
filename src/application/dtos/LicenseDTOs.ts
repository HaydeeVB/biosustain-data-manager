/**
 * src/application/dtos/LicenseDTOs.ts
 *
 * Data Transfer Objects para el caso de uso de licencia.
 */

import { LicenseTier } from '../../domain/entities/License';

export interface RequestLicenseRequestDTO {
  clientId: string;
  hardwareFingerprint: string;
  tier: LicenseTier;
}

export interface RequestLicenseResponseDTO {
  id: string;
  clientId: string;
  licenseKey: string;
  tier: LicenseTier;
  status: string;
  issuedAt: string;
  expiresAt: string;
}