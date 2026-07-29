/**
 * src/domain/index.ts
 *
 * Barrel export de la capa de dominio.
 */

export { BioconversionAgent, ReactorState, BioconversionDecision } from './entities/BioconversionAgent';
export { Subscription, SubscriptionPlan, SubscriptionStatus, PLAN_DURATION_DAYS, PLAN_PRICE_USD } from './entities/Subscription';
export { License, LicenseTier, LicenseStatus, LICENSE_DURATION_DAYS } from './entities/License';
export { Invoice, InvoiceItem, InvoiceStatus, IVA_RATE } from './entities/Invoice';
export { RIF } from './value-objects/RIF';
export { HardwareFingerprint } from './value-objects/HardwareFingerprint';
export * from './repositories';