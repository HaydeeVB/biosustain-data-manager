/**
 * src/domain/entities/License.ts
 *
 * Entidad de licencia — representa una licencia emitida y vinculada
 * a un dispositivo mediante huella de hardware.
 */

export type LicenseTier = 'STANDARD' | 'ENTERPRISE';
export type LicenseStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';

export interface License {
  id: string;
  clientId: string;
  hardwareFingerprint: string;
  licenseKey: string;
  tier: LicenseTier;
  status: LicenseStatus;
  issuedAt: Date;
  expiresAt: Date;
  createdAt: Date;
}

/** Duración de cada tier en días. */
export const LICENSE_DURATION_DAYS: Record<LicenseTier, number> = {
  STANDARD: 30,
  ENTERPRISE: 365,
};